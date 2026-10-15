import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SUPPORTED_LANGUAGES } from "@/app/lib/languages";
import { getDateKey } from "@/app/lib/utils";
import { Achievement, Card, Gradient, StatBox, useScreenColors } from "~/components/ui";
import { useAppState } from "~/state/app-state";
import { usePackState } from "~/state/pack-state";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const humanizeTopicId = (topicId: string) => topicId.replace(/_\d+$/, "").replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());

export default function ProfileScreen() {
  const { stats, insights, settings } = useAppState();
  const { pack } = usePackState();
  const colors = useScreenColors();
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
  const monthLabel = calendarDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  return (
    <ScrollView className={`flex-1 ${colors.screen}`} contentContainerClassName="gap-6 p-4 pb-10">
      <View className="items-center">
        <Gradient className="mb-4 h-32 w-32 items-center justify-center rounded-full border-4 border-white" style={{ borderRadius: 64 }}>
          <Text className="text-5xl">🦉</Text>
        </Gradient>
        <Text className={`text-3xl font-bold ${colors.text}`}>Level {stats.level}</Text>
        <Text className={`mt-1 ${colors.muted}`}>Sprachmeister in Ausbildung</Text>
      </View>

      <View className="gap-4">
        <View className="flex-row gap-4">
          <StatBox title="XP Gesamt" value={stats.xp} icon="⭐" />
          <StatBox title={showCalendar ? "Kalender schließen" : "Tages-Streak · Kalender"} value={stats.streak} icon="🔥" onPress={() => setShowCalendar((value) => !value)} />
        </View>
        <View className="flex-row gap-4">
          <StatBox title="Gelernte Wörter" value={stats.learnedWords} icon="📚" />
          <StatBox title="Genauigkeit" value={`${accuracy}%`} icon="🎯" />
        </View>
      </View>

      {showCalendar ? (
        <Card>
          <View className="mb-4 flex-row items-center justify-between">
            <Pressable accessibilityLabel="Vorheriger Monat" onPress={() => setCalendarDate(new Date(year, month - 1, 1))} className="rounded-lg bg-gray-100 px-3 py-2"><Text className="text-gray-900">←</Text></Pressable>
            <Text className="font-bold capitalize text-gray-900">{monthLabel}</Text>
            <Pressable accessibilityLabel="Nächster Monat" disabled={isCurrentMonth} onPress={() => setCalendarDate(new Date(year, month + 1, 1))} className={`rounded-lg bg-gray-100 px-3 py-2 ${isCurrentMonth ? "opacity-40" : ""}`}><Text className="text-gray-900">→</Text></Pressable>
          </View>
          <View className="mb-2 flex-row">
            {WEEKDAYS.map((day) => <Text key={day} className="flex-1 text-center text-xs font-bold text-gray-500">{day}</Text>)}
          </View>
          <View className="flex-row flex-wrap">
            {cells.map((cell, index) => (
              <View key={cell?.dateKey ?? `blank-${index}`} className="w-[14.28%] p-1">
                {cell ? (
                  <View
                    accessibilityLabel={`${cell.day}. ${cell.count > 0 ? `${cell.count} Lernaktivitäten` : "keine Aktivität"}`}
                    className={`items-center rounded-lg py-2 ${cell.count > 0 ? "bg-green-100" : "bg-gray-50"} ${cell.dateKey === todayKey ? "border-2 border-indigo-400" : ""}`}
                  >
                    <Text className={`text-sm ${cell.count > 0 ? "font-bold text-green-800" : "text-gray-500"}`}>{cell.day}</Text>
                    {cell.count > 1 ? <Text className="text-[10px] font-semibold text-green-800">{cell.count}×</Text> : null}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
          <Text className="mt-4 text-xs text-gray-600">{activeDays} Lerntage · {activities} Aktivitäten in diesem Monat · {Object.keys(insights.learnedDays).length} Lerntage insgesamt</Text>
          <Pressable onPress={() => setCalendarDate(new Date())} className="mt-2"><Text className="text-xs font-bold text-indigo-700">Zum aktuellen Monat</Text></Pressable>
        </Card>
      ) : null}

      <Card>
        <Text className="mb-4 text-lg font-bold text-gray-900">Gelernte Wörter nach Themen</Text>
        {topicEntries.length === 0 ? <Text className="text-sm text-gray-600">Noch keine Wörter als gelernt markiert. Tippe bei einer Lernkarte auf „Gewusst“.</Text> : null}
        <View className="gap-4">
          {topicEntries.map(([topicId, words]) => (
            <View key={topicId}>
              <Text className="mb-2 font-bold text-gray-900">{topicNames.get(topicId) ?? humanizeTopicId(topicId)} <Text className="text-xs font-semibold text-gray-500">({words.length})</Text></Text>
              <View className="flex-row flex-wrap gap-2">
                {words.map((word) => (
                  <View key={`${word.lang ?? "legacy"}:${word.id}`} className="flex-row items-center rounded-lg bg-indigo-50 px-2 py-1">
                    <Text className="text-xs font-semibold text-indigo-800">{word.de}{word.x ? <Text className="font-normal"> · {word.x}</Text> : null}</Text>
                    {word.lang && word.lang !== pack?.lang ? <Text className="ml-1 rounded bg-white px-1 text-[10px] text-gray-600" accessibilityLabel={SUPPORTED_LANGUAGES[word.lang].label}>{word.lang}</Text> : null}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text className="mb-4 text-lg font-bold text-gray-900">Achievements</Text>
        <View className="gap-3">
          <Achievement name="Erster Schritt" done={stats.xp > 0} subtitle="Erste XP gesammelt" />
          <Achievement name="Dranbleiben" done={stats.streak >= 3} subtitle="3 Tage Streak" />
          <Achievement name="Feuer & Flamme" done={stats.streak >= 7} subtitle="7 Tage Streak" />
          <Achievement name="Treffsicher" done={stats.totalAnswers >= 20 && accuracy >= 80} subtitle="80 % Genauigkeit bei mindestens 20 Antworten" />
          <Achievement name="Wortschatz" done={stats.learnedWords >= 100} subtitle="100 Wörter gelernt" />
        </View>
      </Card>
    </ScrollView>
  );
}
