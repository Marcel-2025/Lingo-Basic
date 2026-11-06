import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useAppState } from "~/state/app-state";

/**
 * The app's sky: a deep night-blue gradient with soft clouds and twinkling stars (dark mode, the default look),
 * or a light day sky. Rendered once behind the whole tab navigator, so every screen stays transparent.
 */

const NIGHT = ["#050d2b", "#0b1f63", "#1443b5", "#1b5bd6"] as const;
const DAY = ["#bfdbfe", "#dbeafe", "#eff6ff", "#f8fbff"] as const;

function Star({ index, width, height, night }: { index: number; width: number; height: number; night: boolean }) {
  const seed = useMemo(() => ({
    x: ((index * 7919) % 97) / 97,
    y: ((index * 104729) % 89) / 89 * 0.75,
    size: 6 + ((index * 13) % 9),
    delay: (index * 331) % 2400,
    duration: 1400 + ((index * 97) % 1200),
  }), [index]);
  const glow = useSharedValue(0.25);
  useEffect(() => {
    glow.value = withDelay(seed.delay, withRepeat(withSequence(withTiming(1, { duration: seed.duration, easing: Easing.inOut(Easing.quad) }), withTiming(0.2, { duration: seed.duration })), -1, true));
  }, [glow, seed.delay, seed.duration]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.7 + glow.value * 0.5 }] }));
  return (
    <Animated.Text
      pointerEvents="none"
      style={[{ position: "absolute", left: seed.x * width, top: seed.y * height, fontSize: seed.size, color: night ? "#fde68a" : "#ffffff", lineHeight: seed.size * 1.2 }, style]}
    >
      ✦
    </Animated.Text>
  );
}

/** A slow-drifting translucent blob that reads as a cloud. */
function Cloud({ index, width, height, night }: { index: number; width: number; height: number; night: boolean }) {
  const seed = useMemo(() => ({
    x: ((index * 61) % 100) / 100,
    y: 0.45 + (((index * 37) % 50) / 100),
    w: 160 + ((index * 53) % 220),
    h: 70 + ((index * 29) % 60),
    drift: 18 + ((index * 17) % 30),
    duration: 9000 + ((index * 811) % 7000),
  }), [index]);
  const shift = useSharedValue(0);
  useEffect(() => {
    shift.value = withRepeat(withSequence(withTiming(1, { duration: seed.duration, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: seed.duration, easing: Easing.inOut(Easing.sin) })), -1, true);
  }, [seed.duration, shift]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: (shift.value - 0.5) * seed.drift }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{
        position: "absolute",
        left: seed.x * width - seed.w / 2,
        top: seed.y * height,
        width: seed.w,
        height: seed.h,
        borderRadius: seed.h,
        backgroundColor: night ? "rgba(120, 170, 255, 0.14)" : "rgba(255,255,255,0.75)",
      }, style]}
    />
  );
}

export function ScreenBackground() {
  const { settings } = useAppState();
  const night = settings.isDarkMode;
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={night ? [...NIGHT] : [...DAY]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      {Array.from({ length: 5 }, (_, index) => <Cloud key={`cloud-${index}`} index={index} width={width} height={height} night={night} />)}
      {Array.from({ length: night ? 10 : 0 }, (_, index) => <Star key={`star-${index}`} index={index} width={width} height={height} night={night} />)}
    </View>
  );
}
