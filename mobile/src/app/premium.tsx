import { router } from "expo-router";
import { useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PREMIUM_BENEFITS } from "@/app/lib/premium-benefits";
import { Gradient, GradientButton, SoftButton } from "~/components/ui";
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
      setMessage("Herzen aufgefüllt und 10 Extra-Herzen gutgeschrieben.");
    } else if (outcome.key === "coins") {
      grantPurchasedCoins(COIN_PACK_AMOUNT);
      setMessage(`${COIN_PACK_AMOUNT} Münzen gutgeschrieben.`);
    } else {
      setMessage("Willkommen bei Premium! 🎉");
    }
  };

  const subs = packages.filter((entry) => entry.key === "monthly" || entry.key === "yearly" || entry.key === "lifetime");
  const extras = packages.filter((entry) => entry.key === "hearts" || entry.key === "coins");
  const manageUrl = Platform.OS === "ios" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions";

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, width: "100%", maxWidth: 560, alignSelf: "center" }} contentContainerClassName="gap-4 p-5">
      <Gradient className="rounded-3xl p-6">
        <Text className="text-3xl font-black text-white">{isPremium ? "Du hast Premium 💎" : "Lingo Pro Premium"}</Text>
        <Text className="mt-1 text-base text-white/90">{isPremium ? (premiumKind === "lifetime" ? "Lebenslang freigeschaltet. Danke!" : "Dein Abo ist aktiv. Danke, dass du Lingo Pro unterstützt.") : "Lerne ohne Grenzen und lass deine Stadt schneller wachsen."}</Text>
      </Gradient>

      <View className="rounded-3xl bg-white p-5 shadow-sm">
        {PREMIUM_BENEFITS.map((benefit) => (
          <View key={benefit.title} className="mb-3 flex-row items-start gap-3">
            <Text className="text-2xl">{benefit.icon}</Text>
            <View className="flex-1">
              <Text className="font-bold text-gray-900">{benefit.title}</Text>
              <Text className="text-sm text-gray-600">{benefit.text}</Text>
            </View>
          </View>
        ))}
      </View>

      {!ready ? <Text className="text-center text-sm text-gray-500">Preise werden geladen…</Text> : null}
      {ready && !available ? <Text className="rounded-2xl bg-amber-50 p-3 text-center text-sm font-semibold text-amber-800">{error}</Text> : null}

      {!isPremium && subs.length > 0 ? (
        <View className="gap-3">
          {subs.map((entry) => (
            <Pressable key={entry.key} accessibilityRole="button" disabled={busy !== null} onPress={() => void buy(entry)} className={`flex-row items-center justify-between rounded-2xl border-2 bg-white p-4 shadow-sm active:opacity-70 ${entry.key === "yearly" ? "border-indigo-500" : "border-transparent"}`}>
              <View>
                <Text className="font-bold text-gray-900">{entry.title}</Text>
                {entry.key === "yearly" ? <Text className="text-xs font-bold text-indigo-700">Beliebt · spart gegenüber monatlich</Text> : null}
                {entry.key === "lifetime" ? <Text className="text-xs text-gray-500">Einmal zahlen, für immer</Text> : null}
              </View>
              <Text className="text-lg font-black text-gray-900">{busy === entry.key ? "…" : entry.priceString}</Text>
            </Pressable>
          ))}
          <Text className="text-center text-[11px] text-gray-500">Abos verlängern sich automatisch und sind jederzeit im {Platform.OS === "ios" ? "App Store" : "Play Store"} kündbar. Der Preis wird bei Kauf in deinem Store-Konto abgerechnet.</Text>
        </View>
      ) : null}

      {extras.length > 0 ? (
        <View className="rounded-3xl bg-white p-5 shadow-sm">
          <Text className="mb-3 text-lg font-bold text-gray-900">Extras</Text>
          {extras.map((entry) => (
            <View key={entry.key} className="mb-2 flex-row items-center justify-between rounded-2xl bg-gray-50 p-3">
              <Text className="flex-1 font-semibold text-gray-900">{entry.key === "hearts" ? "❤️ " : "🪙 "}{entry.title}</Text>
              <GradientButton label={busy === entry.key ? "…" : entry.priceString} disabled={busy !== null} onPress={() => void buy(entry)} />
            </View>
          ))}
          {isPremium ? <Text className="text-xs text-gray-500">Mit Premium brauchst du keine Herzen, Münzpakete beschleunigen nur den Stadtausbau.</Text> : null}
        </View>
      ) : null}

      {message ? <Text accessibilityLiveRegion="polite" className="rounded-2xl bg-indigo-50 p-3 text-center text-sm font-bold text-indigo-800">{message}</Text> : null}

      {available ? <SoftButton label="Käufe wiederherstellen" disabled={busy !== null} onPress={() => void (async () => { setBusy("restore"); setMessage(await restore()); setBusy(null); })()} /> : null}
      {isPremium && premiumKind === "subscription" ? <Pressable onPress={() => void Linking.openURL(manageUrl)} className="py-2"><Text className="text-center text-sm font-bold text-indigo-700">Abo verwalten</Text></Pressable> : null}
      <Pressable onPress={() => router.push("/privacy")} className="py-1"><Text className="text-center text-xs text-gray-500">Datenschutzerklärung</Text></Pressable>
      <Pressable onPress={() => router.back()} className="py-3"><Text className="text-center text-sm text-gray-600">Schließen</Text></Pressable>
    </ScrollView>
  );
}
