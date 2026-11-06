import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { readJson, writeJson } from "~/lib/storage";

/**
 * Local daily reminders (no server, no push tokens): one at the chosen time, an optional evening
 * "your streak is at risk" nudge. Both are rescheduled whenever settings or the learning state change,
 * and the evening nudge is skipped on days you already learned.
 */
export interface ReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
  streakWarning: boolean;
}

const KEY = "lingoReminders";
const DEFAULTS: ReminderSettings = { enabled: false, hour: 19, minute: 0, streakWarning: true };
const DAILY_ID = "daily-reminder";
const STREAK_ID = "streak-warning";
const CHANNEL = "lernen";

const MESSAGES = [
  "Deine Stadt wartet auf dich. 5 Minuten reichen für heute! 🏙️",
  "Kleine Schritte, große Wirkung: Lern heute ein paar neue Wörter. 📚",
  "Die Einwohner deiner Stadt vermissen dich. Zeit für eine Lernrunde! 🦉",
  "Heute schon gelernt? Deine Serie zählt auf dich. 🔥",
  "Drei Tagesaufgaben warten – und Münzen für neue Gebäude. 🪙",
];

let current = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const load = () => {
  if (loaded) return;
  loaded = true;
  void readJson<Partial<ReminderSettings>>(KEY, {}).then((stored) => {
    current = { ...DEFAULTS, ...(stored && typeof stored === "object" ? stored : {}) };
    emit();
  });
};

export const getReminderSettings = () => current;

export const useReminderSettings = (): ReminderSettings => {
  load();
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => current,
  );
};

/** Asks for permission (iOS prompt / Android 13+ prompt). Returns true when notifications may be shown. */
export const requestReminderPermission = async () => {
  if (!Device.isDevice && Platform.OS === "ios") return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: "Lern-Erinnerungen", importance: Notifications.AndroidImportance.DEFAULT, sound: "default" });
  }
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
};

export const setReminderSettings = async (patch: Partial<ReminderSettings>) => {
  current = { ...current, ...patch };
  emit();
  await writeJson(KEY, current);
};

/** (Re)schedules both reminders from the current settings. Safe to call often; it replaces earlier schedules. */
export const syncReminders = async (learnedToday: boolean, streak: number) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => undefined);
    await Notifications.cancelScheduledNotificationAsync(STREAK_ID).catch(() => undefined);
    if (!current.enabled) return;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    const body = MESSAGES[new Date().getDate() % MESSAGES.length];
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_ID,
      content: { title: "Lingo Pro", body, sound: "default", ...(Platform.OS === "android" ? { channelId: CHANNEL } : {}) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: current.hour, minute: current.minute, ...(Platform.OS === "android" ? { channelId: CHANNEL } : {}) },
    });
    if (current.streakWarning && streak > 0 && !learnedToday) {
      // One-off nudge tonight at 21:00 if the reminder itself is earlier; next days are covered by the daily reminder.
      const now = new Date();
      const tonight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0);
      if (tonight.getTime() > now.getTime() + 60_000 && (current.hour < 21 || (current.hour === 21 && current.minute === 0))) {
        await Notifications.scheduleNotificationAsync({
          identifier: STREAK_ID,
          content: { title: `🔥 ${streak}-Tage-Serie in Gefahr`, body: "Eine Lernkarte reicht, um deine Serie zu retten.", sound: "default", ...(Platform.OS === "android" ? { channelId: CHANNEL } : {}) },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: tonight, ...(Platform.OS === "android" ? { channelId: CHANNEL } : {}) },
        });
      }
    }
  } catch {
    // Notifications are optional (e.g. web preview, missing permission).
  }
};
