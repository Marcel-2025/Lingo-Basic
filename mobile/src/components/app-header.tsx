import { router } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StreakBadge } from "~/components/celebration";
import { Gradient } from "~/components/ui";
import { useT } from "~/i18n";
import { useResponsive } from "~/lib/responsive";
import { useAppState } from "~/state/app-state";
import { useCity } from "~/state/city-state";

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const { stats, todayKey } = useAppState();
  const activeToday = stats.lastActiveDate === todayKey();
  const { isWide } = useResponsive();
  const { coins } = useCity();
  const t = useT();

  // Tablet landscape: one compact row (the logo already sits in the navigation rail) to keep height for learning.
  if (isWide) {
    return (
      <Gradient className="flex-row items-center gap-4 rounded-bl-3xl px-6 pb-3 shadow-md" style={{ paddingTop: insets.top + 10, paddingRight: insets.right + 24 }}>
        <Text className="mr-auto text-xl font-bold text-white">Lingo Pro</Text>
        <StreakBadge streak={stats.streak} activeToday={activeToday} onPress={() => router.navigate("/stadt")} />
        <Text className="text-sm font-semibold text-white">⭐ {stats.xp} XP</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("header.coinsToCity", { n: coins })} onPress={() => router.navigate("/stadt")}><Text className="text-sm font-semibold text-white">🪙 {coins}</Text></Pressable>
        <View className="rounded-lg bg-white/20 px-2 py-1"><Text className="text-sm font-semibold text-white">{t("common.lvl", { n: stats.level })}</Text></View>
      </Gradient>
    );
  }

  return (
    <Gradient className="rounded-b-3xl px-4 pb-4 shadow-md" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center gap-2">
        <Image source={require("../../assets/icon.png")} style={{ width: 36, height: 36, borderRadius: 12 }} accessibilityIgnoresInvertColors />
        <Text className="text-xl font-bold text-white">Lingo Pro</Text>
      </View>
      <View className="mt-3 flex-row flex-wrap items-center gap-3">
        <StreakBadge streak={stats.streak} activeToday={activeToday} onPress={() => router.navigate("/stadt")} />
        <Text className="text-sm font-semibold text-white">⭐ {stats.xp} XP</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("header.coinsToCity", { n: coins })} onPress={() => router.navigate("/stadt")}><Text className="text-sm font-semibold text-white">🪙 {coins}</Text></Pressable>
        <View className="rounded-lg bg-white/20 px-2 py-1"><Text className="text-sm font-semibold text-white">{t("common.lvl", { n: stats.level })}</Text></View>
      </View>
    </Gradient>
  );
}
