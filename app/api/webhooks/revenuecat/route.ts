import { createHmac, timingSafeEqual } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RevenueCatEvent = {
  app_user_id?: string;
  entitlement_ids?: string[] | null;
  environment?: "SANDBOX" | "PRODUCTION" | string;
  event_timestamp_ms?: number;
  expiration_at_ms?: number | null;
  id?: string;
  product_id?: string | null;
  store?: string;
  type?: string;
};

type RevenueCatPayload = { event?: RevenueCatEvent };

const activeEventTypes = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_EXTENDED",
  "NON_RENEWING_PURCHASE",
  "TEMPORARY_ENTITLEMENT_GRANT",
  "PURCHASE_REDEEMED",
]);

const revokedEventTypes = new Set(["EXPIRATION", "REFUND", "SUBSCRIPTION_PAUSED"]);

const hasPremiumEntitlement = (event: RevenueCatEvent) => event.entitlement_ids?.includes("premium") ?? false;

const getFirebaseAdminDb = () => {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("Firebase-Admin-Variablen sind nicht vollständig konfiguriert.");

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getFirestore();
};

const getPlan = (event: RevenueCatEvent) => {
  if (event.product_id === process.env.REVENUECAT_PREMIUM_YEARLY_PRODUCT_ID) return "premium_yearly" as const;
  if (event.product_id === process.env.REVENUECAT_PREMIUM_LIFETIME_PRODUCT_ID || event.expiration_at_ms === null) return "premium_lifetime" as const;
  return "premium_monthly" as const;
};

const verifySignature = (rawBody: string, signatureHeader: string | null) => {
  const secret = process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET;
  if (!secret || !signatureHeader) return false;

  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => {
    const [key, value] = part.split("=", 2);
    return [key, value];
  }));
  const timestamp = parts.t;
  const receivedSignature = parts.v1;
  if (!timestamp || !receivedSignature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Date.now() - Number(timestamp) * 1000) > 5 * 60 * 1000) return false;

  const expectedSignature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expected = Buffer.from(expectedSignature, "utf8");
  const received = Buffer.from(receivedSignature, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const authorization = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
  if (authorization && request.headers.get("authorization") !== authorization) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  if (!verifySignature(rawBody, request.headers.get("x-revenuecat-webhook-signature"))) {
    return NextResponse.json({ error: "Ungültige Webhook-Signatur." }, { status: 401 });
  }

  let payload: RevenueCatPayload;
  try {
    payload = JSON.parse(rawBody) as RevenueCatPayload;
  } catch {
    return NextResponse.json({ error: "Ungültiger Webhook-Body." }, { status: 400 });
  }

  const event = payload.event;
  const userId = event?.app_user_id;
  if (!event || !userId || userId.startsWith("$RCAnonymousID:")) {
    return NextResponse.json({ received: true });
  }

  const isPremiumEvent = hasPremiumEntitlement(event);
  const isActivation = isPremiumEvent && activeEventTypes.has(event.type ?? "");
  const isRevocation = isPremiumEvent && revokedEventTypes.has(event.type ?? "");
  if (!isActivation && !isRevocation) return NextResponse.json({ received: true });

  try {
    const database = getFirebaseAdminDb();
    const reference = database.collection("userEntitlements").doc(userId);
    const updatedAt = Number.isFinite(event.event_timestamp_ms) ? Number(event.event_timestamp_ms) : Date.now();
    await database.runTransaction(async (transaction) => {
      const current = await transaction.get(reference);
      const currentUpdatedAt = Number(current.get("updatedAt") ?? 0);
      if (currentUpdatedAt > updatedAt) return;

      transaction.set(reference, {
        plan: isRevocation ? "free" : getPlan(event),
        status: isRevocation ? "expired" : "active",
        source: "revenuecat",
        expiresAt: isRevocation ? Number(event.expiration_at_ms ?? updatedAt) : (event.expiration_at_ms ?? null),
        updatedAt,
        providerEventId: event.id ?? null,
        providerProductId: event.product_id ?? null,
        providerStore: event.store ?? null,
        providerEnvironment: event.environment ?? null,
      }, { merge: true });
    });
  } catch (error) {
    console.error("RevenueCat webhook konnte nicht verarbeitet werden.", error);
    return NextResponse.json({ error: "Webhook-Verarbeitung fehlgeschlagen." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
