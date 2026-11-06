import { useEffect, useMemo } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gradient } from "~/components/ui";
import { playAnswerTone, vibrate } from "~/lib/feedback";
import { useAppState } from "~/state/app-state";
import { dismissCelebration, useCelebration, type Celebration } from "~/lib/celebrations";

const COLORS = ["#f59e0b", "#ef4444", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];

/** One falling, tumbling confetti piece. Positions are precomputed so the pieces differ but stay stable per render. */
function Confetti({ index, width, height }: { index: number; width: number; height: number }) {
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
    case "quest": return { icon: "✅", title: "Aufgabe geschafft!", text: event.title, reward: `+${event.coins} Münzen` };
    case "level": return { icon: "⭐", title: `Level ${event.level}!`, text: "Du wirst immer besser.", reward: "" };
    case "goal": return { icon: "🎯", title: "Tagesziel erreicht!", text: `${event.goal} Karten heute. Stark!`, reward: "" };
    case "streak": return { icon: "🔥", title: `${event.streak} Tage in Folge!`, text: "Deine Serie wächst.", reward: event.coins ? `+${event.coins} Münzen` : "" };
    case "building": return { icon: event.icon, title: `${event.name} · Stufe ${event.level}`, text: "Deine Stadt wächst!", reward: "" };
    case "streak-chest": return { icon: "🎁", title: "Streak-Truhe geöffnet!", text: "Belohnung für deine Serie.", reward: `+${event.coins} Münzen` };
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
    <Pressable onPress={dismissCelebration} accessibilityRole="button" accessibilityLabel={`${content.title} ${content.text}. Schließen`} style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
      {Array.from({ length: pieces }, (_, index) => <Confetti key={index} index={index} width={width} height={height} />)}
      <Animated.View style={[{ width: Math.min(width - 48, 360), borderRadius: 28, overflow: "hidden" }, cardStyle]}>
        <Gradient className="items-center px-6 py-7">
          {celebration.kind === "streak" ? <Flame /> : <Text className="text-6xl">{content.icon}</Text>}
          <Text className="mt-2 text-center text-2xl font-black text-white">{content.title}</Text>
          <Text className="mt-1 text-center text-base text-white/90">{content.text}</Text>
          {content.reward ? <View className="mt-3 rounded-full bg-white/25 px-4 py-1"><Text className="text-base font-bold text-white">🪙 {content.reward}</Text></View> : null}
        </Gradient>
      </Animated.View>
    </Pressable>
  );
}

/** Compact streak badge for the header: a live flame while today's learning is done, a dimmed one before. */
export function StreakBadge({ streak, activeToday, onPress }: { streak: number; activeToday: boolean; onPress?: () => void }) {
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = activeToday && streak > 0 ? withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })), -1, true) : withTiming(0);
  }, [activeToday, glow, streak]);
  const style = useAnimatedStyle(() => ({ backgroundColor: `rgba(255,255,255,${0.15 + glow.value * 0.2})` }));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${streak} Tage Serie${activeToday ? "" : ", heute noch nicht gelernt"}`} onPress={onPress}>
      <Animated.View style={[{ flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, gap: 4 }, style]}>
        {activeToday && streak > 0 ? <Flame size={16} /> : <Text style={{ fontSize: 16, opacity: 0.6 }}>🔥</Text>}
        <Text className="text-sm font-semibold text-white">{streak}</Text>
        {!activeToday && streak > 0 ? <Text className="text-[10px] font-bold text-amber-200">heute lernen!</Text> : null}
      </Animated.View>
    </Pressable>
  );
}
