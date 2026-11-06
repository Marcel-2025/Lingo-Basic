import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SUPPORTED_LANGUAGES, SUPPORTED_LEVELS } from "@/app/lib/languages";
import type { AppSettings, Difficulty, LanguageCode } from "@/app/lib/types";
import { Card, GradientButton, SelectField, SoftButton, Toggle, useScreenColors } from "~/components/ui";
import { clearImportedPacks, importPack, removeImportedPack } from "~/lib/packs";
import { THEMES } from "~/lib/theme";
import { requestReminderPermission, setReminderSettings, syncReminders, useReminderSettings } from "~/lib/reminders";
import { useResponsive } from "~/lib/responsive";
import { useAppState } from "~/state/app-state";
import { usePackState } from "~/state/pack-state";

export default function SettingsScreen() {
  const { settings, updateSettings, stats, insights, todayKey, exportSnapshot, importSnapshot, resetAll } = useAppState();
  const reminders = useReminderSettings();
  const { source, message: packMessage, pack, reload } = usePackState();
  const colors = useScreenColors();
  const { isWide, contentMaxWidth } = useResponsive();
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

  const importFromFile = () =>
    run(async () => {
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

  const exportBackup = () =>
    run(async () => {
      const file = new File(Paths.cache, `lingo-pro-sicherung-${todayKey()}.json`);
      file.write(JSON.stringify(exportSnapshot(), null, 2));
      if (!(await Sharing.isAvailableAsync())) return `Sicherung gespeichert unter ${file.uri}`;
      await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "Lingo-Pro-Sicherung speichern" });
      return "Sicherung erstellt. Speichere sie z. B. in deiner Cloud oder schicke sie dir selbst.";
    });

  const importBackup = () =>
    run(async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "*/*"], copyToCacheDirectory: true });
      if (result.canceled) return "";
      let json: unknown;
      try {
        json = JSON.parse(await new File(result.assets[0].uri).text());
      } catch {
        throw new Error("Die Datei enthält kein gültiges JSON.");
      }
      const outcome = importSnapshot(json);
      if (!outcome.ok) throw new Error(outcome.message);
      reload();
      return outcome.message;
    });

  const confirmReset = () => {
    Alert.alert("Alle Daten löschen?", "Fortschritt, Stadt und Einstellungen auf diesem Gerät werden dauerhaft gelöscht. Erstelle vorher eine Sicherung, wenn du sie behalten willst.", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Endgültig löschen",
        style: "destructive",
        onPress: () =>
          void run(async () => {
            await clearImportedPacks();
            resetAll();
            reload();
            return "Alle Daten wurden gelöscht.";
          }),
      },
    ]);
  };

  const levelStatus = source === "import" ? "✓ Verfügbar · importiertes Pack" : pack ? "✓ Verfügbar · in der App enthalten" : (packMessage ?? "");

  const title = <Text className={`text-3xl font-bold ${colors.text}`}>Einstellungen</Text>;
  const learningCard = (
    <Card className="gap-4">
      <SelectField<LanguageCode>
        label="Zielsprache"
        value={settings.targetLang}
        onChange={(value) => set("targetLang", value)}
        options={(Object.keys(SUPPORTED_LANGUAGES) as LanguageCode[]).map((code) => ({ value: code, label: SUPPORTED_LANGUAGES[code].label }))}
      />
      <View>
        <SelectField label="Content-Level" value={settings.contentLevel} onChange={(value) => set("contentLevel", value)} options={SUPPORTED_LEVELS.map((level) => ({ value: level, label: level }))} />
        <Text className={`mt-2 text-xs font-semibold ${pack ? "text-gray-600" : "text-red-700"}`} accessibilityLiveRegion="polite">
          {levelStatus}
        </Text>
      </View>
      <SelectField<string>
        label="Lernmodus"
        value={String(settings.difficulty)}
        onChange={(value) => set("difficulty", value === "all" ? "all" : (Number(value) as Difficulty))}
        options={[
          { value: "all", label: "Alle Schwierigkeiten" },
          { value: "1", label: "Einfach" },
          { value: "2", label: "Mittel" },
          { value: "3", label: "Schwer" },
        ]}
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
            <Pressable
              key={theme}
              accessibilityRole="button"
              accessibilityState={{ selected: settings.theme === theme }}
              onPress={() => set("theme", theme)}
              className={`flex-1 items-center rounded-lg bg-gray-100 py-2 ${settings.theme === theme ? "border-2 border-indigo-500" : "opacity-50"}`}
            >
              <Text className="text-sm font-bold text-gray-900">{theme}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Toggle label="Dark Mode" value={settings.isDarkMode} onChange={(value) => set("isDarkMode", value)} />
      <Toggle label="Feedback-Töne" value={settings.soundEnabled} onChange={(value) => set("soundEnabled", value)} />
      <Toggle label="Vibration" value={settings.vibrationEnabled} onChange={(value) => set("vibrationEnabled", value)} />
    </Card>
  );
  const learnedToday = (insights.learnedDays[todayKey()] ?? 0) > 0;
  const applyReminders = (patch: Partial<typeof reminders>) => run(async () => {
    if (patch.enabled) {
      const granted = await requestReminderPermission();
      if (!granted) return "Benachrichtigungen sind für Lingo Pro nicht erlaubt. Bitte in den Systemeinstellungen freigeben.";
    }
    await setReminderSettings(patch);
    await syncReminders(learnedToday, stats.streak);
    return patch.enabled === false ? "Erinnerungen ausgeschaltet." : "Erinnerung gespeichert.";
  });
  const reminderTime = `${String(reminders.hour).padStart(2, "0")}:${String(reminders.minute).padStart(2, "0")}`;
  const reminderCard = (
    <Card className="gap-3">
      <Text className="text-lg font-bold text-gray-900">Tägliche Erinnerung</Text>
      <Text className="text-sm text-gray-600">Eine Nachricht pro Tag zur Wunschzeit – und abends eine Warnung, wenn deine Serie in Gefahr ist. Alles lokal auf dem Gerät.</Text>
      <Toggle label="Erinnerung aktiv" value={reminders.enabled} onChange={(value) => void applyReminders({ enabled: value })} />
      <SelectField<string>
        label="Uhrzeit"
        value={reminderTime}
        onChange={(value) => { const [hour, minute] = value.split(":").map(Number); void applyReminders({ hour, minute }); }}
        options={Array.from({ length: 16 }, (_, index) => 6 + index).flatMap((hour) => ["00", "30"].map((minute) => ({ value: `${String(hour).padStart(2, "0")}:${minute}`, label: `${String(hour).padStart(2, "0")}:${minute} Uhr` })))}
      />
      <Toggle label="Serien-Warnung am Abend" value={reminders.streakWarning} onChange={(value) => void applyReminders({ streakWarning: value })} />
    </Card>
  );
  const contentCard = (
    <Card className="gap-3">
      <Text className="text-lg font-bold text-gray-900">Inhalte verwalten</Text>
      <Text className="text-sm text-gray-600">Alle Sprachpakete sind in der App enthalten und funktionieren offline. Eigene Pakete (JSON) werden vor dem Speichern geprüft.</Text>
      <GradientButton label="Aus JSON-Datei importieren" onPress={() => void importFromFile()} disabled={isBusy} />
      {source === "import" ? (
        <SoftButton
          label="Mitgeliefertes Pack wiederherstellen"
          disabled={isBusy}
          onPress={() =>
            void run(async () => {
              await removeImportedPack(settings.targetLang, settings.contentLevel);
              reload();
              return "Das mitgelieferte Pack wird wieder verwendet.";
            })
          }
        />
      ) : null}
      <SoftButton
        label="Alle importierten Packs löschen"
        tone="red"
        disabled={isBusy}
        onPress={() =>
          void run(async () => {
            await clearImportedPacks();
            reload();
            return "Alle importierten Packs wurden gelöscht.";
          })
        }
      />
    </Card>
  );
  const accountCard = (
    <Card className="gap-3">
      <Text className="text-lg font-bold text-gray-900">Deine Daten</Text>
      <Text className="text-sm text-gray-600">Lingo Pro braucht kein Konto. Dein Fortschritt bleibt auf diesem Gerät. Mit einer Sicherung nimmst du ihn auf ein neues Gerät mit.</Text>
      <GradientButton label="Sicherung erstellen (Datei teilen)" onPress={() => void exportBackup()} disabled={isBusy} />
      <SoftButton label="Sicherung wiederherstellen" disabled={isBusy} onPress={() => void importBackup()} />
      <SoftButton label="Alle Daten löschen" tone="red" disabled={isBusy} onPress={confirmReset} />
      <Pressable accessibilityRole="link" onPress={() => router.push("/privacy")} className="py-2">
        <Text className="text-center text-sm font-bold text-indigo-700">Datenschutzerklärung</Text>
      </Pressable>
    </Card>
  );
  const status = message ? (
    <Text accessibilityLiveRegion="polite" className={`text-sm font-semibold ${settings.isDarkMode ? "text-indigo-200" : "text-indigo-700"}`}>
      {message}
    </Text>
  ) : null;

  // Tablet landscape: learning settings left, content and account right.
  if (isWide) {
    return (
      <ScrollView className={`flex-1 ${colors.screen}`} contentContainerClassName="gap-6 p-6 pb-10" keyboardShouldPersistTaps="handled">
        {title}
        <View className="flex-row items-start gap-6">
          <View className="flex-1">{learningCard}</View>
          <View className="flex-1 gap-6">
            {reminderCard}
            {contentCard}
            {accountCard}
            {status}
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className={`flex-1 ${colors.screen}`} contentContainerClassName="p-4 pb-10" keyboardShouldPersistTaps="handled">
      <View className="w-full gap-6 self-center" style={{ maxWidth: contentMaxWidth }}>
        {title}
        {learningCard}
        {reminderCard}
        {contentCard}
        {accountCard}
        {status}
      </View>
    </ScrollView>
  );
}
