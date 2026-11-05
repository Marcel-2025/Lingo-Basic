import { Pressable, Text, View } from "react-native";
import { isWordLearned } from "@/app/lib/learning-history";
import { SUPPORTED_LANGUAGES } from "@/app/lib/languages";
import { findTopicForWord } from "@/app/lib/pack-normalization";
import type { LanguagePack, TopicItem, VocabItem } from "@/app/lib/types";
import { Label, ProgressBar } from "~/components/ui";
import { speak } from "~/lib/feedback";
import { useLearningPrefs } from "~/lib/learning-prefs";
import { useAppState } from "~/state/app-state";

export interface SessionStats {
  known: number;
  practice: number;
}

/**
 * Side panel of the "Heute" screen. On a tablet in landscape it sits left of the flashcard and can be collapsed;
 * on phones and in portrait it is shown in a collapsible card above the flashcard.
 */
export function LearnPanel({
  pack,
  activeTopic,
  allCount,
  currentWordId,
  session,
  onSelectTopic,
  onPickWord,
  showTopics,
}: {
  pack: LanguagePack;
  activeTopic: TopicItem;
  allCount: number;
  currentWordId?: string;
  session: SessionStats;
  onSelectTopic: (topicId: string) => void;
  onPickWord: (word: VocabItem) => void;
  showTopics: boolean;
}) {
  const { insights, settings, todayKey } = useAppState();
  const [prefs] = useLearningPrefs();
  const today = insights.learnedDays[todayKey()] ?? 0;
  const goal = Math.max(1, settings.dailyGoal);
  const langLabel = SUPPORTED_LANGUAGES[pack.lang].label;
  const learned = (word: VocabItem) => {
    const topic = findTopicForWord(pack, word.id);
    return topic ? isWordLearned(insights, topic.id, word.id, pack.lang) : false;
  };
  const learnedInTopic = activeTopic.vocab.filter(learned).length;

  return (
    <View className="gap-4">
      {/* Daily goal + session */}
      <View className="rounded-3xl bg-white p-4 shadow-sm">
        <Label>Tagesziel</Label>
        <View className="mb-2 flex-row items-baseline justify-between">
          <Text className="text-2xl font-black text-gray-900">{Math.min(today, goal)} <Text className="text-sm font-semibold text-gray-500">/ {goal} Karten</Text></Text>
          <Text className="text-sm font-bold text-gray-600">{today >= goal ? "Geschafft 🎉" : `noch ${goal - today}`}</Text>
        </View>
        <ProgressBar value={today / goal} />
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1 rounded-2xl bg-green-50 p-3"><Text className="text-xs font-bold text-green-800">Gewusst</Text><Text className="text-xl font-black text-green-800">{session.known}</Text></View>
          <View className="flex-1 rounded-2xl bg-red-50 p-3"><Text className="text-xs font-bold text-red-700">Noch üben</Text><Text className="text-xl font-black text-red-700">{session.practice}</Text></View>
        </View>
      </View>

      {showTopics ? (
        <View className="rounded-3xl bg-white p-4 shadow-sm">
          <Label>Themen</Label>
          <TopicRow icon="🌍" title="Alle Themen" count={allCount} active={activeTopic.id === "all"} onPress={() => onSelectTopic("all")} />
          {pack.topics.map((topic) => (
            <TopicRow key={topic.id} icon={topic.icon ?? "📘"} title={topic.title} count={topic.vocab.length} active={activeTopic.id === topic.id} onPress={() => onSelectTopic(topic.id)} />
          ))}
        </View>
      ) : null}

      {/* Word list with translation, pronunciation and "learn this word next" */}
      <View className="rounded-3xl bg-white p-4 shadow-sm">
        <View className="mb-2 flex-row items-center justify-between">
          <Label>{activeTopic.title}</Label>
          <Text className="mb-2 text-xs font-bold text-gray-500">{learnedInTopic}/{activeTopic.vocab.length} gelernt</Text>
        </View>
        <Text className="mb-3 text-xs text-gray-500">Tippe ein Wort, um es als Nächstes zu lernen.</Text>
        {activeTopic.vocab.map((word) => {
          const isCurrent = word.id === currentWordId;
          const done = learned(word);
          return (
            <View key={word.id} className={`mb-1 flex-row items-center rounded-xl px-2 ${isCurrent ? "bg-indigo-50" : ""}`}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${word.de}, ${langLabel}: ${word.x}. Als Nächstes lernen`} onPress={() => onPickWord(word)} className="flex-1 flex-row items-center py-2 active:opacity-60">
                <Text className={`mr-2 w-4 text-xs ${done ? "text-green-600" : "text-gray-300"}`}>{done ? "✓" : "•"}</Text>
                <Text className="flex-1 text-sm text-gray-900" numberOfLines={1}>
                  <Text className="font-semibold">{word.de}</Text>
                  <Text className="text-gray-500"> · {word.x}</Text>
                </Text>
              </Pressable>
              <Pressable accessibilityLabel={`${word.x} vorlesen`} hitSlop={8} onPress={() => speak(word.x, pack.lang, { slow: prefs.slowSpeech })} className="px-2 py-2 active:opacity-50">
                <Text className="text-base">🔊</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {pack.sentences.length > 0 ? (
        <View className="rounded-3xl bg-white p-4 shadow-sm">
          <Label>Beispielsätze</Label>
          {pack.sentences.map((sentence) => {
            const translation = sentence.translations[pack.lang.toLowerCase()] ?? sentence.x;
            return (
              <View key={sentence.id} className="mb-3 rounded-2xl bg-gray-50 p-3">
                <Text className="text-sm font-semibold text-gray-900">{translation}</Text>
                <Text className="mt-1 text-xs text-gray-600">{sentence.de}</Text>
                {translation ? (
                  <View className="mt-2 flex-row gap-2">
                    <Pressable accessibilityLabel="Satz vorlesen" onPress={() => speak(translation, pack.lang)} className="rounded-full bg-indigo-50 px-3 py-1 active:opacity-60"><Text className="text-xs font-bold text-indigo-700">🔊 Anhören</Text></Pressable>
                    <Pressable accessibilityLabel="Satz langsam vorlesen" onPress={() => speak(translation, pack.lang, { slow: true })} className="rounded-full bg-indigo-50 px-3 py-1 active:opacity-60"><Text className="text-xs font-bold text-indigo-700">🐢 Langsam</Text></Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function TopicRow({ icon, title, count, active, onPress }: { icon: string; title: string; count: number; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} className={`mb-1 flex-row items-center rounded-xl px-3 py-2 active:opacity-60 ${active ? "bg-indigo-600" : ""}`}>
      <Text className="mr-2 text-base">{icon}</Text>
      <Text className={`flex-1 text-sm font-semibold ${active ? "text-white" : "text-gray-900"}`} numberOfLines={1}>{title}</Text>
      <Text className={`text-xs font-bold ${active ? "text-white/80" : "text-gray-500"}`}>{count}</Text>
    </Pressable>
  );
}
