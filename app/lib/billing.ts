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
    plan: "ad_free_lifetime",
    title: "Werbefrei für immer",
    description: "Einmal kaufen und künftige optionale Werbung dauerhaft ausblenden.",
  },
];

const checkoutLinks: Partial<Record<Exclude<EntitlementPlan, "free">, string>> = {
  premium_monthly: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY_CHECKOUT_URL,
  premium_yearly: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_YEARLY_CHECKOUT_URL,
  ad_free_lifetime: process.env.NEXT_PUBLIC_STRIPE_AD_FREE_LIFETIME_CHECKOUT_URL,
};

export const isWebCheckoutEnabled = () => process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";

export const getWebCheckoutUrl = (plan: Exclude<EntitlementPlan, "free">) =>
  isWebCheckoutEnabled() ? checkoutLinks[plan] : undefined;

export const isNativePlatform = () => {
  if (typeof window === "undefined") return false;
  const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(capacitor?.isNativePlatform?.());
};
