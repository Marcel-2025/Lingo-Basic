import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { t } from "~/i18n";
import { readJson, writeJson } from "~/lib/storage";

/**
 * Local reminders (no server, no push tokens), 1–4 times a day. The next 7 days are scheduled as single
 * notifications and rescheduled whenever the learning state changes, so on days with the daily goal reached the
 * remaining reminders of that day are skipped. Optional evening "your streak is at risk" nudge.
 */
export interface ReminderSettings {
  enabled: boolean;
  /** Time of the main (last) reminder of the day. */
  hour: number;
  minute: number;
  streakWarning: boolean;
  timesPerDay: number;
  /** The "turn on reminders" card on the path was closed. */
  promptDismissed: boolean;
}

const KEY = "lingoReminders";
const DEFAULTS: ReminderSettings = { enabled: false, hour: 19, minute: 0, streakWarning: true, timesPerDay: 3, promptDismissed: false };
const ID_PREFIX = "lingo-reminder-";
const LEGACY_IDS = ["daily-reminder", "streak-warning"];
const CHANNEL = "lernen";
const DAYS_AHEAD = 7;

/** Earlier reminders of the day (before the main one), picked by how many reminders per day are wanted. */
const EARLY_SLOTS: Record<number, [number, number][]> = { 1: [], 2: [[12, 30]], 3: [[9, 0], [13, 0]], 4: [[9, 0], [13, 0], [16, 30]] };
const MESSAGES = {
  morning: ["reminders.morning1", "reminders.morning2"],
  day: ["reminders.day1", "reminders.day2", "reminders.m2", "reminders.m5"],
  evening: ["reminders.m1", "reminders.m3", "reminders.m4", "reminders.evening1"],
} as const;

/** Reminder times of one day as [hour, minute]; early slots must be at least 90 minutes before the main time. */
export const getReminderSlots = (settings: Pick<ReminderSettings, "hour" | "minute" | "timesPerDay">): [number, number][] => {
  const main = settings.hour * 60 + settings.minute;
  const early = (EARLY_SLOTS[Math.max(1, Math.min(4, settings.timesPerDay))] ?? []).filter(([hour, minute]) => hour * 60 + minute <= main - 90);
  return [...early, [settings.hour, settings.minute]];
};

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
    current.timesPerDay = Math.max(1, Math.min(4, Math.round(Number(current.timesPerDay) || DEFAULTS.timesPerDay)));
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
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: t("reminders.channel"), importance: Notifications.AndroidImportance.DEFAULT, sound: "default" });
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
let syncChain: Promise<void> = Promise.resolve();

/** (Re)schedules all reminders from the current settings. Safe to call often; calls are serialized and replace earlier schedules. */
export const syncReminders = (learnedToday: boolean, streak: number, goalReached = false) => {
  syncChain = syncChain.then(() => doSync(learnedToday, streak, goalReached)).catch(() => undefined);
  return syncChain;
};

const doSync = async (learnedToday: boolean, streak: number, goalReached: boolean) => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
    await Promise.all(
      scheduled
        .filter((entry) => entry.identifier.startsWith(ID_PREFIX) || LEGACY_IDS.includes(entry.identifier))
        .map((entry) => Notifications.cancelScheduledNotificationAsync(entry.identifier).catch(() => undefined)),
    );
    if (!current.enabled) return;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    const android = Platform.OS === "android" ? { channelId: CHANNEL } : {};
    const now = new Date();
    const slots = getReminderSlots(current);
    const schedule = (id: string, date: Date, title: string, body: string) =>
      Notifications.scheduleNotificationAsync({
        identifier: `${ID_PREFIX}${id}`,
        content: { title, body, sound: "default", ...android },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, ...android },
      });
    for (let day = 0; day < DAYS_AHEAD; day += 1) {
      // Today: nothing more once the daily goal is reached; after a first lesson only the evening reminder stays.
      if (day === 0 && goalReached) continue;
      for (const [slotIndex, [hour, minute]] of slots.entries()) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, hour, minute, 0);
        if (date.getTime() <= now.getTime() + 60_000) continue;
        const isMain = slotIndex === slots.length - 1;
        if (day === 0 && learnedToday && !isMain) continue;
        const group = isMain ? MESSAGES.evening : hour < 11 ? MESSAGES.morning : MESSAGES.day;
        const body = t(group[(date.getDate() + slotIndex) % group.length]);
        const title = streak > 0 && day === 0 ? t("reminders.titleStreak", { n: streak }) : "Lingo Pro";
        await schedule(`${day}-${slotIndex}`, date, title, body);
      }
    }
    if (current.streakWarning && streak > 0 && !learnedToday) {
      // One-off nudge tonight at 21:00 when the last reminder is earlier.
      const tonight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0);
      if (tonight.getTime() > now.getTime() + 60_000 && current.hour * 60 + current.minute <= 20 * 60 + 30) {
        await schedule("streak", tonight, t("reminders.streakTitle", { n: streak }), t("reminders.streakBody"));
      }
    }
  } catch {
    // Notifications are optional (e.g. web preview, missing permission).
  }
};
