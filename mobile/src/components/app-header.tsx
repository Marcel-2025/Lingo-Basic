import { router } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gradient } from "~/components/ui";
import { useAppState } from "~/state/app-state";

const SYNC_LABELS = { loading: "lädt…", ready: "synchron", syncing: "speichert…", pending: "ausstehend", error: "Fehler", offline: "lokal" } as const;

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const { stats, user, syncStatus, syncMessage, retrySync } = useAppState();
  const accountLabel = user ? (user.displayName || user.email || user.phoneNumber || "Konto") : "Login";
  return (
    <Gradient className="rounded-b-3xl px-4 pb-4 shadow-md" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center gap-2">
        <Image source={require("../../assets/icon.png")} className="h-9 w-9 rounded-xl" accessibilityIgnoresInvertColors />
        <Text className="text-xl font-bold text-white">Lingua</Text>
      </View>
      <View className="mt-3 flex-row flex-wrap items-center gap-3">
        <Pressable accessibilityRole="button" onPress={() => router.push(user ? "/settings" : "/login")} className="max-w-[45%] rounded-lg bg-white/20 px-2 py-1 active:opacity-70">
          <Text numberOfLines={1} className="text-sm font-semibold text-white">{user ? `👤 ${accountLabel}` : "Login"}</Text>
        </Pressable>
        <Text className="text-sm font-semibold text-white">🔥 {stats.streak}</Text>
        <Text className="text-sm font-semibold text-white">⭐ {stats.xp} XP</Text>
        <View className="rounded-lg bg-white/20 px-2 py-1"><Text className="text-sm font-semibold text-white">Lvl {stats.level}</Text></View>
      </View>
      {user ? (
        <View className="mt-2 flex-row items-center justify-end gap-2" accessibilityLiveRegion="polite">
          <Text className="text-[11px] text-white/90" numberOfLines={2}>☁️ Sync {SYNC_LABELS[syncStatus]}{syncMessage ? ` · ${syncMessage}` : ""}</Text>
          {syncStatus === "pending" || syncStatus === "error" ? (
            <Pressable onPress={retrySync} className="rounded-md bg-white/25 px-2 py-0.5"><Text className="text-[11px] font-bold text-white">Erneut versuchen</Text></Pressable>
          ) : null}
        </View>
      ) : null}
    </Gradient>
  );
}
