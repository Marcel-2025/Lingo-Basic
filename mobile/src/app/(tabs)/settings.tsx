import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SUPPORTED_LANGUAGES, SUPPORTED_LEVELS } from "@/app/lib/languages";
import type { AppSettings, Difficulty, LanguageCode } from "@/app/lib/types";
import { Card, GradientButton, SelectField, SoftButton, Toggle, useScreenColors } from "~/components/ui";
import { deleteAccount, signOutEverywhere } from "~/lib/firebase";
import { clearImportedPacks, importPack, removeImportedPack } from "~/lib/packs";
import { THEMES } from "~/lib/theme";
import { useAppState } from "~/state/app-state";
import { usePackState } from "~/state/pack-state";

export default function SettingsScreen() {
  const { settings, updateSettings, user } = useAppState();
  const { source, message: packMessage, pack, reload } = usePackState();
  const colors = useScreenColors();
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(String(settings.dailyGoal));

  const set = <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => updateSettings((previous) => ({ ...previous, [key]: value }));

  const run = async (action: () => Promise<string>) => {
    setIsBusy(true);
    try {
      setMessage(await action());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Aktion fehlgeschlagen.");
    } finally {
      setIsBusy(false);
    }
  };

  const importFromFile = () => run(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
    if (result.canceled) return "";
    const asset = result.assets[0];
    let json: unknown;
    try {
      json = JSON.parse(await new File(asset.uri).text());
    } catch {
      throw new Error(`„${asset.name}“ enthält kein gültiges JSON.`);
    }
    const imported = await importPack(json);
    updateSettings((previous) => ({ ...previous, targetLang: imported.pack!.lang, contentLevel: imported.pack!.level }));
    reload();
    return `Paket ${SUPPORTED_LANGUAGES[imported.pack!.lang].label} ${imported.pack!.level} wurde geprüft und offline gespeichert.`;
  });

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Konto löschen?",
      "Dein Konto und alle in der Cloud gespeicherten Lerndaten werden dauerhaft gelöscht. Der Fortschritt auf diesem Gerät bleibt erhalten.",
      [
        { text: "Abbrechen", style: "cancel" },
        { text: "Endgültig löschen", style: "destructive", onPress: () => void run(async () => { await deleteAccount(); return "Dein Konto wurde gelöscht."; }) },
      ],
    );
  };

  const levelStatus = source === "import" ? "✓ Verfügbar · importiertes Pack" : pack ? "✓ Verfügbar · in der App enthalten" : packMessage ?? "";

  return (
    <ScrollView className={`flex-1 ${colors.screen}`} contentContainerClassName="gap-6 p-4 pb-10" keyboardShouldPersistTaps="handled">
      <Text className={`text-3xl font-bold ${colors.text}`}>Einstellungen</Text>

      <Card className="gap-4">
        <SelectField<LanguageCode>
          label="Zielsprache"
          value={settings.targetLang}
          onChange={(value) => set("targetLang", value)}
          options={(Object.keys(SUPPORTED_LANGUAGES) as LanguageCode[]).map((code) => ({ value: code, label: SUPPORTED_LANGUAGES[code].label }))}
        />
        <View>
          <SelectField label="Content-Level" value={settings.contentLevel} onChange={(value) => set("contentLevel", value)} options={SUPPORTED_LEVELS.map((level) => ({ value: level, label: level }))} />
          <Text className={`mt-2 text-xs font-semibold ${pack ? "text-gray-600" : "text-red-700"}`} accessibilityLiveRegion="polite">{levelStatus}</Text>
        </View>
        <SelectField<string>
          label="Lernmodus"
          value={String(settings.difficulty)}
          onChange={(value) => set("difficulty", value === "all" ? "all" : (Number(value) as Difficulty))}
          options={[{ value: "all", label: "Alle Schwierigkeiten" }, { value: "1", label: "Einfach" }, { value: "2", label: "Mittel" }, { value: "3", label: "Schwer" }]}
        />
        <View>
          <Text className="mb-2 text-sm font-bold text-gray-600">Tagesziel (Karten)</Text>
          <TextInput
            value={dailyGoal}
            onChangeText={setDailyGoal}
            onEndEditing={() => {
              const value = Math.min(200, Math.max(1, Number(dailyGoal) || 1));
              setDailyGoal(String(value));
              set("dailyGoal", value);
            }}
            keyboardType="number-pad"
            accessibilityLabel="Tagesziel"
            className="rounded-xl bg-gray-100 p-3 text-gray-900"
          />
        </View>
        <View>
          <Text className="mb-2 text-sm font-bold text-gray-600">Farbschema</Text>
          <View className="flex-row gap-2">
            {THEMES.map((theme) => (
              <Pressable key={theme} accessibilityRole="button" accessibilityState={{ selected: settings.theme === theme }} onPress={() => set("theme", theme)} className={`flex-1 items-center rounded-lg bg-gray-100 py-2 ${settings.theme === theme ? "border-2 border-indigo-500" : "opacity-50"}`}>
                <Text className="text-sm font-bold text-gray-900">{theme}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Toggle label="Dark Mode" value={settings.isDarkMode} onChange={(value) => set("isDarkMode", value)} />
        <Toggle label="Feedback-Töne" value={settings.soundEnabled} onChange={(value) => set("soundEnabled", value)} />
        <Toggle label="Vibration" value={settings.vibrationEnabled} onChange={(value) => set("vibrationEnabled", value)} />
      </Card>

      <Card className="gap-3">
        <Text className="text-lg font-bold text-gray-900">Inhalte verwalten</Text>
        <Text className="text-sm text-gray-600">Alle Sprachpakete sind in der App enthalten und funktionieren offline. Eigene Pakete (JSON) werden vor dem Speichern geprüft.</Text>
        <GradientButton label="Aus JSON-Datei importieren" onPress={() => void importFromFile()} disabled={isBusy} />
        {source === "import" ? <SoftButton label="Mitgeliefertes Pack wiederherstellen" disabled={isBusy} onPress={() => void run(async () => { await removeImportedPack(settings.targetLang, settings.contentLevel); reload(); return "Das mitgelieferte Pack wird wieder verwendet."; })} /> : null}
        <SoftButton label="Alle importierten Packs löschen" tone="red" disabled={isBusy} onPress={() => void run(async () => { await clearImportedPacks(); reload(); return "Alle importierten Packs wurden gelöscht."; })} />
      </Card>

      <Card className="gap-3">
        <Text className="text-lg font-bold text-gray-900">Konto</Text>
        {user ? (
          <>
            <Text className="text-sm text-gray-600">Angemeldet als {user.email || user.phoneNumber || user.displayName}. Dein Fortschritt wird mit der Cloud synchronisiert.</Text>
            <SoftButton label="Abmelden" disabled={isBusy} onPress={() => void run(async () => { await signOutEverywhere(); return "Du wurdest abgemeldet. Dein Fortschritt bleibt auf diesem Gerät gespeichert."; })} />
            <SoftButton label="Konto löschen" tone="red" disabled={isBusy} onPress={confirmDeleteAccount} />
          </>
        ) : (
          <>
            <Text className="text-sm text-gray-600">Optional: Mit einem Konto wird dein Fortschritt zwischen Geräten synchronisiert. Ohne Konto bleibt alles auf diesem Gerät.</Text>
            <GradientButton label="Anmelden oder registrieren" onPress={() => router.push("/login")} />
          </>
        )}
        <Pressable accessibilityRole="link" onPress={() => router.push("/privacy")} className="py-2"><Text className="text-center text-sm font-bold text-indigo-700">Datenschutzerklärung</Text></Pressable>
      </Card>

      {message ? <Text accessibilityLiveRegion="polite" className={`text-sm font-semibold ${settings.isDarkMode ? "text-indigo-200" : "text-indigo-700"}`}>{message}</Text> : null}
    </ScrollView>
  );
}
