import { LinearGradient } from "expo-linear-gradient";
import { useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { THEME_GRADIENTS } from "~/lib/theme";
import { useAppState } from "~/state/app-state";

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
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} className={`overflow-hidden rounded-2xl active:opacity-80 ${disabled ? "opacity-60" : ""} ${className ?? ""}`}>
      <Gradient className="items-center px-6 py-4">
        <Text className="text-base font-bold text-white">{label}</Text>
      </Gradient>
    </Pressable>
  );
}

export function SoftButton({ label, onPress, disabled, tone = "gray", className }: { label: string; onPress: () => void; disabled?: boolean; tone?: "gray" | "red" | "green"; className?: string }) {
  const tones = { gray: "bg-gray-100", red: "bg-red-50", green: "bg-green-100" };
  const text = { gray: "text-gray-900", red: "text-red-700", green: "text-green-800" };
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} className={`items-center rounded-2xl py-4 active:opacity-70 ${tones[tone]} ${disabled ? "opacity-60" : ""} ${className ?? ""}`}>
      <Text className={`font-bold ${text[tone]}`}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-3xl bg-white p-5 shadow-sm ${className ?? ""}`}>{children}</View>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">{children}</Text>;
}

export function StatBox({ title, value, icon, onPress }: { title: string; value: ReactNode; icon: string; onPress?: () => void }) {
  const content = (
    <>
      <Text className="mb-2 text-3xl">{icon}</Text>
      <Text className="text-2xl font-black text-gray-900">{value}</Text>
      <Text className="mt-1 text-center text-xs font-bold uppercase text-gray-500">{title}</Text>
    </>
  );
  const className = "flex-1 items-center justify-center rounded-3xl bg-white p-4 shadow-sm";
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} className={`${className} active:scale-95`}>{content}</Pressable>
  ) : (
    <View className={className}>{content}</View>
  );
}

export function Achievement({ name, done, subtitle }: { name: string; done: boolean; subtitle?: string }) {
  return (
    <View className={`flex-row items-center rounded-2xl p-3 ${done ? "bg-green-50" : "opacity-40"}`} accessibilityLabel={`${name}${done ? " (erreicht)" : ""}`}>
      <View className={`mr-4 h-12 w-12 items-center justify-center rounded-full ${done ? "bg-green-200" : "bg-gray-200"}`}>
        <Text className="text-xl">{done ? "🏆" : "🔒"}</Text>
      </View>
      <View className="flex-1">
        <Text className="font-bold text-gray-900">{name}</Text>
        {subtitle ? <Text className="text-xs text-gray-600">{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View className="flex-row items-center justify-between pt-2">
      <Text className="font-bold text-gray-600">{label}</Text>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} onPress={() => onChange(!value)} className="h-8 w-14 overflow-hidden rounded-full">
        {value ? <Gradient className="h-8 w-14 justify-center px-1"><View className="ml-6 h-6 w-6 rounded-full bg-white" /></Gradient> : <View className="h-8 w-14 justify-center bg-gray-300 px-1"><View className="h-6 w-6 rounded-full bg-white" /></View>}
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
  const [isOpen, setIsOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const current = options.find((option) => option.value === value);
  return (
    <View>
      <Text className="mb-2 text-sm font-bold text-gray-600">{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${current?.label ?? ""}`} onPress={() => setIsOpen(true)} className="flex-row items-center justify-between rounded-xl bg-gray-100 p-3 active:opacity-70">
        <Text className="flex-1 font-semibold text-gray-900">{current?.label ?? "Bitte wählen"}</Text>
        <Text className="text-gray-500">▾</Text>
      </Pressable>
      <Modal visible={isOpen} transparent animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setIsOpen(false)} accessibilityLabel="Auswahl schließen" />
        <View className="max-h-[70%] rounded-t-3xl bg-white px-4 pt-4" style={{ paddingBottom: insets.bottom + 16 }}>
          <Text className="mb-3 text-lg font-bold text-gray-900">{label}</Text>
          <ScrollView>
            {options.map((option) => (
              <Pressable
                key={String(option.value)}
                disabled={option.disabled}
                onPress={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`mb-2 rounded-xl p-4 ${option.value === value ? "bg-indigo-50" : "bg-gray-50"} ${option.disabled ? "opacity-40" : "active:opacity-70"}`}
              >
                <Text className={`font-semibold ${option.value === value ? "text-indigo-700" : "text-gray-900"}`}>{option.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

/** Background of every screen: light gray, or dark in dark mode (cards stay light for contrast). */
export function useScreenColors() {
  const { settings } = useAppState();
  return settings.isDarkMode
    ? { screen: "bg-gray-900", text: "text-white", muted: "text-gray-300", nav: "bg-gray-800" }
    : { screen: "bg-gray-50", text: "text-gray-900", muted: "text-gray-600", nav: "bg-white" };
}
