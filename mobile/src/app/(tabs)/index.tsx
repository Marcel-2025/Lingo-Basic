import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { isWordLearned, isWordMastered, recordLearningInInsights } from "@/app/lib/learning-history";
import { getVocabFromPack } from "@/app/lib/pack-normalization";
import { shuffle } from "@/app/lib/utils";
import type { LanguagePack, TopicItem, VocabItem } from "@/app/lib/types";
import { Card, Gradient, GradientButton, Label, SelectField, useScreenColors } from "~/components/ui";
import { speak, vibrate } from "~/lib/feedback";
import { useAppState } from "~/state/app-state";
import { usePackState } from "~/state/pack-state";

export default function TodayScreen() {
  const { activePack, isLoading, message } = usePackState();
  const colors = useScreenColors();
  if (!activePack) {
    return (
      <View className={`flex-1 items-center justify-center p-6 ${colors.screen}`}>
        <Text className={`mb-3 text-center text-2xl font-bold ${colors.text}`}>{isLoading ? "Sprachpaket wird geladen…" : "Sprachpaket nicht verfügbar"}</Text>
        {!isLoading ? <Text className={`mb-6 text-center ${colors.muted}`}>{message ?? "Für diese Auswahl gibt es noch keine Inhalte."}</Text> : null}
        {!isLoading ? <GradientButton label="Zu den Einstellungen" onPress={() => router.navigate("/settings")} /> : null}
      </View>
    );
  }
  return <Flashcards key={`${activePack.lang}:${activePack.level}:${activePack.topics.length}`} pack={activePack} />;
}

function Flashcards({ pack }: { pack: LanguagePack }) {
  const { insights, settings, updateInsights, awardAnswer, todayKey } = useAppState();
  const colors = useScreenColors();
  const allVocab = useMemo(() => getVocabFromPack(pack), [pack]);
  const [topicId, setTopicId] = useState("all");
  const activeTopic: TopicItem = topicId === "all"
    ? { id: "all", title: "Alle Themen", difficulty: 1, vocab: allVocab }
    : pack.topics.find((topic) => topic.id === topicId) ?? { id: "all", title: "Alle Themen", difficulty: 1, vocab: allVocab };
  const [queue, setQueue] = useState<VocabItem[]>(() => shuffle(allVocab));
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [isFlipped, setIsFlipped] = useState(false);
  const card = queue[index];

  const selectTopic = (nextTopicId: string) => {
    const vocab = nextTopicId === "all" ? allVocab : pack.topics.find((topic) => topic.id === nextTopicId)?.vocab ?? [];
    setTopicId(nextTopicId);
    setQueue(shuffle(vocab));
    setIndex(0);
    setRound(1);
    setIsFlipped(false);
  };

  const answer = (known: boolean) => {
    if (!card) return;
    const topic = pack.topics.find((entry) => entry.vocab.some((word) => word.id === card.id)) ?? activeTopic;
    const alreadyLearned = isWordLearned(insights, topic.id, card.id, pack.lang);
    const alreadyMastered = isWordMastered(insights, card.id, pack.lang);
    if (known) {
      updateInsights((previous) => recordLearningInInsights(previous, { topicId: topic.id, word: { id: card.id, de: card.de, x: card.x, lang: pack.lang }, mastered: true, dateKey: todayKey() }));
    } else {
      updateInsights((previous) => ({ ...previous, learnedDays: { ...previous.learnedDays, [todayKey()]: (previous.learnedDays[todayKey()] ?? 0) + 1 } }));
    }
    awardAnswer(known ? 10 : 2, known, known && !alreadyLearned ? 1 : 0, known && !alreadyMastered ? 1 : 0);
    if (settings.vibrationEnabled) vibrate(known);
    if (index + 1 >= queue.length) {
      setQueue(shuffle(activeTopic.vocab));
      setIndex(0);
      setRound((value) => value + 1);
    } else {
      setIndex(index + 1);
    }
    setIsFlipped(false);
  };

  return (
    <ScrollView className={`flex-1 ${colors.screen}`} contentContainerClassName="p-4 pb-10">
      <Card className="mb-3 p-3">
        <SelectField
          label={`Kategorie auswählen (${pack.topics.length})`}
          value={topicId}
          onChange={selectTopic}
          options={[{ value: "all", label: `🌍 Alle Themen (${allVocab.length} Wörter)` }, ...pack.topics.map((topic) => ({ value: topic.id, label: `${topic.icon ?? ""} ${topic.title} (${topic.vocab.length} Wörter)`.trim() }))]}
        />
      </Card>
      <Card className="mb-6 p-3">
        <Label>{activeTopic.title}</Label>
        <View className="flex-row flex-wrap gap-2">
          {activeTopic.vocab.map((word) => (
            <View key={word.id} className="rounded-lg bg-indigo-50 px-2 py-1"><Text className="text-xs font-semibold text-indigo-700">{word.de}</Text></View>
          ))}
        </View>
      </Card>

      {card ? (
        <>
          <View className="mb-2 flex-row justify-between">
            <Text className={`text-sm font-semibold ${colors.muted}`}>Fortschritt{round > 1 ? ` · Runde ${round}` : ""}</Text>
            <Text className={`text-sm font-semibold ${colors.muted}`}>{index + 1} / {queue.length}</Text>
          </View>
          <View className="mb-6 h-2.5 overflow-hidden rounded-full bg-gray-200">
            <Gradient className="h-2.5 rounded-full" style={{ width: `${((index + 1) / queue.length) * 100}%` }} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFlipped ? "Lernkarte mit Übersetzung" : "Lernkarte aufdecken"}
            onPress={() => setIsFlipped(true)}
            className={`min-h-[300px] items-center justify-center rounded-3xl bg-white p-8 shadow-xl ${isFlipped ? "border-2 border-indigo-200" : ""}`}
          >
            <Text className="mb-2 text-sm font-bold uppercase tracking-widest text-gray-400">Deutsch</Text>
            <Text className="mb-4 text-center text-3xl font-bold text-gray-900">{card.de}</Text>
            {isFlipped ? (
              <View className="mt-4 w-full items-center border-t border-gray-100 pt-6">
                <Text className="mb-2 text-sm font-bold uppercase tracking-widest text-indigo-400">Zielsprache</Text>
                <Text className="mb-4 text-center text-3xl font-bold text-indigo-600">{card.x}</Text>
                {card.ex ? (
                  <View className="mt-2 w-full rounded-xl bg-indigo-50 p-4">
                    <Text className="text-sm italic text-gray-900">{card.ex}</Text>
                    {card.exTr ? <Text className="mt-1 text-sm font-semibold text-gray-900">{card.exTr}</Text> : null}
                  </View>
                ) : null}
                <View className="mt-6 flex-row gap-4">
                  <Pressable accessibilityLabel={`${card.de} auf Deutsch vorlesen`} onPress={() => speak(card.de, "DE")} className="rounded-full bg-indigo-50 p-3 active:scale-110"><Text className="text-xl">🇩🇪 🔊</Text></Pressable>
                  <Pressable accessibilityLabel={`${card.x} vorlesen`} onPress={() => speak(card.x, pack.lang)} className="rounded-full bg-indigo-50 p-3 active:scale-110"><Text className="text-xl">🎯 🔊</Text></Pressable>
                </View>
              </View>
            ) : (
              <Text className="mt-10 text-gray-400">Tippe zum Aufdecken</Text>
            )}
          </Pressable>

          {isFlipped ? (
            <View className="mt-8 flex-row gap-4">
              <Pressable accessibilityRole="button" onPress={() => answer(false)} className="flex-1 items-center rounded-2xl bg-red-100 py-4 active:opacity-70"><Text className="font-bold text-red-700">Noch üben</Text></Pressable>
              <GradientButton className="flex-1" label="Gewusst" onPress={() => answer(true)} />
            </View>
          ) : null}
        </>
      ) : (
        <Text className={`mt-10 text-center ${colors.muted}`}>Für diese Auswahl stehen keine Wörter bereit. Wähle in den Einstellungen einen anderen Lernmodus.</Text>
      )}
    </ScrollView>
  );
}
