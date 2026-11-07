import { router } from "expo-router";
import { useEffect } from "react";
import { Image, Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, Easing } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StreakBadge } from "~/components/celebration";
import { useScreenColors } from "~/components/ui";
import { useT } from "~/i18n";
import { useResponsive } from "~/lib/responsive";
import { useAppState } from "~/state/app-state";
import { useCity } from "~/state/city-state";

/** The owl mascot, bobbing gently like it is hovering over its book. */
function Owl({ size }: { size: number }) {
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(withSequence(withTiming(-3, { duration: 1600, easing: Easing.inOut(Easing.sin) }), withTiming(3, { duration: 1600, easing: Easing.inOut(Easing.sin) })), -1, true);
  }, [bob]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));
  return (
    <Animated.View style={style}>
      <Image source={require("../../assets/icon.png")} style={{ width: size, height: size, borderRadius: size * 0.3 }} accessibilityIgnoresInvertColors />
    </Animated.View>
  );
}

/** "Lingo" wordmark with the mint "Pro" badge from the store artwork. */
export function Wordmark({ size = 22 }: { size?: number }) {
  const colors = useScreenColors();
  return (
    <View className="flex-row items-center gap-1.5">
      <Text className={`font-black ${colors.text}`} style={{ fontSize: size, letterSpacing: -0.5 }}>Lingo</Text>
      <View className="rounded-lg bg-mint-400 px-1.5 py-0.5 shadow-sm dark:shadow-none"><Text className="font-black text-night-950" style={{ fontSize: size * 0.72 }}>Pro</Text></View>
    </View>
  );
}

function StatChip({ icon, value, label, onPress }: { icon: string; value: string | number; label?: string; onPress?: () => void }) {
  const colors = useScreenColors();
  const content = (
    <View className="flex-row items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 dark:bg-white/10">
      <Text className="text-sm">{icon}</Text>
      <Text className={`text-sm font-bold ${colors.text}`}>{value}</Text>
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className="active:opacity-70">{content}</Pressable> : content;
}

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const { stats, todayKey } = useAppState();
  const activeToday = stats.lastActiveDate === todayKey();
  const { isWide } = useResponsive();
  const { coins } = useCity();
  const t = useT();

  const chips = (
    <>
      <StreakBadge streak={stats.streak} activeToday={activeToday} onPress={() => router.navigate("/stadt")} />
      <StatChip icon="⭐" value={`${stats.xp} XP`} />
      <StatChip icon="🪙" value={coins} label={t("header.coinsToCity", { n: coins })} onPress={() => router.navigate("/stadt")} />
      <StatChip icon="🏅" value={t("common.lvl", { n: stats.level })} />
    </>
  );

  // Tablet landscape: one compact row (the owl already sits in the navigation rail).
  if (isWide) {
    return (
      <View className="flex-row items-center gap-3 px-6 pb-3" style={{ paddingTop: insets.top + 10, paddingRight: insets.right + 24 }}>
        <View className="mr-auto"><Wordmark size={24} /></View>
        {chips}
      </View>
    );
  }

  return (
    <View className="px-4 pb-3" style={{ paddingTop: insets.top + 10 }}>
      <View className="flex-row items-center gap-3">
        <Owl size={46} />
        <Wordmark size={26} />
      </View>
      <View className="mt-3 flex-row flex-wrap items-center gap-2">{chips}</View>
    </View>
  );
}
