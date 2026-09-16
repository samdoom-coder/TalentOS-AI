// Feature flags for gradual rollout (env-driven; swap for DB-backed flags later).

export const FLAGS = {
  AI_INTERVIEW: process.env.FEATURE_AI_INTERVIEW !== "false",
  VOICE_INTERVIEW: process.env.FEATURE_VOICE_INTERVIEW === "true",
  CODING_ASSESSMENT: process.env.FEATURE_CODING_ASSESSMENT !== "false",
  ROLEPLAY: process.env.FEATURE_ROLEPLAY !== "false",
  SHOWCASE: process.env.FEATURE_SHOWCASE !== "false",
  SEMANTIC_SEARCH: process.env.FEATURE_SEMANTIC_SEARCH === "true",
  BILLING: process.env.FEATURE_BILLING === "true",
  WHATSAPP: process.env.FEATURE_WHATSAPP === "true",
} as const;

export type FlagName = keyof typeof FLAGS;

export function isEnabled(flag: FlagName): boolean {
  return FLAGS[flag];
}
