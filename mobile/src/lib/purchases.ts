import { useEffect, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  isUserCancelledError,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type Product,
  type ProductSubscription,
  type Purchase,
} from "expo-iap";
import { readJson, writeJson } from "~/lib/storage";
import { t, type TranslationKey } from "~/i18n";

/**
 * In-app purchases directly through the stores: Google Play Billing on Android, StoreKit on iOS (expo-iap).
 * No third-party service and no own server: the store itself says what the user owns.
 *
 * - Premium: monthly / yearly subscription or the lifetime one-time purchase (non-consumable).
 * - Consumables: heart pack and coin pack. They are delivered locally through the handler registered with
 *   `setConsumableHandler` (root layout) and only then consumed in the store, so a purchase that arrives while
 *   the app was closed (or after a crash) is still delivered on the next start.
 *
 * Product IDs must match the Play Console / App Store Connect products exactly (see mobile/README.md, "Käufe").
 */

export const PRODUCT_IDS = {
  monthly: "lingopro_premium_monthly",
  yearly: "lingopro_premium_yearly",
  lifetime: "lingopro_premium_lifetime",
  hearts: "lingopro_hearts_pack",
  coins: "lingopro_coins_pack",
} as const;

export const COIN_PACK_AMOUNT = 1500;

export type ProductKey = keyof typeof PRODUCT_IDS;
type ConsumableKey = "hearts" | "coins";

const SUBSCRIPTIONS: ProductKey[] = ["monthly", "yearly"];
const ONE_TIME: ProductKey[] = ["lifetime", "hearts", "coins"];
const PREMIUM_KEYS: ProductKey[] = ["monthly", "yearly", "lifetime"];
const isConsumable = (key: ProductKey): key is ConsumableKey => key === "hearts" || key === "coins";

export interface ShopPackage {
  key: ProductKey;
  /** Translation key of the product title (premium.coinsPack takes {n}). */
  title: TranslationKey;
  priceString: string;
  /** Android subscriptions need the offer token of the base plan. */
  offerToken?: string;
}

export interface PurchasesState {
  available: boolean;
  ready: boolean;
  isPremium: boolean;
  /** "lifetime" | "subscription" | null */
  premiumKind: "lifetime" | "subscription" | null;
  packages: ShopPackage[];
  error: string;
}

const CACHE_KEY = "lingoPremiumCache";
const DELIVERED_KEY = "lingoDeliveredPurchases";
/** Product titles are translation keys; the screen renders them with t() so they follow the app language. */
const TITLES: Record<ProductKey, TranslationKey> = {
  monthly: "premium.monthly",
  yearly: "premium.yearly",
  lifetime: "premium.lifetimeProduct",
  hearts: "premium.heartsPack",
  coins: "premium.coinsPack",
};

let state: PurchasesState = { available: false, ready: false, isPremium: false, premiumKind: null, packages: [], error: "" };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const setState = (patch: Partial<PurchasesState>) => {
  state = { ...state, ...patch };
  emit();
};

const keyOf = (productId: string | null | undefined): ProductKey | null =>
  (Object.keys(PRODUCT_IDS) as ProductKey[]).find((key) => PRODUCT_IDS[key] === productId) ?? null;
const tokenOf = (purchase: Purchase) => purchase.purchaseToken || purchase.id;

// ---------- consumable delivery ----------

let consumableHandler: ((key: ConsumableKey) => void) | null = null;
const queuedConsumables: Purchase[] = [];
let delivered: string[] | null = null;

const loadDelivered = async () => {
  if (!delivered) delivered = await readJson<string[]>(DELIVERED_KEY, []);
  return delivered;
};

/** Grants a consumable exactly once (tokens are remembered), then consumes it in the store. */
const deliverConsumable = async (purchase: Purchase, key: ConsumableKey) => {
  if (!consumableHandler) {
    if (!queuedConsumables.some((entry) => tokenOf(entry) === tokenOf(purchase))) queuedConsumables.push(purchase);
    return;
  }
  const done = await loadDelivered();
  const token = tokenOf(purchase);
  if (!done.includes(token)) {
    consumableHandler(key);
    delivered = [...done, token].slice(-100);
    await writeJson(DELIVERED_KEY, delivered);
  }
  try {
    await finishTransaction({ purchase, isConsumable: true });
  } catch {
    // Consuming failed (offline): the store redelivers it later; the token list prevents a double grant.
  }
};

/** Registered once by the root layout: grants hearts / coins for a confirmed purchase. */
export const setConsumableHandler = (handler: ((key: ConsumableKey) => void) | null) => {
  consumableHandler = handler;
  if (!handler) return;
  const queued = queuedConsumables.splice(0);
  queued.forEach((purchase) => {
    const key = keyOf(purchase.productId);
    if (key && isConsumable(key)) void deliverConsumable(purchase, key);
  });
};

// ---------- premium state ----------

const applyOwned = (owned: Purchase[]) => {
  const active = owned.filter((purchase) => {
    const key = keyOf(purchase.productId);
    const suspended = "isSuspendedAndroid" in purchase && purchase.isSuspendedAndroid === true;
    return key !== null && PREMIUM_KEYS.includes(key) && purchase.purchaseState === "purchased" && !suspended;
  });
  const isPremium = active.length > 0;
  const premiumKind = !isPremium ? null : active.some((purchase) => keyOf(purchase.productId) === "lifetime") ? "lifetime" : "subscription";
  setState({ isPremium, premiumKind });
  void writeJson(CACHE_KEY, { isPremium, premiumKind, at: Date.now() });
};

/** Handles every purchase the store reports: delivers consumables, acknowledges premium purchases (Play needs that within 3 days). */
const handlePurchase = async (purchase: Purchase) => {
  const key = keyOf(purchase.productId);
  if (!key || purchase.purchaseState !== "purchased") return;
  if (isConsumable(key)) {
    await deliverConsumable(purchase, key);
    return;
  }
  const acknowledged = "isAcknowledgedAndroid" in purchase && purchase.isAcknowledgedAndroid === true;
  if (!acknowledged) {
    try {
      await finishTransaction({ purchase, isConsumable: false });
    } catch {
      // Retried on the next start.
    }
  }
};

const refreshOwned = async () => {
  const owned = await getAvailablePurchases();
  applyOwned(owned);
  for (const purchase of owned) await handlePurchase(purchase);
  return owned;
};

// ---------- pending purchase (one at a time) ----------

export type PurchaseOutcome = { ok: true; key: ProductKey } | { ok: false; cancelled: boolean; message: string };

let pending: { key: ProductKey; resolve: (outcome: PurchaseOutcome) => void } | null = null;
const settle = (outcome: PurchaseOutcome) => {
  const current = pending;
  pending = null;
  current?.resolve(outcome);
};

const onPurchaseUpdated = async (purchase: Purchase) => {
  const key = keyOf(purchase.productId);
  if (purchase.purchaseState === "pending") {
    if (pending && pending.key === key) settle({ ok: false, cancelled: false, message: t("premium.pending") });
    return;
  }
  await handlePurchase(purchase);
  if (key && PREMIUM_KEYS.includes(key)) {
    try {
      await refreshOwned();
    } catch {
      setState({ isPremium: true, premiumKind: key === "lifetime" ? "lifetime" : "subscription" });
    }
  }
  if (pending && pending.key === key && purchase.purchaseState === "purchased") settle({ ok: true, key });
};

const onPurchaseError = (error: { message?: string }) => {
  if (!pending) return;
  const cancelled = isUserCancelledError(error);
  settle({ ok: false, cancelled, message: cancelled ? t("premium.cancelled") : error.message || t("premium.failed") });
};

// ---------- init ----------

let initialized = false;

const offerTokenOf = (product: ProductSubscription) => {
  if (!("subscriptionOffers" in product) || !product.subscriptionOffers) return undefined;
  const offers = product.subscriptionOffers.filter((offer) => offer.offerTokenAndroid);
  // The plain base plan has a single pricing phase; prefer it over intro offers.
  offers.sort((a, b) => (a.pricingPhasesAndroid?.pricingPhaseList.length ?? 1) - (b.pricingPhasesAndroid?.pricingPhaseList.length ?? 1));
  return offers[0]?.offerTokenAndroid ?? undefined;
};

export const initPurchases = async () => {
  if (initialized) return;
  initialized = true;
  // Offline/first start: trust the last known premium state until the store answers (max 3 days).
  const cached = await readJson<{ isPremium?: boolean; premiumKind?: PurchasesState["premiumKind"]; at?: number }>(CACHE_KEY, {});
  if (cached.isPremium && typeof cached.at === "number" && Date.now() - cached.at < 3 * 86_400_000) {
    setState({ isPremium: true, premiumKind: cached.premiumKind ?? "subscription" });
  }
  if (Platform.OS === "web") {
    setState({ available: false, ready: true, error: "premium.notEnabled" });
    return;
  }
  try {
    const connected = await initConnection();
    if (connected === false) throw new Error("premium.storeUnreachable");
    purchaseUpdatedListener((purchase) => void onPurchaseUpdated(purchase));
    purchaseErrorListener(onPurchaseError);
    setState({ available: true });

    const [subs, oneTime] = await Promise.all([
      fetchProducts({ skus: SUBSCRIPTIONS.map((key) => PRODUCT_IDS[key]), type: "subs" }).catch(() => []),
      fetchProducts({ skus: ONE_TIME.map((key) => PRODUCT_IDS[key]), type: "in-app" }).catch(() => []),
    ]);
    const products = [...((subs ?? []) as (Product | ProductSubscription)[]), ...((oneTime ?? []) as (Product | ProductSubscription)[])];
    const packages: ShopPackage[] = (Object.keys(PRODUCT_IDS) as ProductKey[]).flatMap((key) => {
      const product = products.find((entry) => entry.id === PRODUCT_IDS[key]);
      if (!product) return [];
      const offerToken = product.type === "subs" ? offerTokenOf(product as ProductSubscription) : undefined;
      if (Platform.OS === "android" && product.type === "subs" && !offerToken) return [];
      return [{ key, title: TITLES[key], priceString: product.displayPrice, offerToken }];
    });
    setState({ packages, error: packages.length ? "" : "premium.noProducts" });
    await refreshOwned().catch(() => undefined);
    setState({ ready: true });
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("premium.") ? error.message : "premium.storeUnreachable";
    setState({ ready: true, error: message });
  }
};

export const purchase = async (shopPackage: ShopPackage): Promise<PurchaseOutcome> => {
  if (!state.available) return { ok: false, cancelled: false, message: t("premium.notEnabled") };
  if (pending) return { ok: false, cancelled: false, message: t("premium.failed") };
  const sku = PRODUCT_IDS[shopPackage.key];
  const result = new Promise<PurchaseOutcome>((resolve) => {
    pending = { key: shopPackage.key, resolve };
  });
  try {
    if (SUBSCRIPTIONS.includes(shopPackage.key)) {
      await requestPurchase({
        type: "subs",
        request: {
          apple: { sku },
          google: { skus: [sku], subscriptionOffers: shopPackage.offerToken ? [{ sku, offerToken: shopPackage.offerToken }] : undefined },
        },
      });
    } else {
      await requestPurchase({ type: "in-app", request: { apple: { sku }, google: { skus: [sku] } } });
    }
  } catch (error) {
    const cancelled = isUserCancelledError(error);
    settle({ ok: false, cancelled, message: cancelled ? t("premium.cancelled") : error instanceof Error ? error.message : t("premium.failed") });
  }
  return result;
};

export const restore = async () => {
  if (!state.available) return t("premium.notEnabled");
  try {
    await restorePurchases().catch(() => undefined);
    await refreshOwned();
    return state.isPremium ? t("premium.restored") : t("premium.nothingToRestore");
  } catch (error) {
    return error instanceof Error ? error.message : t("premium.restoreFailed");
  }
};

export const usePurchases = (): PurchasesState => {
  useEffect(() => {
    void initPurchases();
  }, []);
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
};
