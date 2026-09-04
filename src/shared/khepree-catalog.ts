/**
 * Must match Khepree catalog registration
 * (seed + scripts/register-livestream-ai-desktop-client.sql).
 */
export const KHEPREE_LIVESTREAM_CATALOG = {
  productSlug: "khepree-livestream-ai",
  clientId: "khepree-livestream-ai-desktop",
  redirectUri: "khepreelivestreamai://auth/callback",
  protocol: "khepreelivestreamai",
  accessFeatureKey: "livestream_ai.access",
  productPath: "/vi/products/khepree-livestream-ai",
  plans: [
    {
      slug: "trial",
      nameVi: "Dùng thử",
      nameEn: "Trial",
      amountMinor: 0,
      currency: "VND",
      accessTermDays: 1,
      internalCode: "LIVESTREAM_AI_FREE_TRIAL"
    },
    {
      slug: "month",
      nameVi: "Tháng",
      nameEn: "Monthly",
      amountMinor: 299_000,
      currency: "VND",
      accessTermDays: 30,
      internalCode: "LIVESTREAM_AI_MONTHLY"
    },
    {
      slug: "year",
      nameVi: "Năm",
      nameEn: "Yearly",
      amountMinor: 2_799_000,
      currency: "VND",
      accessTermDays: 365,
      internalCode: "LIVESTREAM_AI_YEARLY"
    }
  ]
} as const;

export type LivestreamPlanSlug = (typeof KHEPREE_LIVESTREAM_CATALOG.plans)[number]["slug"];
