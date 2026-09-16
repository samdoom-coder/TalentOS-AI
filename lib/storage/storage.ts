import { createWriteStream, promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// Storage abstraction: StorageProvider -> LocalProvider | S3Provider | R2 | GCS.
// Local dev stores under STORAGE_DIR and serves via /api/v1/files signed URLs.

export interface StoredObject {
  key: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
}

export interface StorageProvider {
  readonly name: string;
  save(fileName: string, mimeType: string, data: Buffer): Promise<StoredObject>;
  read(key: string): Promise<Buffer>;
  /** short-lived access URL; never expose raw bucket URLs */
  signedUrl(key: string, expiresSec?: number): Promise<string>;
  delete(key: string): Promise<void>;
}

class LocalProvider implements StorageProvider {
  readonly name = "local";
  private dir = process.env.STORAGE_DIR ?? "./uploads";

  private abs(key: string) {
    return path.join(process.cwd(), this.dir, key);
  }

  async save(fileName: string, mimeType: string, data: Buffer): Promise<StoredObject> {
    const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const full = this.abs(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return { key, url: `/api/v1/files?key=${encodeURIComponent(key)}`, sizeBytes: data.length, mimeType };
  }

  async read(key: string): Promise<Buffer> {
    assertSafeKey(key);
    return fs.readFile(this.abs(key));
  }

  async signedUrl(key: string): Promise<string> {
    assertSafeKey(key);
    return `/api/v1/files?key=${encodeURIComponent(key)}`;
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await fs.unlink(this.abs(key)).catch(() => undefined);
  }
}

function assertSafeKey(key: string) {
  if (key.includes("..") || key.startsWith("/")) throw new Error("Invalid storage key");
}

// S3-compatible stub: swap in AWS SDK in production (same interface).
class S3CompatibleProvider implements StorageProvider {
  readonly name = process.env.STORAGE_PROVIDER ?? "s3";
  async save(): Promise<StoredObject> {
    throw new Error("S3 storage not configured — set STORAGE_PROVIDER=local or provide S3 credentials");
  }
  async read(): Promise<Buffer> {
    throw new Error("S3 storage not configured");
  }
  async signedUrl(): Promise<string> {
    throw new Error("S3 storage not configured");
  }
  async delete(): Promise<void> {
    throw new Error("S3 storage not configured");
  }
}

export function getStorage(): StorageProvider {
  const p = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
  if (p === "local") return new LocalProvider();
  return new S3CompatibleProvider();
}

export function streamToBuffer(stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const s = stream as NodeJS.ReadableStream;
    s.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    s.on("end", () => resolve(Buffer.concat(chunks)));
    s.on("error", reject);
  });
}

export { createWriteStream };
