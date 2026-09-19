import { z } from "zod";

// Heuristic resume parser (offline-first). The AI layer can refine results when
// a provider is configured; heuristics always run so the pipeline works offline.

export const parsedResumeSchema = z.object({
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  skills: z.array(z.string()).default([]),
  experience: z.array(z.object({
    company: z.string().optional(),
    role: z.string().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
  })).default([]),
  education: z.array(z.object({
    school: z.string().optional(),
    degree: z.string().nullable().optional(),
    field: z.string().nullable().optional(),
    year: z.string().nullable().optional(),
  })).default([]),
  links: z.array(z.string()).default([]),
});

export type ParsedResume = z.infer<typeof parsedResumeSchema>;

export const SKILL_VOCABULARY = [
  "javascript", "typescript", "react", "next.js", "node.js", "python", "java", "go", "c++", "c#", "rust",
  "postgresql", "mysql", "mongodb", "redis", "graphql", "rest", "docker", "kubernetes",
  "aws", "gcp", "azure", "terraform", "figma", "product management", "sales", "negotiation",
  "customer support", "communication", "leadership", "problem solving", "machine learning",
  "data analysis", "data science", "sql", "html", "css", "vue", "angular", "django", "flask", "spring",
  "ruby", "rails", "php", "swift", "kotlin", "flutter", "react native", "tailwind", "prisma",
  "elasticsearch", "kafka", "rabbitmq", "jenkins", "github actions", "linux", "agile", "scrum",
];

async function tryPdfParse(buf: Buffer): Promise<string | null> {
  try {
    // Optional dep: `npm i pdf-parse` enables native PDF text.
    // webpackIgnore keeps Next build green when the package isn't installed;
    // resolved at runtime via Node only.
    // @ts-ignore - optional peer dep, resolved at runtime
    const mod = await import(/* webpackIgnore: true */ "pdf-parse").then((m: unknown) => m as { default?: (b: Buffer) => Promise<{ text?: string }> }).catch(() => null);
    const fn = mod?.default ?? (mod as unknown as (b: Buffer) => Promise<{ text?: string }>) ?? null;
    if (typeof fn !== "function") return null;
    const out = await fn(buf);
    return typeof out?.text === "string" && out.text.trim() ? out.text.slice(0, 100_000) : null;
  } catch {
    return null;
  }
}

async function tryMammoth(buf: Buffer): Promise<string | null> {
  try {
    // Optional dep: `npm i mammoth` enables DOCX text.
    // @ts-ignore - optional peer dep, resolved at runtime
    const mod = await import(/* webpackIgnore: true */ "mammoth").then((m: unknown) => m as { extractRawText?: (o: { buffer: Buffer }) => Promise<{ value?: string }> }).catch(() => null);
    if (!mod?.extractRawText) return null;
    const out = await mod.extractRawText({ buffer: buf });
    return out?.value?.trim() ? out.value.slice(0, 100_000) : null;
  } catch {
    return null;
  }
}

function heuristicText(buf: Buffer): string {
  const raw = buf.toString("latin1");
  // Preserve line breaks for experience/education splitting, collapse other noise.
  const cleaned = raw.replace(/[^\x20-\x7E\n\r@.+\-_/()]/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return cleaned.slice(0, 100_000);
}

export function extractTextFromBuffer(buf: Buffer, mimeType?: string): string {
  // Sync path (workers without optional deps): text fast-path + heuristic.
  if (mimeType?.includes("text") || mimeType?.includes("json")) return buf.toString("utf-8").slice(0, 100_000);
  return heuristicText(buf);
}

/** Async path: tries pdf-parse/mammoth when installed, else heuristic. Callers unchanged. */
export async function extractTextFromBufferAsync(buf: Buffer, mimeType?: string, fileName?: string): Promise<{ text: string; provider: string }> {
  if (mimeType?.includes("text") || fileName?.toLowerCase().endsWith(".txt")) {
    return { text: buf.toString("utf-8").slice(0, 100_000), provider: "text" };
  }
  const isPdf = mimeType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf") || (buf.length > 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-");
  if (isPdf) {
    const t = await tryPdfParse(buf);
    if (t) return { text: t, provider: "pdf-parse" };
  }
  const isDocx = mimeType?.includes("officedocument") || fileName?.toLowerCase().endsWith(".docx") || (buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b);
  if (isDocx) {
    const t = await tryMammoth(buf);
    if (t) return { text: t, provider: "mammoth" };
  }
  return { text: heuristicText(buf), provider: "heuristic" };
}

export function parseResumeText(text: string): ParsedResume {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
  const phone = text.match(/(\+?\d[\d\s\-().]{7,}\d)/)?.[0]?.trim() ?? null;
  const lowered = ` ${text.toLowerCase()} `;
  const skills = SKILL_VOCABULARY.filter((s) => lowered.includes(` ${s} `) || lowered.includes(` ${s},`) || lowered.includes(` ${s}.`));
  const links = [...text.matchAll(/https?:\/\/[^\s)]+/g)].map((m) => m[0]).slice(0, 10);

  // Naive experience splitter: lines with year ranges
  const experience: ParsedResume["experience"] = [];
  for (const m of text.matchAll(/(.{0,60}?)\b(19|20)\d{2}\b.{0,20}?(present|current|(19|20)\d{2})?/gi)) {
    const chunk = m[0].slice(0, 160).trim();
    if (chunk.length > 15) experience.push({ description: chunk });
    if (experience.length >= 10) break;
  }

  // Education: degree keywords + school-ish line nearby
  const education: ParsedResume["education"] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length && education.length < 6; i++) {
    const l = lines[i];
    const deg = l.match(/\b(bachelor|master|mba|b\.?tech|m\.?tech|bca|mca|ph\.?d|associate|diploma|b\.?sc|m\.?sc)\b[^,\n]{0,60}/i)?.[0];
    if (deg) {
      const ctx = [lines[i - 1] ?? "", l, lines[i + 1] ?? ""].join(" ").slice(0, 160);
      const year = l.match(/\b(19|20)\d{2}\b/)?.[0] ?? null;
      education.push({ school: ctx.slice(0, 80), degree: deg.slice(0, 80), year });
    }
  }

  const firstLines = text.split(/\n|\.  /).map((l) => l.trim()).filter(Boolean);
  const name = firstLines.find((l) => l.length > 2 && l.length < 60 && !l.includes("@") && !/experience|summary|skills/i.test(l))?.slice(0, 80) ?? null;

  return parsedResumeSchema.parse({
    name, email, phone,
    summary: text.slice(0, 600),
    skills: [...new Set(skills)],
    experience,
    education,
    links,
  });
}

export function experienceYears(text: string): number {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:\+?\s*)?(years?|yrs?)\b/i);
  if (m) return Math.min(40, parseFloat(m[1]));
  const ranges = [...text.matchAll(/\b(19|20)(\d{2})\b/g)].map((x) => Number(`${x[1]}${x[2]}`));
  if (ranges.length >= 2) {
    const span = Math.max(...ranges) - Math.min(...ranges);
    if (span > 0 && span < 40) return span;
  }
  return 0;
}
