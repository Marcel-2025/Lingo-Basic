import { getFirebaseProjectId, isFirebaseConfigured } from "@/app/lib/firebase-auth";
import type { AuthUser, EntitlementPlan, EntitlementSource, EntitlementState, EntitlementStatus, UserEntitlement } from "@/app/lib/types";

type FirestoreFields = Record<string, { stringValue?: string; integerValue?: string; doubleValue?: number | string; nullValue?: null }>;

export const FREE_ENTITLEMENT: UserEntitlement = {
  plan: "free",
  status: "active",
  source: "none",
  expiresAt: null,
  updatedAt: 0,
};

const plans: EntitlementPlan[] = ["free", "premium_monthly", "premium_yearly", "premium_lifetime"];
const statuses: EntitlementStatus[] = ["active", "trialing", "cancelled", "expired", "unknown"];
const sources: EntitlementSource[] = ["none", "stripe", "google_play", "revenuecat"];

const asString = (value: string | undefined, fallback: string) => value?.trim() || fallback;
const asNumber = (value: number | string | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export const normalizeEntitlement = (input: Partial<UserEntitlement> | undefined): UserEntitlement => {
  const inputPlan = input?.plan;
  const inputStatus = input?.status;
  const inputSource = input?.source;
  const plan = inputPlan && plans.includes(inputPlan) ? inputPlan : FREE_ENTITLEMENT.plan;
  const status = inputStatus && statuses.includes(inputStatus) ? inputStatus : FREE_ENTITLEMENT.status;
  const source = inputSource && sources.includes(inputSource) ? inputSource : FREE_ENTITLEMENT.source;
  const expiresAt = input?.expiresAt === null || input?.expiresAt === undefined
    ? null
    : Number.isFinite(input.expiresAt) && input.expiresAt > 0 ? Number(input.expiresAt) : null;

  return { plan, status, source, expiresAt, updatedAt: Number.isFinite(input?.updatedAt) ? Number(input?.updatedAt) : 0 };
};

export const toEntitlementState = (input: Partial<UserEntitlement> | undefined, now = Date.now()): EntitlementState => {
  const entitlement = normalizeEntitlement(input);
  const hasNotExpired = entitlement.expiresAt === null || entitlement.expiresAt > now;
  const isActive = hasNotExpired && ["active", "trialing", "cancelled"].includes(entitlement.status);
  const isPremium = isActive && ["premium_monthly", "premium_yearly", "premium_lifetime"].includes(entitlement.plan);
  const isAdFree = isPremium;
  return { ...entitlement, isPremium, isAdFree };
};

export const FREE_ENTITLEMENT_STATE = toEntitlementState(FREE_ENTITLEMENT);

const getEntitlementDocUrl = (uid: string) => {
  const projectId = getFirebaseProjectId();
  if (!projectId) throw new Error("Firebase ist nicht konfiguriert.");
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/userEntitlements/${uid}`;
};

export const loadEntitlement = async (user: AuthUser): Promise<EntitlementState> => {
  if (!isFirebaseConfigured()) return FREE_ENTITLEMENT_STATE;
  const response = await fetch(getEntitlementDocUrl(user.localId), {
    headers: { Authorization: `Bearer ${user.idToken}` },
  });
  if (response.status === 404) return FREE_ENTITLEMENT_STATE;
  if (!response.ok) throw new Error("Premium-Status konnte nicht geladen werden.");

  const data = (await response.json()) as { fields?: FirestoreFields };
  const fields = data.fields ?? {};
  return toEntitlementState({
    plan: asString(fields.plan?.stringValue, "free") as EntitlementPlan,
    status: asString(fields.status?.stringValue, "active") as EntitlementStatus,
    source: asString(fields.source?.stringValue, "none") as EntitlementSource,
    expiresAt: fields.expiresAt?.nullValue === null ? null : asNumber(fields.expiresAt?.integerValue ?? fields.expiresAt?.doubleValue),
    updatedAt: asNumber(fields.updatedAt?.integerValue ?? fields.updatedAt?.doubleValue),
  });
};
