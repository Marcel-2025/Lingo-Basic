import { useEffect, useMemo } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  FadeInUp,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useScreenColors } from "~/components/ui";
import { t, useT } from "~/i18n";
import { playAnswerTone, vibrate } from "~/lib/feedback";
import { useAppState } from "~/state/app-state";
import { dismissCelebration, dismissToast, useCelebration, useToast, type Celebration } from "~/lib/celebrations";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const COLORS = ["#f59e0b", "#ef4444", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];

/** One falling, tumbling confetti piece. Positions are precomputed so the pieces differ but stay stable per render. */
export function Confetti({ index, width, height }: { index: number; width: number; height: number }) {
  const progress = useSharedValue(0);
  const seed = useMemo(() => ({
    x: ((index * 7919) % 100) / 100,
    drift: (((index * 104729) % 60) - 30),
    delay: (index * 37) % 400,
    rotate: ((index * 613) % 720) - 360,
    color: COLORS[index % COLORS.length],
    size: 8 + ((index * 13) % 7),
  }), [index]);
  useEffect(() => {
    progress.value = withDelay(seed.delay, withTiming(1, { duration: 1800 + (index % 5) * 200, easing: Easing.out(Easing.quad) }));
  }, [index, progress, seed.delay]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: seed.x * width + seed.drift * progress.value },
      { translateY: -40 + progress.value * (height + 80) },
      { rotate: `${seed.rotate * progress.value}deg` },
    ],
    opacity: progress.value < 0.85 ? 1 : (1 - progress.value) / 0.15,
  }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", width: seed.size, height: seed.size * 1.6, borderRadius: 2, backgroundColor: seed.color }, style]} />;
}

/** Pulsing, flickering flame used for streak moments. */
export function Flame({ size = 64 }: { size?: number }) {
  const scale = useSharedValue(1);
  const tilt = useSharedValue(0);
  useEffect(() => {
    scale.value = withRepeat(withSequence(withTiming(1.12, { duration: 320 }), withTiming(0.96, { duration: 280 })), -1, true);
    tilt.value = withRepeat(withSequence(withTiming(-6, { duration: 260 }), withTiming(6, { duration: 260 })), -1, true);
  }, [scale, tilt]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }, { rotate: `${tilt.value}deg` }] }));
  return <Animated.Text style={[{ fontSize: size, lineHeight: size * 1.25 }, style]}>🔥</Animated.Text>;
}

const describe = (event: Celebration) => {
  switch (event.kind) {
    case "quest": return { icon: "✅", title: t("celebrate.quest"), text: event.title, reward: t("celebrate.reward", { n: event.coins }) };
    case "level": return { icon: "⭐", title: t("celebrate.level", { n: event.level }), text: t("celebrate.levelText"), reward: "" };
    case "goal": return { icon: "🎯", title: t("celebrate.goal"), text: t("celebrate.goalText", { n: event.goal }), reward: "" };
    case "streak": return { icon: "🔥", title: t("celebrate.streak", { n: event.streak }), text: t("celebrate.streakText"), reward: event.coins ? t("celebrate.reward", { n: event.coins }) : "" };
    case "building": return { icon: event.icon, title: t("celebrate.building", { name: event.name, level: event.level }), text: t("celebrate.buildingText"), reward: "" };
    case "streak-chest": return { icon: "🎁", title: t("celebrate.chest"), text: t("celebrate.chestText"), reward: t("celebrate.reward", { n: event.coins }) };
  }
};

/** Full-screen celebration layer; shows the next queued event with confetti and a bouncing card. */
export function CelebrationOverlay() {
  const celebration = useCelebration();
  const { settings } = useAppState();
  const { width, height } = useWindowDimensions();
  const pop = useSharedValue(0);
  useEffect(() => {
    if (!celebration) return;
    pop.value = 0;
    pop.value = withSpring(1, { damping: 12, stiffness: 160 });
    if (settings.soundEnabled) playAnswerTone(true);
    if (settings.vibrationEnabled) vibrate(true);
    const timeout = setTimeout(dismissCelebration, 2600);
    return () => clearTimeout(timeout);
  }, [celebration, pop, settings.soundEnabled, settings.vibrationEnabled]);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.6 + 0.4 * pop.value }], opacity: pop.value }));
  if (!celebration) return null;
  const content = describe(celebration);
  const pieces = celebration.kind === "level" || celebration.kind === "goal" || celebration.kind === "building" ? 70 : 36;
  return (
    <Pressable onPress={dismissCelebration} accessibilityRole="button" accessibilityLabel={t("celebrate.dismiss", { title: content.title, text: content.text })} style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
      {Array.from({ length: pieces }, (_, index) => <Confetti key={index} index={index} width={width} height={height} />)}
      <Animated.View style={[{ width: Math.min(width - 48, 360), borderRadius: 28, overflow: "hidden" }, cardStyle]}>
        <View className="items-center border-2 border-mint-400/70 bg-[#0f1424] px-6 py-7" style={{ borderRadius: 28 }}>
          {celebration.kind === "streak" ? <Flame /> : <Text className="text-6xl">{content.icon}</Text>}
          <Text className="mt-2 text-center text-2xl font-black text-white">{content.title}</Text>
          <Text className="mt-1 text-center text-base text-blue-100">{content.text}</Text>
          {content.reward ? <View className="mt-3 rounded-full bg-mint-400 px-4 py-1"><Text className="text-base font-bold text-night-950">🪙 {content.reward}</Text></View> : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

/** Small non-blocking toast at the top for quests and the daily goal (the cards stay usable). */
export function CelebrationToast() {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { settings } = useAppState();
  useEffect(() => {
    if (!toast) return;
    if (settings.vibrationEnabled) vibrate(true);
    const timeout = setTimeout(dismissToast, 2200);
    return () => clearTimeout(timeout);
  }, [toast, settings.vibrationEnabled]);
  if (!toast) return null;
  const content = describe(toast);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: insets.top + 8, alignItems: "center" }}>
      <Animated.View key={`${content.title}-${content.text}`} entering={FadeInUp.springify().damping(14)} exiting={FadeOutUp.duration(200)} accessibilityLiveRegion="polite" style={{ maxWidth: 420, marginHorizontal: 16 }}>
        <View className="flex-row items-center gap-3 rounded-2xl border border-mint-400/60 bg-[#0f1424]/95 px-4 py-3 shadow-lg">
        <Text className="text-2xl">{content.icon}</Text>
        <View className="flex-shrink">
          <Text className="text-sm font-black text-white" numberOfLines={1}>{content.title}</Text>
          <Text className="text-xs text-blue-100" numberOfLines={1}>{content.text}</Text>
        </View>
        {content.reward ? <View className="rounded-full bg-mint-400 px-2 py-0.5"><Text className="text-xs font-bold text-night-950">🪙 {content.reward}</Text></View> : null}
      </View>
      </Animated.View>
    </View>
  );
}

/** Compact streak badge for the header: a live flame while today's learning is done, a dimmed one before. */
export function StreakBadge({ streak, activeToday, onPress }: { streak: number; activeToday: boolean; onPress?: () => void }) {
  const t = useT();
  const colors = useScreenColors();
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = activeToday && streak > 0 ? withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })), -1, true) : withTiming(0);
  }, [activeToday, glow, streak]);
  const style = useAnimatedStyle(() => ({ backgroundColor: `rgba(255,255,255,${0.1 + glow.value * 0.2})` }));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${t("header.streakLabel", { n: streak })}${activeToday ? "" : t("header.notLearnedToday")}`} onPress={onPress}>
      <Animated.View style={[{ flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, gap: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }, style]}>
        {activeToday && streak > 0 ? <Flame size={16} /> : <Text style={{ fontSize: 16, opacity: 0.6 }}>🔥</Text>}
        <Text className={`text-sm font-bold ${colors.text}`}>{streak}</Text>
        {!activeToday && streak > 0 ? <Text className="text-[10px] font-bold text-amber-500 dark:text-amber-200">{t("header.learnToday")}</Text> : null}
      </Animated.View>
    </Pressable>
  );
}
