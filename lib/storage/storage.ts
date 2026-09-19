import { createWriteStream, promises as fs } from "fs";
import path from "path";
import { randomUUID, createHash, createHmac } from "crypto";
import { fetchWithTimeout } from "@/lib/security/fetch";

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

// S3-compatible driver over fetch + SigV4 (no AWS SDK dep).
// Env: S3_ENDPOINT (e.g. https://s3.amazonaws.com or R2 https://<acct>.r2.cloudflarestorage.com),
// S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION (default auto/us-east-1).
class S3CompatibleProvider implements StorageProvider {
  readonly name = process.env.STORAGE_PROVIDER ?? "s3";
  private endpoint = (process.env.S3_ENDPOINT ?? "").replace(/\/$/, "");
  private bucket = process.env.S3_BUCKET ?? "";
  private access = process.env.S3_ACCESS_KEY ?? "";
  private secret = process.env.S3_SECRET_KEY ?? "";
  private region = process.env.S3_REGION && process.env.S3_REGION !== "auto" ? process.env.S3_REGION : "us-east-1";

  private assertConfigured() {
    if (!this.endpoint || !this.bucket || !this.access || !this.secret) {
      throw new Error("S3 storage not configured — set S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY or STORAGE_PROVIDER=local");
    }
  }

  private objectUrl(key: string) {
    return `${this.endpoint}/${this.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  private async signedFetch(method: string, key: string, body?: Buffer, contentType?: string, expiresSec = 3600): Promise<Response> {
    this.assertConfigured();
    const url = this.objectUrl(key);
    const u = new URL(url);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = createHash("sha256").update(body ?? "").digest("hex");
    const headers: Record<string, string> = {
      host: u.host,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
    };
    if (contentType) headers["content-type"] = contentType;
    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonicalHeaders = Object.keys(headers).sort().map((k) => `${k}:${headers[k]}\n`).join("");
    const canonical = [method, u.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonical).digest("hex")].join("\n");
    const kDate = createHmac("sha256", "AWS4" + this.secret).update(dateStamp).digest();
    const kRegion = createHmac("sha256", kDate).update(this.region).digest();
    const kService = createHmac("sha256", kRegion).update("s3").digest();
    const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
    const sig = createHmac("sha256", kSigning).update(toSign).digest("hex");
    const auth = `AWS4-HMAC-SHA256 Credential=${this.access}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`;
    return fetchWithTimeout(url, { method, headers: { ...headers, Authorization: auth, ...(contentType ? { "Content-Type": contentType } : {}) }, body: body as unknown as BodyInit }, 20000);
  }

  async save(fileName: string, mimeType: string, data: Buffer): Promise<StoredObject> {
    const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const res = await this.signedFetch("PUT", key, data, mimeType);
    if (!res.ok) throw new Error(`S3 save failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    return { key, url: `/api/v1/files?key=${encodeURIComponent(key)}`, sizeBytes: data.length, mimeType };
  }
  async read(key: string): Promise<Buffer> {
    assertSafeKey(key);
    const res = await this.signedFetch("GET", key);
    if (!res.ok) throw new Error(`S3 read failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  async signedUrl(key: string): Promise<string> {
    assertSafeKey(key);
    // Serve via /api/v1/files (auth-checked) — never raw bucket URLs.
    return `/api/v1/files?key=${encodeURIComponent(key)}`;
  }
  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await this.signedFetch("DELETE", key).catch(() => undefined);
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
