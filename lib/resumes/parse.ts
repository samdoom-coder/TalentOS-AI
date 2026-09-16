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
  "javascript", "typescript", "react", "next.js", "node.js", "python", "java", "go", "c++",
  "postgresql", "mysql", "mongodb", "redis", "graphql", "rest", "docker", "kubernetes",
  "aws", "gcp", "azure", "terraform", "figma", "product management", "sales", "negotiation",
  "customer support", "communication", "leadership", "problem solving", "machine learning",
  "data analysis", "sql", "html", "css", "vue", "angular", "django", "flask", "spring",
  "ruby", "rails", "php", "swift", "kotlin", "flutter", "react native",
];

export function extractTextFromBuffer(buf: Buffer, mimeType?: string): string {
  // PDF/DOCX binary-safe text extraction: pull printable runs; proper parsers
  // can be plugged here (pdf-parse / mammoth) without changing callers.
  if (mimeType?.includes("text") || mimeType?.includes("json")) return buf.toString("utf-8").slice(0, 100_000);
  const raw = buf.toString("latin1");
  const printable = raw.replace(/[^\x20-\x7E\n\r@.+\-_/]/g, " ").replace(/\s+/g, " ").trim();
  return printable.slice(0, 100_000);
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

  const firstLines = text.split(/\n|\.  /).map((l) => l.trim()).filter(Boolean);
  const name = firstLines.find((l) => l.length > 2 && l.length < 60 && !l.includes("@") && !/experience|summary|skills/i.test(l))?.slice(0, 80) ?? null;

  return parsedResumeSchema.parse({
    name, email, phone,
    summary: text.slice(0, 600),
    skills: [...new Set(skills)],
    experience,
    education: [],
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
