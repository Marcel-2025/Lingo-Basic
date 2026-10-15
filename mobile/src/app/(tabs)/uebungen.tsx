import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ANSWER_LOCK_MS, createQuestion, type Question } from "@/app/lib/exercises";
import { findTopicForWord } from "@/app/lib/pack-normalization";
import { isWordLearned, recordLearningInInsights } from "@/app/lib/learning-history";
import type { LanguagePack, VocabItem } from "@/app/lib/types";
import { useScreenColors } from "~/components/ui";
import { playAnswerTone, vibrate } from "~/lib/feedback";
import { useAppState } from "~/state/app-state";
import { usePackState } from "~/state/pack-state";

export default function ExercisesScreen() {
  const { activePack, pack } = usePackState();
  const colors = useScreenColors();
  if (!activePack || !pack) {
    return <View className={`flex-1 items-center justify-center p-6 ${colors.screen}`}><Text className={`text-center ${colors.muted}`}>Kein Sprachpaket geladen.</Text></View>;
  }
  return <MultipleChoice key={`${activePack.lang}:${activePack.level}:${activePack.topics.length}`} pack={activePack} fullPack={pack} />;
}

function MultipleChoice({ pack, fullPack }: { pack: LanguagePack; fullPack: LanguagePack }) {
  const { insights, settings, updateInsights, awardAnswer, todayKey } = useAppState();
  const colors = useScreenColors();
  const [question, setQuestion] = useState<Question | null>(() => createQuestion(pack));
  const [selected, setSelected] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLocked = selected !== null;

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const onAnswer = (word: VocabItem, correct: boolean) => {
    const topic = findTopicForWord(fullPack, word.id);
    const alreadyLearned = topic ? isWordLearned(insights, topic.id, word.id, fullPack.lang) : true;
    if (correct && topic) {
      updateInsights((previous) => recordLearningInInsights(previous, { topicId: topic.id, word: { id: word.id, de: word.de, x: word.x, lang: fullPack.lang }, dateKey: todayKey() }));
    } else {
      updateInsights((previous) => ({ ...previous, learnedDays: { ...previous.learnedDays, [todayKey()]: (previous.learnedDays[todayKey()] ?? 0) + 1 } }));
    }
    awardAnswer(correct ? 15 : 0, correct, correct && !alreadyLearned ? 1 : 0, 0);
  };

  const choose = (option: string) => {
    if (!question || isLocked) return;
    const correct = option === question.word.x;
    setSelected(option);
    onAnswer(question.word, correct);
    if (settings.vibrationEnabled) vibrate(correct);
    if (settings.soundEnabled) playAnswerTone(correct);
    const previousId = question.word.id;
    timeoutRef.current = setTimeout(() => {
      setQuestion(createQuestion(pack, previousId));
      setSelected(null);
    }, ANSWER_LOCK_MS);
  };

  if (!question) {
    return <View className={`flex-1 items-center justify-center p-6 ${colors.screen}`}><Text className={`text-center ${colors.muted}`}>Dieses Pack benötigt mindestens vier unterschiedliche Vokabeln für Multiple Choice.</Text></View>;
  }
  const isCorrect = selected === question.word.x;
  const optionStyle = (option: string) => {
    if (!isLocked) return { box: "border-transparent bg-white", text: "text-gray-900" };
    if (option === question.word.x) return { box: "border-green-400 bg-green-100", text: "text-green-800" };
    if (option === selected) return { box: "border-red-400 bg-red-100", text: "text-red-800" };
    return { box: "border-transparent bg-white/70", text: "text-gray-500" };
  };

  return (
    <ScrollView className={`flex-1 ${colors.screen}`} contentContainerClassName="items-center p-4 pt-8 pb-10">
      <Text className={`mb-8 text-xl font-bold uppercase tracking-wider ${colors.muted}`}>Welches Wort passt?</Text>
      <Text className={`mb-6 text-center text-4xl font-extrabold ${colors.text}`}>{question.word.de}</Text>
      <View className="mb-6 min-h-9" accessibilityLiveRegion="assertive">
        {isLocked ? (
          <Text className={`rounded-xl px-3 py-2 text-sm font-bold ${isCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {isCorrect ? "Richtig! Stark gemacht ✅" : `Nicht ganz. Richtig ist: ${question.word.x}`}
          </Text>
        ) : null}
      </View>
      <View className="w-full max-w-md gap-4">
        {question.options.map((option) => {
          const style = optionStyle(option);
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={isLocked && option === question.word.x ? `${option} (richtige Antwort)` : option}
              disabled={isLocked}
              onPress={() => choose(option)}
              className={`items-center rounded-2xl border-2 p-5 shadow-sm active:scale-95 ${style.box}`}
            >
              <Text className={`text-lg font-semibold ${style.text}`}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text className={`mt-5 text-xs ${colors.muted}`}>Antwort-Farben: Grün = richtig, Rot = falsch</Text>
    </ScrollView>
  );
}
