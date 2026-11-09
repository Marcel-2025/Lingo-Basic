import { router } from "expo-router";
import { useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GradientButton, SoftButton } from "~/components/ui";
import { useT, type TranslationKey } from "~/i18n";
import { FREEZE_COIN_COST, PREMIUM_BENEFITS } from "@/app/lib/premium-benefits";
import { COIN_AMOUNTS, purchase, restore, STREAK_FREEZE_PACK, usePurchases, type ShopPackage } from "~/lib/purchases";
import { useAppState } from "~/state/app-state";
import { useCity } from "~/state/city-state";

/**
 * Paywall + shop. Subscriptions and the lifetime purchase unlock the "premium" entitlement; the two
 * consumables are granted by the purchase handler (CityProvider) once the store confirms the purchase.
 */
export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const { available, ready, isPremium, premiumKind, packages, error } = usePurchases();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const t = useT();
  const { insights } = useAppState();
  const { coins, buyFreezeWithCoins } = useCity();
  const coinAmount = (key: ShopPackage["key"]) => (key === "coinsSmall" || key === "coins" || key === "coinsLarge" ? COIN_AMOUNTS[key] : STREAK_FREEZE_PACK);
  const title = (entry: ShopPackage) => t(entry.title, { n: coinAmount(entry.key) });
  const owned = insights.streakFreezes ?? 0;

  const buy = async (shopPackage: ShopPackage) => {
    setBusy(shopPackage.key);
    setMessage("");
    const outcome = await purchase(shopPackage);
    setBusy(null);
    if (!outcome.ok) {
      setMessage(outcome.message);
      return;
    }
    // Hearts and coins are granted by the purchase handler in CityProvider (exactly once per store purchase).
    if (outcome.key === "hearts") setMessage(t("premium.heartsGranted"));
    else if (outcome.key === "coinsSmall" || outcome.key === "coins" || outcome.key === "coinsLarge") setMessage(t("premium.coinsGranted", { n: COIN_AMOUNTS[outcome.key] }));
    else if (outcome.key === "streakFreeze") setMessage(t("premium.freezeGranted", { n: STREAK_FREEZE_PACK }));
    else setMessage(t("premium.welcome"));
  };

  const subs = packages.filter((entry) => entry.key === "monthly" || entry.key === "yearly" || entry.key === "lifetime");
  const extras = packages.filter((entry) => entry.key === "hearts" || entry.key === "coinsSmall" || entry.key === "coins" || entry.key === "coinsLarge");
  const freezePack = packages.find((entry) => entry.key === "streakFreeze");
  const yearlyTrial = packages.find((entry) => entry.key === "yearly" && entry.trialDays);
  const manageUrl = Platform.OS === "ios" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions";

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, width: "100%", maxWidth: 560, alignSelf: "center" }} contentContainerClassName="gap-4 p-5">
      <View className="rounded-3xl border-2 border-mint-400/60 bg-white p-6 shadow-sm dark:shadow-none dark:bg-black/30">
        <Text className="text-3xl font-black text-gray-900 dark:text-white">💎 {isPremium ? t("premium.have") : t("premium.title")}</Text>
        <Text className="mt-1 text-base text-gray-600 dark:text-blue-100/85">{isPremium ? (premiumKind === "lifetime" ? t("premium.lifetime") : t("premium.subscribed")) : t("premium.pitch")}</Text>
      </View>

      <View className="rounded-3xl bg-white dark:border dark:border-white/10 dark:bg-black/30 p-5 shadow-sm dark:shadow-none">
        {PREMIUM_BENEFITS.map((benefit, index) => (
          <View key={benefit.title} className="mb-3 flex-row items-start gap-3">
            <Text className="text-2xl">{benefit.icon}</Text>
            <View className="flex-1">
              <Text className="font-bold text-gray-900 dark:text-white">{t(`premium.b${index + 1}` as TranslationKey)}</Text>
              <Text className="text-sm text-gray-600 dark:text-blue-100/85">{t(`premium.b${index + 1}t` as TranslationKey)}</Text>
            </View>
          </View>
        ))}
      </View>

      {!ready ? <Text className="text-center text-sm text-gray-500 dark:text-blue-200/75">{t("premium.loadingPrices")}</Text> : null}
      {ready && !available ? <Text className="rounded-2xl bg-amber-50 dark:bg-amber-400/20 p-3 text-center text-sm font-semibold text-amber-800 dark:text-amber-200">{error.startsWith("premium.") ? t(error as TranslationKey) : error}</Text> : null}

      {!isPremium && yearlyTrial ? (
        <GradientButton label={t("premium.trialCta", { n: yearlyTrial.trialDays ?? 7 })} disabled={busy !== null} onPress={() => void buy(yearlyTrial)} />
      ) : null}

      {!isPremium && subs.length > 0 ? (
        <View className="gap-3">
          {subs.map((entry) => (
            <Pressable key={entry.key} accessibilityRole="button" disabled={busy !== null} onPress={() => void buy(entry)} className={`flex-row items-center justify-between rounded-2xl border-2 bg-white dark:border dark:border-white/10 dark:bg-black/30 p-4 shadow-sm dark:shadow-none active:opacity-70 ${entry.key === "yearly" ? "border-indigo-500 dark:border-mint-400" : "border-transparent"}`}>
              <View>
                <Text className="font-bold text-gray-900 dark:text-white">{title(entry)}</Text>
                {entry.key === "yearly" ? <Text className="text-xs font-bold text-indigo-700 dark:text-mint-300">{entry.trialDays ? t("premium.trial", { n: entry.trialDays }) : t("premium.popular")}</Text> : null}
                {entry.key === "lifetime" ? <Text className="text-xs text-gray-500 dark:text-blue-200/75">{t("premium.payOnce")}</Text> : null}
              </View>
              <View className="items-end">
                {entry.trialDays ? <Text className="text-xs font-bold text-gray-500 dark:text-blue-200/75">{t("premium.trialThen")}</Text> : null}
                <Text className="text-lg font-black text-gray-900 dark:text-white">{busy === entry.key ? "…" : entry.priceString}</Text>
              </View>
            </Pressable>
          ))}
          <Text className="text-center text-[11px] text-gray-500 dark:text-blue-200/75">{t("premium.legal", { store: Platform.OS === "ios" ? "App Store" : "Play Store" })}</Text>
        </View>
      ) : null}

      {extras.length > 0 ? (
        <View className="rounded-3xl bg-white dark:border dark:border-white/10 dark:bg-black/30 p-5 shadow-sm dark:shadow-none">
          <Text className="mb-3 text-lg font-bold text-gray-900 dark:text-white">{t("premium.extras")}</Text>
          {extras.map((entry) => (
            <View key={entry.key} className="mb-2 flex-row items-center justify-between rounded-2xl bg-gray-50 dark:bg-white/5 p-3">
              <Text className="flex-1 font-semibold text-gray-900 dark:text-white">{entry.key === "hearts" ? "❤️ " : "🪙 "}{title(entry)}</Text>
              <GradientButton label={busy === entry.key ? "…" : entry.priceString} disabled={busy !== null} onPress={() => void buy(entry)} />
            </View>
          ))}
          {isPremium ? <Text className="text-xs text-gray-500 dark:text-blue-200/75">{t("premium.extrasHint")}</Text> : null}
        </View>
      ) : null}

      <View className="rounded-3xl bg-white dark:border dark:border-white/10 dark:bg-black/30 p-5 shadow-sm dark:shadow-none">
        <Text className="text-lg font-bold text-gray-900 dark:text-white">🧊 {t("premium.freezeTitle")}</Text>
        <Text className="mt-1 text-sm text-gray-600 dark:text-blue-100/85">{t("premium.freezeText", { n: owned })}</Text>
        <View className="mt-3 flex-row gap-2">
          <SoftButton className="flex-1" label={t("premium.freezeCoins", { cost: FREEZE_COIN_COST })} disabled={coins < FREEZE_COIN_COST} onPress={() => setMessage(buyFreezeWithCoins() ? t("premium.freezeBought") : t("premium.notEnoughCoins"))} />
          {freezePack ? <GradientButton className="flex-1" label={busy === freezePack.key ? "…" : `${STREAK_FREEZE_PACK}× · ${freezePack.priceString}`} disabled={busy !== null} onPress={() => void buy(freezePack)} /> : null}
        </View>
      </View>

      {message ? <Text accessibilityLiveRegion="polite" className="rounded-2xl bg-indigo-50 dark:bg-white/10 p-3 text-center text-sm font-bold text-indigo-800 dark:text-mint-300">{message}</Text> : null}

      {available ? <SoftButton label={t("premium.restore")} disabled={busy !== null} onPress={() => void (async () => { setBusy("restore"); setMessage(await restore()); setBusy(null); })()} /> : null}
      {isPremium && premiumKind === "subscription" ? <Pressable onPress={() => void Linking.openURL(manageUrl)} className="py-2"><Text className="text-center text-sm font-bold text-indigo-700 dark:text-mint-300">{t("premium.manage")}</Text></Pressable> : null}
      <Pressable onPress={() => router.push("/privacy")} className="py-1"><Text className="text-center text-xs text-gray-500 dark:text-blue-200/75">{t("settings.privacy")}</Text></Pressable>
      <Pressable onPress={() => router.back()} className="py-3"><Text className="text-center text-sm text-gray-600 dark:text-blue-100/85">{t("common.close")}</Text></Pressable>
    </ScrollView>
  );
}
