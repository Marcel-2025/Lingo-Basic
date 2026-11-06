import Constants from "expo-constants";
import { useEffect, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesPackage } from "react-native-purchases";
import { readJson, writeJson } from "~/lib/storage";
import { t, type TranslationKey } from "~/i18n";

/**
 * In-app purchases via RevenueCat (Google Play Billing on Android, StoreKit on iOS).
 * Product and entitlement identifiers must match RevenueCat + the store consoles (see mobile/README.md, "Käufe").
 *
 * - Entitlement "premium": monthly / yearly subscription or the lifetime one-time purchase.
 * - Consumables: heart pack and coin pack. They are granted locally right after a successful purchase.
 *
 * Without SDK keys (app.json → extra.revenueCat) the module runs in "unavailable" mode: nothing crashes,
 * the shop shows a note, premium stays off.
 */

export const ENTITLEMENT_PREMIUM = "premium";

export const PRODUCT_IDS = {
  monthly: "lingopro_premium_monthly",
  yearly: "lingopro_premium_yearly",
  lifetime: "lingopro_premium_lifetime",
  hearts: "lingopro_hearts_pack",
  coins: "lingopro_coins_pack",
} as const;

export const COIN_PACK_AMOUNT = 1500;

export type ProductKey = keyof typeof PRODUCT_IDS;

export interface ShopPackage {
  key: ProductKey;
  /** Translation key of the product title (premium.coinsPack takes {n}). */
  title: TranslationKey;
  priceString: string;
  pkg: PurchasesPackage;
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
let configured = false;

const readKeys = () => {
  const extra = (Constants.expoConfig?.extra ?? {}) as { revenueCat?: { android?: string; ios?: string } };
  return Platform.OS === "ios" ? extra.revenueCat?.ios : extra.revenueCat?.android;
};

const applyCustomerInfo = (info: CustomerInfo) => {
  const entitlement = info.entitlements.active[ENTITLEMENT_PREMIUM];
  const isPremium = !!entitlement;
  const premiumKind = !entitlement ? null : entitlement.productIdentifier.includes("lifetime") ? "lifetime" : "subscription";
  setState({ isPremium, premiumKind });
  void writeJson(CACHE_KEY, { isPremium, premiumKind, at: Date.now() });
};

const keyOf = (pkg: PurchasesPackage): ProductKey | null => {
  const id = pkg.product.identifier.split(":")[0];
  return (Object.keys(PRODUCT_IDS) as ProductKey[]).find((key) => PRODUCT_IDS[key] === id) ?? null;
};

export const initPurchases = async () => {
  if (configured) return;
  configured = true;
  // Offline/first start: trust the last known premium state until the store answers (max 3 days).
  const cached = await readJson<{ isPremium?: boolean; premiumKind?: PurchasesState["premiumKind"]; at?: number }>(CACHE_KEY, {});
  if (cached.isPremium && typeof cached.at === "number" && Date.now() - cached.at < 3 * 86_400_000) {
    setState({ isPremium: true, premiumKind: cached.premiumKind ?? "subscription" });
  }
  const apiKey = readKeys();
  if (!apiKey || Platform.OS === "web") {
    setState({ available: false, ready: true, error: "premium.notEnabled" });
    return;
  }
  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
    Purchases.configure({ apiKey });
    Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
    setState({ available: true });
    const [info, offerings] = await Promise.all([Purchases.getCustomerInfo(), Purchases.getOfferings()]);
    applyCustomerInfo(info);
    const packages: ShopPackage[] = (offerings.current?.availablePackages ?? [])
      .map((pkg) => ({ key: keyOf(pkg), pkg }))
      .filter((entry): entry is { key: ProductKey; pkg: PurchasesPackage } => entry.key !== null)
      .map(({ key, pkg }) => ({ key, pkg, title: TITLES[key], priceString: pkg.product.priceString }));
    setState({ ready: true, packages, error: packages.length ? "" : "premium.noProducts" });
  } catch (error) {
    setState({ ready: true, error: error instanceof Error ? error.message : "premium.storeUnreachable" });
  }
};

export type PurchaseOutcome = { ok: true; key: ProductKey } | { ok: false; cancelled: boolean; message: string };

export const purchase = async (shopPackage: ShopPackage): Promise<PurchaseOutcome> => {
  try {
    const result = await Purchases.purchasePackage(shopPackage.pkg);
    applyCustomerInfo(result.customerInfo);
    return { ok: true, key: shopPackage.key };
  } catch (error) {
    const code = typeof error === "object" && error && "userCancelled" in error ? Boolean((error as { userCancelled: unknown }).userCancelled) : false;
    return { ok: false, cancelled: code, message: code ? t("premium.cancelled") : error instanceof Error ? error.message : t("premium.failed") };
  }
};

export const restore = async () => {
  try {
    const info = await Purchases.restorePurchases();
    applyCustomerInfo(info);
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
