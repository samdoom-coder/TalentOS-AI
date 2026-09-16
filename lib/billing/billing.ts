// Billing abstraction (Stripe-ready). Disabled unless FEATURE_BILLING.

export const PLANS = {
  free: { jobs: 3, candidates: 100, aiInterviews: 10, assessments: 50, storageGb: 1 },
  starter: { jobs: 15, candidates: 1000, aiInterviews: 200, assessments: 1000, storageGb: 10 },
  growth: { jobs: 100, candidates: 10000, aiInterviews: 2000, assessments: 10000, storageGb: 100 },
  enterprise: { jobs: -1, candidates: -1, aiInterviews: -1, assessments: -1, storageGb: -1 },
} as const;

export type PlanName = keyof typeof PLANS;

export function isBillingEnabled() {
  return process.env.FEATURE_BILLING === "true" || process.env.BILLING_ENABLED === "true";
}

export function checkLimit(plan: PlanName, metric: keyof (typeof PLANS)["free"], used: number): boolean {
  const limit = PLANS[plan][metric];
  if (limit === -1) return true;
  return used < limit;
}
