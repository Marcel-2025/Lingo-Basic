import type { EntitlementPlan } from "@/app/lib/types";
import { getFirebaseAdminDb } from "@/app/lib/server/firebase-admin";

interface RevenueCatEntitlementInput {
  environment?: string | null;
  eventId?: string | null;
  expiresAt: number | null;
  productId?: string | null;
  status: "active" | "expired";
  store?: string | null;
  updatedAt: number;
  userId: string;
}

export const getRevenueCatPlan = (productId: string | null | undefined, expiresAt: number | null): EntitlementPlan => {
  if (productId === process.env.REVENUECAT_PREMIUM_YEARLY_PRODUCT_ID) return "premium_yearly";
  if (productId === process.env.REVENUECAT_PREMIUM_LIFETIME_PRODUCT_ID || expiresAt === null) return "premium_lifetime";
  return "premium_monthly";
};

export const syncRevenueCatEntitlement = async ({ userId, status, expiresAt, updatedAt, productId, eventId, store, environment }: RevenueCatEntitlementInput) => {
  const database = getFirebaseAdminDb();
  const reference = database.collection("userEntitlements").doc(userId);
  await database.runTransaction(async (transaction) => {
    const current = await transaction.get(reference);
    const currentUpdatedAt = Number(current.get("updatedAt") ?? 0);
    if (currentUpdatedAt > updatedAt) return;

    transaction.set(reference, {
      plan: status === "active" ? getRevenueCatPlan(productId, expiresAt) : "free",
      status,
      source: "revenuecat",
      expiresAt,
      updatedAt,
      providerEventId: eventId ?? null,
      providerProductId: productId ?? null,
      providerStore: store ?? null,
      providerEnvironment: environment ?? null,
    }, { merge: true });
  });
};
