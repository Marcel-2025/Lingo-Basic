import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";

/**
 * Small, cheap feedback effects for answers: a floating "+10 XP" label and a burst of sparkles.
 * They are keyed by a counter from the caller, so every answer replays them.
 */

export function FloatingReward({ text, trigger, color = "#fde68a" }: { text: string; trigger: number; color?: string }) {
  const progress = useSharedValue(1);
  useEffect(() => {
    if (!trigger) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [progress, trigger]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.7 ? 1 : (1 - progress.value) / 0.3,
    transform: [{ translateY: -70 * progress.value }, { scale: 0.8 + 0.4 * Math.min(1, progress.value * 3) }],
  }));
  if (!trigger) return null;
  return (
    <Animated.Text pointerEvents="none" style={[{ position: "absolute", alignSelf: "center", top: 0, fontSize: 24, fontWeight: "900", color, textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 6 }, style]}>
      {text}
    </Animated.Text>
  );
}

function Spark({ index, trigger }: { index: number; trigger: number }) {
  const seed = useMemo(() => {
    const angle = (index / 10) * Math.PI * 2 + (index % 3) * 0.3;
    return { dx: Math.cos(angle) * (60 + (index % 4) * 18), dy: Math.sin(angle) * (40 + (index % 3) * 16), size: 10 + (index % 4) * 4, delay: (index % 5) * 30, glyph: ["✦", "✧", "⭐", "✨"][index % 4] };
  }, [index]);
  const progress = useSharedValue(1);
  useEffect(() => {
    if (!trigger) return;
    progress.value = 0;
    progress.value = withDelay(seed.delay, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }));
  }, [progress, seed.delay, trigger]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateX: seed.dx * progress.value }, { translateY: seed.dy * progress.value - 20 * progress.value }, { scale: 0.4 + progress.value }],
  }));
  return <Animated.Text pointerEvents="none" style={[{ position: "absolute", fontSize: seed.size, color: "#fde68a" }, style]}>{seed.glyph}</Animated.Text>;
}

/** Sparkles flying outwards from the center of the parent (parent needs `position: relative` and overflow visible). */
export function SparkleBurst({ trigger }: { trigger: number }) {
  if (!trigger) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: "50%", top: "50%" }}>
      {Array.from({ length: 10 }, (_, index) => <Spark key={`${trigger}-${index}`} index={index} trigger={trigger} />)}
    </View>
  );
}

/** Wraps content in a quick "pop" (scale up and settle) every time `trigger` changes. */
export function Pop({ trigger, children }: { trigger: number; children: React.ReactNode }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!trigger) return;
    scale.value = withSequence(withTiming(1.08, { duration: 90 }), withSpring(1, { damping: 10, stiffness: 220 }));
  }, [scale, trigger]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
