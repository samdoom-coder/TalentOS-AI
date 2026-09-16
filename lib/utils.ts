import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function uniqueSlug(base: string): string {
  const s = slugify(base) || "item";
  const rand = Math.random().toString(36).slice(2, 8);
  return `${s}-${rand}`;
}

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "AI_FAILED"
  | "INTERNAL_ERROR";

export function errorResponse(code: ApiErrorCode, message: string, status = 400, details?: unknown) {
  return Response.json({ success: false, error: { code, message, details } }, { status });
}

export function successResponse<T>(data: T, status = 200, meta?: unknown) {
  return Response.json({ success: true, data, ...(meta ? { meta } : {}) }, { status });
}

export function getPagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const rawLimit = Number(searchParams.get("limit") ?? "20") || 20;
  const limit = Math.min(100, Math.max(1, rawLimit));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function paginated<T>(items: T[], total: number, page: number, limit: number) {
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export function candidateFacingStage(internal: string): string {
  const map: Record<string, string> = {
    applied: "Application Received",
    screening: "Under Review",
    assessment: "Assessment",
    interview: "Interview",
    technical_interview: "Interview",
    final_interview: "Interview",
    offer: "Decision",
    hired: "Decision",
    rejected: "Decision",
  };
  return map[internal] ?? "Under Review";
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
