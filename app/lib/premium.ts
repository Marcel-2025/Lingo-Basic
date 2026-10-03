import type { EntitlementState } from "@/app/lib/types";

/**
 * Central premium decision.
 *
 * Until billing is live, every user is treated as premium (`NEXT_PUBLIC_PREMIUM_FOR_ALL` unset or "true").
 * Setting it to "false" enforces the real entitlement from `userEntitlements/{uid}` (RevenueCat webhook),
 * i.e. the free plan with A1 only and the daily learning limit. Components never hardcode premium flags;
 * they receive the effective entitlement from here.
 */
export const PREMIUM_FOR_ALL = process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL !== "false";

export const getEffectiveEntitlement = (entitlement: EntitlementState, premiumForAll = PREMIUM_FOR_ALL): EntitlementState =>
  premiumForAll && !entitlement.isPremium ? { ...entitlement, isPremium: true, isAdFree: true } : entitlement;
