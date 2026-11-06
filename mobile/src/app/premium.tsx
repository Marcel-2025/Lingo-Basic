import { router } from "expo-router";
import { useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PREMIUM_BENEFITS } from "@/app/lib/premium-benefits";
import { Gradient, GradientButton, SoftButton } from "~/components/ui";
import { useT, type TranslationKey } from "~/i18n";
import { livesActions } from "~/lib/lives-store";
import { COIN_PACK_AMOUNT, purchase, restore, usePurchases, type ShopPackage } from "~/lib/purchases";
import { useCity } from "~/state/city-state";

/**
 * Paywall + shop. Subscriptions and the lifetime purchase unlock the "premium" entitlement; the two
 * consumables are granted locally right after the store confirms the purchase.
 */
export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const { available, ready, isPremium, premiumKind, packages, error } = usePurchases();
  const { grantPurchasedCoins } = useCity();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const t = useT();
  const title = (entry: ShopPackage) => t(entry.title, { n: COIN_PACK_AMOUNT });

  const buy = async (shopPackage: ShopPackage) => {
    setBusy(shopPackage.key);
    setMessage("");
    const outcome = await purchase(shopPackage);
    setBusy(null);
    if (!outcome.ok) {
      setMessage(outcome.message);
      return;
    }
    if (outcome.key === "hearts") {
      livesActions.addPack();
      setMessage(t("premium.heartsGranted"));
    } else if (outcome.key === "coins") {
      grantPurchasedCoins(COIN_PACK_AMOUNT);
      setMessage(t("premium.coinsGranted", { n: COIN_PACK_AMOUNT }));
    } else {
      setMessage(t("premium.welcome"));
    }
  };

  const subs = packages.filter((entry) => entry.key === "monthly" || entry.key === "yearly" || entry.key === "lifetime");
  const extras = packages.filter((entry) => entry.key === "hearts" || entry.key === "coins");
  const manageUrl = Platform.OS === "ios" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions";

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, width: "100%", maxWidth: 560, alignSelf: "center" }} contentContainerClassName="gap-4 p-5">
      <Gradient className="rounded-3xl p-6">
        <Text className="text-3xl font-black text-white">{isPremium ? t("premium.have") : t("premium.title")}</Text>
        <Text className="mt-1 text-base text-white/90">{isPremium ? (premiumKind === "lifetime" ? t("premium.lifetime") : t("premium.subscribed")) : t("premium.pitch")}</Text>
      </Gradient>

      <View className="rounded-3xl bg-white p-5 shadow-sm">
        {PREMIUM_BENEFITS.map((benefit, index) => (
          <View key={benefit.title} className="mb-3 flex-row items-start gap-3">
            <Text className="text-2xl">{benefit.icon}</Text>
            <View className="flex-1">
              <Text className="font-bold text-gray-900">{t(`premium.b${index + 1}` as TranslationKey)}</Text>
              <Text className="text-sm text-gray-600">{t(`premium.b${index + 1}t` as TranslationKey)}</Text>
            </View>
          </View>
        ))}
      </View>

      {!ready ? <Text className="text-center text-sm text-gray-500">{t("premium.loadingPrices")}</Text> : null}
      {ready && !available ? <Text className="rounded-2xl bg-amber-50 p-3 text-center text-sm font-semibold text-amber-800">{error.startsWith("premium.") ? t(error as TranslationKey) : error}</Text> : null}

      {!isPremium && subs.length > 0 ? (
        <View className="gap-3">
          {subs.map((entry) => (
            <Pressable key={entry.key} accessibilityRole="button" disabled={busy !== null} onPress={() => void buy(entry)} className={`flex-row items-center justify-between rounded-2xl border-2 bg-white p-4 shadow-sm active:opacity-70 ${entry.key === "yearly" ? "border-indigo-500" : "border-transparent"}`}>
              <View>
                <Text className="font-bold text-gray-900">{title(entry)}</Text>
                {entry.key === "yearly" ? <Text className="text-xs font-bold text-indigo-700">{t("premium.popular")}</Text> : null}
                {entry.key === "lifetime" ? <Text className="text-xs text-gray-500">{t("premium.payOnce")}</Text> : null}
              </View>
              <Text className="text-lg font-black text-gray-900">{busy === entry.key ? "…" : entry.priceString}</Text>
            </Pressable>
          ))}
          <Text className="text-center text-[11px] text-gray-500">{t("premium.legal", { store: Platform.OS === "ios" ? "App Store" : "Play Store" })}</Text>
        </View>
      ) : null}

      {extras.length > 0 ? (
        <View className="rounded-3xl bg-white p-5 shadow-sm">
          <Text className="mb-3 text-lg font-bold text-gray-900">{t("premium.extras")}</Text>
          {extras.map((entry) => (
            <View key={entry.key} className="mb-2 flex-row items-center justify-between rounded-2xl bg-gray-50 p-3">
              <Text className="flex-1 font-semibold text-gray-900">{entry.key === "hearts" ? "❤️ " : "🪙 "}{title(entry)}</Text>
              <GradientButton label={busy === entry.key ? "…" : entry.priceString} disabled={busy !== null} onPress={() => void buy(entry)} />
            </View>
          ))}
          {isPremium ? <Text className="text-xs text-gray-500">{t("premium.extrasHint")}</Text> : null}
        </View>
      ) : null}

      {message ? <Text accessibilityLiveRegion="polite" className="rounded-2xl bg-indigo-50 p-3 text-center text-sm font-bold text-indigo-800">{message}</Text> : null}

      {available ? <SoftButton label={t("premium.restore")} disabled={busy !== null} onPress={() => void (async () => { setBusy("restore"); setMessage(await restore()); setBusy(null); })()} /> : null}
      {isPremium && premiumKind === "subscription" ? <Pressable onPress={() => void Linking.openURL(manageUrl)} className="py-2"><Text className="text-center text-sm font-bold text-indigo-700">{t("premium.manage")}</Text></Pressable> : null}
      <Pressable onPress={() => router.push("/privacy")} className="py-1"><Text className="text-center text-xs text-gray-500">{t("settings.privacy")}</Text></Pressable>
      <Pressable onPress={() => router.back()} className="py-3"><Text className="text-center text-sm text-gray-600">{t("common.close")}</Text></Pressable>
    </ScrollView>
  );
}
