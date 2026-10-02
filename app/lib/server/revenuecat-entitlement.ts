import type { EntitlementPlan } from "@/app/lib/types";
import { firestoreInteger, firestoreNull, firestoreString, getFirestoreUpdatedAt, writeFirestoreDocument } from "@/app/lib/server/firebase-admin";

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
  const documentPath = `userEntitlements/${userId}`;
  const currentUpdatedAt = await getFirestoreUpdatedAt(documentPath);
  if (currentUpdatedAt > updatedAt) return;

  await writeFirestoreDocument(documentPath, {
    plan: firestoreString(status === "active" ? getRevenueCatPlan(productId, expiresAt) : "free"),
    status: firestoreString(status),
    source: firestoreString("revenuecat"),
    expiresAt: expiresAt === null ? firestoreNull() : firestoreInteger(expiresAt),
    updatedAt: firestoreInteger(updatedAt),
    providerEventId: eventId ? firestoreString(eventId) : firestoreNull(),
    providerProductId: productId ? firestoreString(productId) : firestoreNull(),
    providerStore: store ? firestoreString(store) : firestoreNull(),
    providerEnvironment: environment ? firestoreString(environment) : firestoreNull(),
  });
};
