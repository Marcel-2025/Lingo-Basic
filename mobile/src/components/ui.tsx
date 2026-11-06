import { LinearGradient } from "expo-linear-gradient";
import { useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { THEME_GRADIENTS } from "~/lib/theme";
import { useAppState } from "~/state/app-state";
import { useT } from "~/i18n";

/** Theme gradient (left → right), the native counterpart of `bg-gradient-to-r from-… to-…`. */
export function Gradient({ children, className, style }: { children?: ReactNode; className?: string; style?: StyleProp<ViewStyle> }) {
  const { settings } = useAppState();
  return (
    <LinearGradient colors={THEME_GRADIENTS[settings.theme]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className={className} style={style}>
      {children}
    </LinearGradient>
  );
}

export function GradientButton({ label, onPress, disabled, className }: { label: string; onPress: () => void; disabled?: boolean; className?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} className={`overflow-hidden rounded-2xl shadow-lg active:scale-[0.98] active:opacity-90 ${disabled ? "opacity-60" : ""} ${className ?? ""}`}>
      <Gradient className="items-center px-6 py-4">
        <Text className="text-base font-extrabold text-night-950">{label}</Text>
      </Gradient>
    </Pressable>
  );
}

export function SoftButton({ label, onPress, disabled, tone = "gray", className }: { label: string; onPress: () => void; disabled?: boolean; tone?: "gray" | "red" | "green"; className?: string }) {
  const tones = { gray: "bg-gray-100 dark:bg-white/10 dark:border dark:border-white/15", red: "bg-red-50 dark:bg-red-500/20 dark:border dark:border-red-300/30", green: "bg-green-100 dark:bg-mint-500/20 dark:border dark:border-mint-400/40" };
  const text = { gray: "text-gray-900 dark:text-white", red: "text-red-700 dark:text-red-200", green: "text-green-800 dark:text-mint-300" };
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} className={`items-center rounded-2xl py-4 active:opacity-70 ${tones[tone]} ${disabled ? "opacity-60" : ""} ${className ?? ""}`}>
      <Text className={`font-bold ${text[tone]}`}>{label}</Text>
    </Pressable>
  );
}

/** Small round icon button (speech, toggles). */
export function IconButton({ icon, label, onPress, active, className }: { icon: string; label: string; onPress: () => void; active?: boolean; className?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} onPress={onPress} hitSlop={6} className={`items-center justify-center rounded-full px-3 py-2 active:opacity-60 ${active ? "bg-indigo-600 dark:bg-mint-400" : "bg-indigo-50 dark:bg-white/10"} ${className ?? ""}`}>
      <Text className={`text-base ${active ? "text-white dark:text-night-950" : "text-indigo-700 dark:text-white"}`}>{icon}</Text>
    </Pressable>
  );
}

/** Pill toggle used in tool bars ("DE → EN", "Langsam", …). */
export function Chip({ label, active, onPress, accessibilityLabel }: { label: string; active?: boolean; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ selected: !!active }} onPress={onPress} className={`rounded-full border px-3 py-1.5 active:opacity-70 ${active ? "border-indigo-600 bg-indigo-600 dark:border-mint-400 dark:bg-mint-400" : "border-gray-200 bg-white dark:border-white/20 dark:bg-white/10"}`}>
      <Text className={`text-xs font-bold ${active ? "text-white dark:text-night-950" : "text-gray-700 dark:text-white"}`}>{label}</Text>
    </Pressable>
  );
}

/** Horizontal progress bar in the theme gradient. */
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View className={`h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-white/15 ${className ?? ""}`}>
      <Gradient className="h-2.5 rounded-full" style={{ width: `${pct}%` }} />
    </View>
  );
}

/** Glass card: white by day, translucent deep blue with a soft rim at night. Slides in when it appears. */
export function Card({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(420).springify().damping(18)} className={`rounded-3xl bg-white p-5 shadow-sm dark:border dark:border-white/10 dark:bg-black/30 ${className ?? ""}`}>
      {children}
    </Animated.View>
  );
}

/** Tailwind classes shared by all card-like surfaces (used where a plain View is needed). */
export const CARD = "rounded-3xl bg-white shadow-sm dark:border dark:border-white/10 dark:bg-black/30";

export function Label({ children }: { children: ReactNode }) {
  return <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-blue-200/80">{children}</Text>;
}

export function StatBox({ title, value, icon, onPress }: { title: string; value: ReactNode; icon: string; onPress?: () => void }) {
  const content = (
    <>
      <Text className="mb-2 text-3xl">{icon}</Text>
      <Text className="text-2xl font-black text-gray-900 dark:text-white">{value}</Text>
      <Text className="mt-1 text-center text-xs font-bold uppercase text-gray-500 dark:text-blue-200/80">{title}</Text>
    </>
  );
  const className = `flex-1 items-center justify-center p-4 ${CARD}`;
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} className={`${className} active:scale-95`}>{content}</Pressable>
  ) : (
    <View className={className}>{content}</View>
  );
}

export function Achievement({ name, done, subtitle }: { name: string; done: boolean; subtitle?: string }) {
  const t = useT();
  return (
    <View className={`flex-row items-center rounded-2xl p-3 ${done ? "bg-green-50 dark:bg-mint-500/15" : "opacity-40"}`} accessibilityLabel={done ? t("profile.achieved", { name }) : name}>
      <View className={`mr-4 h-12 w-12 items-center justify-center rounded-full ${done ? "bg-green-200 dark:bg-mint-400/30" : "bg-gray-200 dark:bg-white/10"}`}>
        <Text className="text-xl">{done ? "🏆" : "🔒"}</Text>
      </View>
      <View className="flex-1">
        <Text className="font-bold text-gray-900 dark:text-white">{name}</Text>
        {subtitle ? <Text className="text-xs text-gray-600 dark:text-blue-100/80">{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View className="flex-row items-center justify-between pt-2">
      <Text className="font-bold text-gray-600 dark:text-blue-100">{label}</Text>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} onPress={() => onChange(!value)} className="h-8 w-14 overflow-hidden rounded-full">
        {value ? <Gradient className="h-8 w-14 justify-center px-1"><View className="ml-6 h-6 w-6 rounded-full bg-white" /></Gradient> : <View className="h-8 w-14 justify-center bg-gray-300 px-1 dark:bg-white/20"><View className="h-6 w-6 rounded-full bg-white" /></View>}
      </Pressable>
    </View>
  );
}

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

/** Native replacement for `<select>`: a field that opens a bottom sheet with the options. */
export function SelectField<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: SelectOption<T>[]; onChange: (value: T) => void }) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const current = options.find((option) => option.value === value);
  return (
    <View>
      <Text className="mb-2 text-sm font-bold text-gray-600 dark:text-blue-100">{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${current?.label ?? ""}`} onPress={() => setIsOpen(true)} className="flex-row items-center justify-between rounded-xl bg-gray-100 p-3 active:opacity-70 dark:border dark:border-white/15 dark:bg-white/10">
        <Text className="flex-1 font-semibold text-gray-900 dark:text-white">{current?.label ?? t("common.choose")}</Text>
        <Text className="text-gray-500 dark:text-blue-200">▾</Text>
      </Pressable>
      <Modal visible={isOpen} transparent animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setIsOpen(false)} accessibilityLabel={t("common.closeSelection")} />
        <View className="max-h-[70%] w-full max-w-[560px] self-center rounded-t-3xl bg-white px-4 pt-4 dark:bg-[#0f1424]" style={{ paddingBottom: insets.bottom + 16 }}>
          <Text className="mb-3 text-lg font-bold text-gray-900 dark:text-white">{label}</Text>
          <ScrollView>
            {options.map((option) => (
              <Pressable
                key={String(option.value)}
                disabled={option.disabled}
                onPress={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`mb-2 rounded-xl p-4 ${option.value === value ? "bg-indigo-50 dark:bg-mint-500/20" : "bg-gray-50 dark:bg-white/5"} ${option.disabled ? "opacity-40" : "active:opacity-70"}`}
              >
                <Text className={`font-semibold ${option.value === value ? "text-indigo-700 dark:text-mint-300" : "text-gray-900 dark:text-white"}`}>{option.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

/** Screens are transparent over the animated sky (see ScreenBackground); these tokens pick readable text and nav colors. */
export function useScreenColors() {
  const { settings } = useAppState();
  return settings.isDarkMode
    ? { screen: "bg-transparent", text: "text-white", muted: "text-blue-100/85", nav: "bg-night-950/90" }
    : { screen: "bg-transparent", text: "text-gray-900", muted: "text-gray-600", nav: "bg-white/90" };
}
