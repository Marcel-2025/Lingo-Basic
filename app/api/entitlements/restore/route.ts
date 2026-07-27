import { NextResponse } from "next/server";
import { syncRevenueCatEntitlement } from "@/app/lib/server/revenuecat-entitlement";
import { verifyFirebaseIdToken } from "@/app/lib/server/firebase-admin";

export const runtime = "nodejs";

type RevenueCatSubscriberResponse = {
  subscriber?: {
    entitlements?: Record<string, {
      expires_date_ms?: number | string | null;
      product_identifier?: string | null;
      purchase_date_ms?: number | string | null;
      store?: string | null;
    }>;
  };
};

const toTimestamp = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const idToken = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  if (!idToken) return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });

  let userId: string;
  try {
    userId = (await verifyFirebaseIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ error: "Sitzung konnte nicht bestätigt werden. Bitte erneut anmelden." }, { status: 401 });
  }

  const revenueCatApiKey = process.env.REVENUECAT_V1_SECRET_API_KEY;
  if (!revenueCatApiKey) return NextResponse.json({ error: "RevenueCat-Statusabgleich ist noch nicht konfiguriert." }, { status: 503 });

  let subscriber: RevenueCatSubscriberResponse;
  try {
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      headers: { Authorization: revenueCatApiKey },
      cache: "no-store",
    });
    if (response.status === 404) subscriber = {};
    else if (!response.ok) throw new Error(`RevenueCat-Antwort ${response.status}`);
    else subscriber = (await response.json()) as RevenueCatSubscriberResponse;
  } catch (error) {
    console.error("RevenueCat-Status konnte nicht abgerufen werden.", error);
    return NextResponse.json({ error: "RevenueCat-Status konnte nicht abgerufen werden." }, { status: 502 });
  }

  const premium = subscriber.subscriber?.entitlements?.premium;
  const expiresAt = toTimestamp(premium?.expires_date_ms);
  const isActive = Boolean(premium) && (expiresAt === null || expiresAt > Date.now());
  await syncRevenueCatEntitlement({
    userId,
    status: isActive ? "active" : "expired",
    expiresAt,
    updatedAt: Date.now(),
    productId: premium?.product_identifier,
    store: premium?.store,
    environment: null,
  });

  return NextResponse.json({ active: isActive });
}
