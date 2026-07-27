import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncRevenueCatEntitlement } from "@/app/lib/server/revenuecat-entitlement";

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
    const updatedAt = Number.isFinite(event.event_timestamp_ms) ? Number(event.event_timestamp_ms) : Date.now();
    await syncRevenueCatEntitlement({
      userId,
      status: isRevocation ? "expired" : "active",
      expiresAt: isRevocation ? Number(event.expiration_at_ms ?? updatedAt) : (event.expiration_at_ms ?? null),
      updatedAt,
      productId: event.product_id,
      eventId: event.id,
      store: event.store,
      environment: event.environment,
    });
  } catch (error) {
    console.error("RevenueCat webhook konnte nicht verarbeitet werden.", error);
    return NextResponse.json({ error: "Webhook-Verarbeitung fehlgeschlagen." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
