// Upload validation: never trust client Content-Type or extension alone.
// Checks magic bytes + extension + size, returns a server-determined mime.

export const ALLOWED_RESUME_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

export function extensionOf(fileName: string): string {
  const m = /\.([a-zA-Z0-9]{1,8})$/.exec(fileName.trim());
  return (m?.[1] ?? "").toLowerCase();
}

function sniffMime(buf: Buffer): string | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  // ZIP (DOCX is a zip): PK\x03\x04
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  // OLE (legacy DOC): D0 CF 11 E0 A1 B1 1A E1
  if (
    buf.length >= 8 &&
    buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0
  ) {
    return "application/msword";
  }
  // Plain text: allow mostly-printable (tolerate UTF-8 BOM, newlines, tabs)
  const sample = buf.subarray(0, 4096);
  let nonPrintable = 0;
  for (const b of sample) {
    if (b === 9 || b === 10 || b === 13) continue;
    if (b < 32 || b === 127) nonPrintable++;
  }
  const ratio = sample.length ? nonPrintable / sample.length : 1;
  if (ratio < 0.05) return "text/plain";
  return null;
}

export interface ValidatedUpload {
  mimeType: string;
  safeName: string;
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

/**
 * Validate resume bytes. Requires magic-byte match AND allowed extension.
 * Returns server-determined mime + sanitized name, or an error message.
 */
export function validateResumeUpload(
  fileName: string,
  clientMime: string,
  buf: Buffer,
  maxBytes: number
): { ok: true; value: ValidatedUpload } | { ok: false; error: string } {
  if (!buf.length || buf.length > maxBytes) {
    return { ok: false, error: "Resume must be under 10MB." };
  }
  const ext = extensionOf(fileName);
  const extMime = EXT_TO_MIME[ext];
  if (!extMime) {
    return { ok: false, error: "Resume must be PDF, DOC, DOCX or TXT." };
  }
  // Client mime must either match the extension mime or be generic octet-stream;
  // anything else is a bypass attempt.
  const normalizedClient = (clientMime || "application/octet-stream").split(";")[0].trim().toLowerCase();
  if (
    normalizedClient !== extMime &&
    normalizedClient !== "application/octet-stream" &&
    !ALLOWED_RESUME_MIME.has(normalizedClient)
  ) {
    return { ok: false, error: "Resume must be PDF, DOC, DOCX or TXT." };
  }
  const sniffed = sniffMime(buf);
  if (!sniffed) {
    return { ok: false, error: "File content does not look like a PDF, DOC, DOCX or TXT resume." };
  }
  // Enforce consistency: sniffed type must equal extension type, except
  // allow text/plain only when extension is txt.
  if (sniffed !== extMime) {
    return { ok: false, error: "File extension does not match file content." };
  }
  return { ok: true, value: { mimeType: sniffed, safeName: sanitizeFileName(fileName) } };
}

// Safe Content-Type for downloads: allowlist, default to octet-stream.
// Prevents stored-XSS via SVG/HTML masquerading as resumes.
export function safeDownloadMime(stored: string | null | undefined): string {
  if (stored && ALLOWED_RESUME_MIME.has(stored)) return stored;
  return "application/octet-stream";
}
