import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { getDateKey } from "@/app/lib/utils";
import { Achievement, Card, Gradient, StatBox, useScreenColors } from "~/components/ui";
import { LOCALES, useT } from "~/i18n";
import { useResponsive } from "~/lib/responsive";
import { useAppState } from "~/state/app-state";
import { usePackState } from "~/state/pack-state";

const humanizeTopicId = (topicId: string) =>
  topicId
    .replace(/_\d+$/, "")
    .replace(/_/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());

export default function ProfileScreen() {
  const { stats, insights, settings } = useAppState();
  const { pack } = usePackState();
  const colors = useScreenColors();
  const t = useT();
  const WEEKDAYS = t("profile.weekdays").split(",");
  const { isWide, isTablet, contentMaxWidth } = useResponsive();
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => new Date());

  const accuracy = stats.totalAnswers === 0 ? 0 : Math.round((stats.correctAnswers / stats.totalAnswers) * 100);
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();
  const todayKey = getDateKey(new Date(), settings.timeZone);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const cells = Array.from({ length: firstWeekday + totalDays }, (_, index) => {
    if (index < firstWeekday) return null;
    const day = index - firstWeekday + 1;
    const dateKey = `${monthPrefix}${String(day).padStart(2, "0")}`;
    return { day, dateKey, count: insights.learnedDays[dateKey] ?? 0 };
  });
  const activeDays = cells.filter((cell) => cell && cell.count > 0).length;
  const activities = cells.reduce((sum, cell) => sum + (cell?.count ?? 0), 0);
  const isCurrentMonth = todayKey.startsWith(monthPrefix);
  const topicNames = new Map(pack?.topics.map((topic) => [topic.id, `${topic.icon ? `${topic.icon} ` : ""}${topic.title}`]) ?? []);
  const topicEntries = Object.entries(insights.learnedWordsByTopic).filter(([, words]) => words.length > 0);
  const monthLabel = calendarDate.toLocaleDateString(LOCALES[settings.uiLang], { month: "long", year: "numeric" });

  const statBoxes = [
    <StatBox key="xp" title={t("profile.xpTotal")} value={stats.xp} icon="⭐" />,
    <StatBox
      key="streak"
      title={isWide ? t("profile.streak") : showCalendar ? t("profile.closeCalendar") : t("profile.streakCalendar")}
      value={stats.streak}
      icon="🔥"
      onPress={isWide ? undefined : () => setShowCalendar((value) => !value)}
    />,
    <StatBox key="words" title={t("profile.learnedWords")} value={stats.learnedWords} icon="📚" />,
    <StatBox key="acc" title={t("profile.accuracy")} value={`${accuracy}%`} icon="🎯" />,
  ];
  const calendar = (
    <Card>
      <View className="mb-4 flex-row items-center justify-between">
        <Pressable accessibilityLabel={t("profile.prevMonth")} onPress={() => setCalendarDate(new Date(year, month - 1, 1))} className="rounded-lg bg-gray-100 dark:bg-white/10 px-3 py-2">
          <Text className="text-gray-900 dark:text-white">←</Text>
        </Pressable>
        <Text className="font-bold capitalize text-gray-900 dark:text-white">{monthLabel}</Text>
        <Pressable
          accessibilityLabel={t("profile.nextMonth")}
          disabled={isCurrentMonth}
          onPress={() => setCalendarDate(new Date(year, month + 1, 1))}
          className={`rounded-lg bg-gray-100 dark:bg-white/10 px-3 py-2 ${isCurrentMonth ? "opacity-40" : ""}`}
        >
          <Text className="text-gray-900 dark:text-white">→</Text>
        </Pressable>
      </View>
      <View className="mb-2 flex-row">
        {WEEKDAYS.map((day) => (
          <Text key={day} className="flex-1 text-center text-xs font-bold text-gray-500 dark:text-blue-200/75">
            {day}
          </Text>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {cells.map((cell, index) => (
          <View key={cell?.dateKey ?? `blank-${index}`} className="w-[14.28%] p-1">
            {cell ? (
              <View
                accessibilityLabel={cell.count > 0 ? t("profile.dayActivities", { day: cell.day, n: cell.count }) : t("profile.dayNone", { day: cell.day })}
                className={`items-center rounded-lg py-2 ${cell.count > 0 ? "bg-green-100 dark:bg-mint-500/25" : "bg-gray-50 dark:bg-white/5"} ${cell.dateKey === todayKey ? "border-2 border-indigo-400 dark:border-mint-400" : ""}`}
              >
                <Text className={`text-sm ${cell.count > 0 ? "font-bold text-green-800 dark:text-mint-300" : "text-gray-500 dark:text-blue-200/75"}`}>{cell.day}</Text>
                {cell.count > 1 ? <Text className="text-[10px] font-semibold text-green-800 dark:text-mint-300">{cell.count}×</Text> : null}
              </View>
            ) : null}
          </View>
        ))}
      </View>
      <Text className="mt-4 text-xs text-gray-600 dark:text-blue-100/85">
        {t("profile.monthSummary", { active: activeDays, activities, total: Object.keys(insights.learnedDays).length })}
      </Text>
      <Pressable onPress={() => setCalendarDate(new Date())} className="mt-2">
        <Text className="text-xs font-bold text-indigo-700 dark:text-mint-300">{t("profile.toCurrentMonth")}</Text>
      </Pressable>
    </Card>
  );
  const learnedWords = (
    <Card>
      <Text className="mb-4 text-lg font-bold text-gray-900 dark:text-white">{t("profile.byTopic")}</Text>
      {topicEntries.length === 0 ? <Text className="text-sm text-gray-600 dark:text-blue-100/85">{t("profile.noneYet")}</Text> : null}
      <View className="gap-4">
        {topicEntries.map(([topicId, words]) => (
          <View key={topicId}>
            <Text className="mb-2 font-bold text-gray-900 dark:text-white">
              {topicNames.get(topicId) ?? humanizeTopicId(topicId)} <Text className="text-xs font-semibold text-gray-500 dark:text-blue-200/75">({words.length})</Text>
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {words.map((word) => (
                <View key={`${word.lang ?? "legacy"}:${word.id}`} className="flex-row items-center rounded-lg bg-indigo-50 dark:bg-white/10 px-2 py-1">
                  <Text className="text-xs font-semibold text-indigo-800 dark:text-mint-300">
                    {word.de}
                    {word.x ? <Text className="font-normal"> · {word.x}</Text> : null}
                  </Text>
                  {word.lang && word.lang !== pack?.lang ? (
                    <Text className="ml-1 rounded bg-white dark:border dark:border-white/10 dark:bg-night-card/85 px-1 text-[10px] text-gray-600 dark:text-blue-100/85" accessibilityLabel={t(`languages.${word.lang}`)}>
                      {word.lang}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
  const achievements = (
    <Card>
      <Text className="mb-4 text-lg font-bold text-gray-900 dark:text-white">{t("profile.achievements")}</Text>
      <View className="gap-3">
        <Achievement name={t("profile.a1")} done={stats.xp > 0} subtitle={t("profile.a1t")} />
        <Achievement name={t("profile.a2")} done={stats.streak >= 3} subtitle={t("profile.a2t")} />
        <Achievement name={t("profile.a3")} done={stats.streak >= 7} subtitle={t("profile.a3t")} />
        <Achievement name={t("profile.a4")} done={stats.totalAnswers >= 20 && accuracy >= 80} subtitle={t("profile.a4t")} />
        <Achievement name={t("profile.a5")} done={stats.learnedWords >= 100} subtitle={t("profile.a5t")} />
      </View>
    </Card>
  );

  // Tablet landscape: overview row on top, then calendar + achievements next to the learned words.
  if (isWide) {
    return (
      <ScrollView className={`flex-1 ${colors.screen}`} contentContainerClassName="gap-6 p-6 pb-10">
        <View className="flex-row items-center gap-6">
          <Gradient className="h-24 w-24 items-center justify-center rounded-full border-4 border-white" style={{ borderRadius: 48 }}>
            <Text className="text-4xl">🦉</Text>
          </Gradient>
          <View className="mr-4">
            <Text className={`text-3xl font-bold ${colors.text}`}>{t("common.level")} {stats.level}</Text>
            <Text className={`mt-1 ${colors.muted}`}>{t("profile.rank")}</Text>
          </View>
          <View className="flex-1 flex-row gap-4">{statBoxes}</View>
        </View>
        <View className="flex-row items-start gap-6">
          <View className="flex-1 gap-6">
            {calendar}
            {achievements}
          </View>
          <View className="flex-1">{learnedWords}</View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className={`flex-1 ${colors.screen}`} contentContainerClassName="p-4 pb-10">
      <View className="w-full gap-6 self-center" style={{ maxWidth: contentMaxWidth }}>
        <View className="items-center">
          <Gradient className="mb-4 h-32 w-32 items-center justify-center rounded-full border-4 border-white" style={{ borderRadius: 64 }}>
            <Text className="text-5xl">🦉</Text>
          </Gradient>
          <Text className={`text-3xl font-bold ${colors.text}`}>{t("common.level")} {stats.level}</Text>
          <Text className={`mt-1 ${colors.muted}`}>{t("profile.rank")}</Text>
        </View>
        {isTablet ? (
          <View className="flex-row gap-4">{statBoxes}</View>
        ) : (
          <View className="gap-4">
            <View className="flex-row gap-4">{statBoxes.slice(0, 2)}</View>
            <View className="flex-row gap-4">{statBoxes.slice(2)}</View>
          </View>
        )}
        {showCalendar ? calendar : null}
        {learnedWords}
        {achievements}
      </View>
    </ScrollView>
  );
}
