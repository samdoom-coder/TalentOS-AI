// JSON helpers for String-backed JSON columns.
//
// SQLite (Prisma) has no Json type, so flexible fields are stored as JSON text
// in String columns — the same code runs unchanged on Postgres (see
// schema.postgres.prisma). Always write with J()/Jo() and read with P().

/** Serialize for storage (required column). */
export function J(v: unknown): string {
  if (v === undefined) return "null";
  return typeof v === "string" ? v : JSON.stringify(v);
}

/** Serialize for storage (optional column). */
export function Jo(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  return J(v);
}

/** Parse from storage; returns fallback when missing/invalid. */
export function P<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined || v === "") return fallback;
  if (typeof v === "object") return v as T;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v) as T;
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch {
      return fallback;
    }
  }
  return fallback;
}
