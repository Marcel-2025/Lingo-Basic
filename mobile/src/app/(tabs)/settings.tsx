import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { getDefaultTargetFor, getLearnableLanguages, SUPPORTED_LANGUAGES, SUPPORTED_LEVELS } from "@/app/lib/languages";
import type { AppSettings, Difficulty, LanguageCode } from "@/app/lib/types";
import { Card, GradientButton, SelectField, SoftButton, Toggle, useScreenColors } from "~/components/ui";
import { useT, type TranslationKey } from "~/i18n";
import { clearImportedPacks, importPack, removeImportedPack } from "~/lib/packs";
import { LinearGradient } from "expo-linear-gradient";
import { SKIES, SKY_NAMES, THEME_GRADIENTS, THEMES } from "~/lib/theme";
import { getReminderSlots, requestReminderPermission, setReminderSettings, syncReminders, useReminderSettings } from "~/lib/reminders";
import { useResponsive } from "~/lib/responsive";
import { useAppState } from "~/state/app-state";
import { usePackState } from "~/state/pack-state";

export default function SettingsScreen() {
  const { settings, updateSettings, stats, insights, todayKey, exportSnapshot, importSnapshot, resetAll, isPremium } = useAppState();
  const reminders = useReminderSettings();
  const { source, message: packMessage, pack, reload } = usePackState();
  const colors = useScreenColors();
  const t = useT();
  const { isWide, contentMaxWidth } = useResponsive();
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(String(settings.dailyGoal));

  const set = <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => updateSettings((previous) => ({ ...previous, [key]: value }));
  /** Changing the app language also changes the base language, so a target equal to it gets swapped. */
  const setUiLang = (uiLang: LanguageCode) => updateSettings((previous) => ({ ...previous, uiLang, targetLang: previous.targetLang === uiLang ? getDefaultTargetFor(uiLang) : previous.targetLang }));

  const run = async (action: () => Promise<string>) => {
    setIsBusy(true);
    try {
      setMessage(await action());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.actionFailed"));
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
        throw new Error(t("settings.invalidJsonFile", { name: asset.name }));
      }
      const imported = await importPack(json);
      // Imported packs are German-based, so the app switches to German as base language.
      updateSettings((previous) => ({ ...previous, uiLang: "DE", targetLang: imported.pack!.lang, contentLevel: imported.pack!.level }));
      reload();
      return t("settings.packImported", { language: t(`languages.${imported.pack!.lang}`), level: imported.pack!.level });
    });

  const exportBackup = () =>
    run(async () => {
      const file = new File(Paths.cache, `lingo-pro-sicherung-${todayKey()}.json`);
      file.write(JSON.stringify(exportSnapshot(), null, 2));
      if (!(await Sharing.isAvailableAsync())) return t("settings.backupSavedAt", { path: file.uri });
      await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: t("settings.backupDialog") });
      return t("settings.backupDone");
    });

  const importBackup = () =>
    run(async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "*/*"], copyToCacheDirectory: true });
      if (result.canceled) return "";
      let json: unknown;
      try {
        json = JSON.parse(await new File(result.assets[0].uri).text());
      } catch {
        throw new Error(t("settings.invalidJson"));
      }
      const outcome = importSnapshot(json);
      if (!outcome.ok) throw new Error(outcome.message);
      reload();
      return outcome.message;
    });

  const confirmReset = () => {
    Alert.alert(t("settings.deleteTitle"), t("settings.deleteText"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.deleteConfirm"),
        style: "destructive",
        onPress: () =>
          void run(async () => {
            await clearImportedPacks();
            resetAll();
            reload();
            return t("settings.deleted");
          }),
      },
    ]);
  };

  const levelStatus = source === "import" ? t("settings.availableImport") : pack ? t("settings.available") : packMessage === "packs.unavailable" ? t("packs.unavailable") : (packMessage ?? "");

  const title = <Text className={`text-3xl font-bold ${colors.text}`}>{t("settings.title")}</Text>;
  const learningCard = (
    <Card className="gap-4">
      <View>
        <SelectField<LanguageCode>
          label={t("settings.appLanguage")}
          value={settings.uiLang}
          onChange={setUiLang}
          options={(Object.keys(SUPPORTED_LANGUAGES) as LanguageCode[]).map((code) => ({ value: code, label: `${t(`languages.${code}`)} · ${SUPPORTED_LANGUAGES[code].label}` }))}
        />
        <Text className="mt-2 text-xs text-gray-600 dark:text-blue-100/85">{t("settings.appLanguageHint")}</Text>
      </View>
      <SelectField<LanguageCode>
        label={t("settings.targetLanguage")}
        value={settings.targetLang}
        onChange={(value) => set("targetLang", value)}
        options={getLearnableLanguages(settings.uiLang).map((code) => ({ value: code, label: t(`languages.${code}`) }))}
      />
      <View>
        <SelectField label={t("settings.contentLevel")} value={settings.contentLevel} onChange={(value) => set("contentLevel", value)} options={SUPPORTED_LEVELS.map((level) => ({ value: level, label: level }))} />
        <Text className={`mt-2 text-xs font-semibold ${pack ? "text-gray-600 dark:text-blue-100/85" : "text-red-700 dark:text-red-200"}`} accessibilityLiveRegion="polite">
          {levelStatus}
        </Text>
      </View>
      <SelectField<string>
        label={t("settings.mode")}
        value={String(settings.difficulty)}
        onChange={(value) => set("difficulty", value === "all" ? "all" : (Number(value) as Difficulty))}
        options={[
          { value: "all", label: t("settings.allDifficulties") },
          { value: "1", label: t("settings.easy") },
          { value: "2", label: t("settings.medium") },
          { value: "3", label: t("settings.hard") },
        ]}
      />
      <View>
        <Text className="mb-2 text-sm font-bold text-gray-600 dark:text-blue-100/85">{t("settings.dailyGoal")}</Text>
        <TextInput
          value={dailyGoal}
          onChangeText={setDailyGoal}
          onEndEditing={() => {
            const value = Math.min(200, Math.max(1, Number(dailyGoal) || 1));
            setDailyGoal(String(value));
            set("dailyGoal", value);
          }}
          keyboardType="number-pad"
          accessibilityLabel={t("settings.dailyGoalLabel")}
          className="rounded-xl bg-gray-100 dark:bg-white/10 p-3 text-gray-900 dark:text-white"
        />
      </View>
      <View>
        <Text className="mb-2 text-sm font-bold text-gray-600 dark:text-blue-100/85">{t("settings.theme")}</Text>
        <View className="flex-row flex-wrap gap-3">
          {THEMES.map((theme) => (
            <Pressable
              key={theme}
              accessibilityRole="button"
              accessibilityLabel={theme}
              accessibilityState={{ selected: settings.theme === theme }}
              onPress={() => set("theme", theme)}
              className={`items-center gap-1 active:opacity-70 ${settings.theme === theme ? "" : "opacity-70"}`}
            >
              <LinearGradient colors={[...THEME_GRADIENTS[theme]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: settings.theme === theme ? "#ffffff" : "transparent" }} />
              <Text className="text-[11px] font-bold text-gray-700 dark:text-blue-100">{theme}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View>
        <Text className="mb-2 text-sm font-bold text-gray-600 dark:text-blue-100/85">{t("settings.sky")}</Text>
        <View className="flex-row flex-wrap gap-3">
          {SKY_NAMES.map((sky) => (
            <Pressable
              key={sky}
              accessibilityRole="button"
              accessibilityLabel={t(`settings.skies.${sky}` as TranslationKey)}
              accessibilityState={{ selected: settings.sky === sky }}
              onPress={() => set("sky", sky)}
              className={`items-center gap-1 active:opacity-70 ${settings.sky === sky ? "" : "opacity-70"}`}
            >
              <LinearGradient colors={[...(settings.isDarkMode ? SKIES[sky].night : SKIES[sky].day)]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: settings.sky === sky ? "#ffffff" : "rgba(255,255,255,0.25)" }} />
              <Text className="text-[11px] font-bold text-gray-700 dark:text-blue-100">{t(`settings.skies.${sky}` as TranslationKey)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Toggle label={t("settings.darkMode")} value={settings.isDarkMode} onChange={(value) => set("isDarkMode", value)} />
      <Toggle label={t("settings.music")} value={settings.musicEnabled} onChange={(value) => set("musicEnabled", value)} />
      <Toggle label={t("settings.sounds")} value={settings.soundEnabled} onChange={(value) => set("soundEnabled", value)} />
      <Toggle label={t("settings.vibration")} value={settings.vibrationEnabled} onChange={(value) => set("vibrationEnabled", value)} />
    </Card>
  );
  const learnedToday = (insights.learnedDays[todayKey()] ?? 0) > 0;
  const applyReminders = (patch: Partial<typeof reminders>) => run(async () => {
    if (patch.enabled) {
      const granted = await requestReminderPermission();
      if (!granted) return t("settings.notAllowed");
    }
    await setReminderSettings(patch);
    await syncReminders(learnedToday, stats.streak, (insights.learnedDays[todayKey()] ?? 0) >= Math.max(1, settings.dailyGoal));
    return patch.enabled === false ? t("settings.remindersOff") : t("settings.reminderSaved");
  });
  const reminderTime = `${String(reminders.hour).padStart(2, "0")}:${String(reminders.minute).padStart(2, "0")}`;
  const reminderCard = (
    <Card className="gap-3">
      <Text className="text-lg font-bold text-gray-900 dark:text-white">{t("settings.reminderTitle")}</Text>
      <Text className="text-sm text-gray-600 dark:text-blue-100/85">{t("settings.reminderText")}</Text>
      <Toggle label={t("settings.reminderOn")} value={reminders.enabled} onChange={(value) => void applyReminders({ enabled: value })} />
      <SelectField<string>
        label={t("settings.mainTime")}
        value={reminderTime}
        onChange={(value) => { const [hour, minute] = value.split(":").map(Number); void applyReminders({ hour, minute }); }}
        options={Array.from({ length: 16 }, (_, index) => 6 + index).flatMap((hour) => ["00", "30"].map((minute) => ({ value: `${String(hour).padStart(2, "0")}:${minute}`, label: t("settings.timeFormat", { time: `${String(hour).padStart(2, "0")}:${minute}` }) })))}
      />
      <SelectField<number>
        label={t("settings.timesPerDay")}
        value={reminders.timesPerDay}
        onChange={(value) => void applyReminders({ timesPerDay: value })}
        options={[1, 2, 3, 4].map((n) => ({ value: n, label: t("settings.timesOption", { n, times: getReminderSlots({ ...reminders, timesPerDay: n }).map(([h, m]) => `${h}:${String(m).padStart(2, "0")}`).join(" · ") }) }))}
      />
      <Toggle label={t("settings.streakWarning")} value={reminders.streakWarning} onChange={(value) => void applyReminders({ streakWarning: value })} />
    </Card>
  );
  const contentCard = (
    <Card className="gap-3">
      <Text className="text-lg font-bold text-gray-900 dark:text-white">{t("settings.contentTitle")}</Text>
      <Text className="text-sm text-gray-600 dark:text-blue-100/85">{t("settings.contentText")}</Text>
      <GradientButton label={t("settings.importJson")} onPress={() => void importFromFile()} disabled={isBusy} />
      {source === "import" ? (
        <SoftButton
          label={t("settings.restoreBundled")}
          disabled={isBusy}
          onPress={() =>
            void run(async () => {
              await removeImportedPack(settings.targetLang, settings.contentLevel);
              reload();
              return t("settings.restoredBundled");
            })
          }
        />
      ) : null}
      <SoftButton
        label={t("settings.deleteImported")}
        tone="red"
        disabled={isBusy}
        onPress={() =>
          void run(async () => {
            await clearImportedPacks();
            reload();
            return t("settings.deletedImported");
          })
        }
      />
    </Card>
  );
  const premiumCard = (
    <Card className="gap-3">
      <Text className="text-lg font-bold text-gray-900 dark:text-white">{isPremium ? t("settings.premiumActive") : t("settings.premium")}</Text>
      <Text className="text-sm text-gray-600 dark:text-blue-100/85">{isPremium ? t("settings.premiumActiveText") : t("settings.premiumText")}</Text>
      <GradientButton label={isPremium ? t("settings.managePremium") : t("settings.viewPremium")} onPress={() => router.push("/premium")} />
    </Card>
  );
  const accountCard = (
    <Card className="gap-3">
      <Text className="text-lg font-bold text-gray-900 dark:text-white">{t("settings.dataTitle")}</Text>
      <Text className="text-sm text-gray-600 dark:text-blue-100/85">{t("settings.dataText")}</Text>
      <GradientButton label={t("settings.backup")} onPress={() => void exportBackup()} disabled={isBusy} />
      <SoftButton label={t("settings.restore")} disabled={isBusy} onPress={() => void importBackup()} />
      <SoftButton label={t("settings.deleteAll")} tone="red" disabled={isBusy} onPress={confirmReset} />
      <Pressable accessibilityRole="link" onPress={() => router.push("/privacy")} className="py-2">
        <Text className="text-center text-sm font-bold text-indigo-700 dark:text-mint-300">{t("settings.privacy")}</Text>
      </Pressable>
    </Card>
  );
  const status = message ? (
    <Text accessibilityLiveRegion="polite" className={`text-sm font-semibold ${settings.isDarkMode ? "text-indigo-200" : "text-indigo-700 dark:text-mint-300"}`}>
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
            {premiumCard}
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
        {premiumCard}
        {reminderCard}
        {contentCard}
        {accountCard}
        {status}
      </View>
    </ScrollView>
  );
}
