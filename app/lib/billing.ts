import type { EntitlementPlan } from "@/app/lib/types";

export const FREE_DAILY_LEARNING_LIMIT = 20;

export const PREMIUM_OFFERS: Array<{
  plan: Exclude<EntitlementPlan, "free">;
  title: string;
  description: string;
  badge?: string;
}> = [
  {
    plan: "premium_monthly",
    title: "Premium monatlich",
    description: "Unbegrenzt lernen, alle Content-Level und zukünftige Premium-Features.",
  },
  {
    plan: "premium_yearly",
    title: "Premium jährlich",
    description: "Alle Premium-Vorteile zum besten Jahrespreis.",
    badge: "Beste Wahl",
  },
  {
    plan: "premium_lifetime",
    title: "Premium lebenslang",
    description: "Einmal kaufen und alle Premium-Vorteile dauerhaft behalten.",
  },
];

const packageIds: Record<Exclude<EntitlementPlan, "free">, string> = {
  premium_monthly: "$rc_monthly",
  premium_yearly: "$rc_annual",
  premium_lifetime: "$rc_lifetime",
};

const getPurchaseLinkTemplate = () => {
  const environment = process.env.NEXT_PUBLIC_REVENUECAT_BILLING_ENVIRONMENT;
  return environment === "sandbox"
    ? process.env.NEXT_PUBLIC_REVENUECAT_PURCHASE_LINK_SANDBOX_TEMPLATE
    : process.env.NEXT_PUBLIC_REVENUECAT_PURCHASE_LINK_PRODUCTION_TEMPLATE;
};

export const isWebCheckoutEnabled = () =>
  process.env.NEXT_PUBLIC_BILLING_ENABLED === "true" && Boolean(getPurchaseLinkTemplate());

export const getWebCheckoutUrl = (plan: Exclude<EntitlementPlan, "free">, appUserId: string) => {
  const template = getPurchaseLinkTemplate()?.replace(/\/$/, "");
  if (!isWebCheckoutEnabled() || !template || !appUserId) return undefined;
  return `${template}/${encodeURIComponent(appUserId)}/checkout?package_id=${encodeURIComponent(packageIds[plan])}`;
};

export const isNativePlatform = () => {
  if (typeof window === "undefined") return false;
  const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(capacitor?.isNativePlatform?.());
};
