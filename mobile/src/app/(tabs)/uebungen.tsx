import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { ANSWER_LOCK_MS, createQuestion, type Question } from "@/app/lib/exercises";
import { findTopicForWord } from "@/app/lib/pack-normalization";
import { isWordLearned, recordLearningInInsights } from "@/app/lib/learning-history";
import type { LanguagePack, VocabItem } from "@/app/lib/types";
import { IconButton, Label, useScreenColors } from "~/components/ui";
import { playAnswerTone, speak, vibrate } from "~/lib/feedback";
import { useLearningPrefs } from "~/lib/learning-prefs";
import { useResponsive } from "~/lib/responsive";
import { WORD_IMAGES } from "~/lib/word-images";
import { useAppState } from "~/state/app-state";
import { useCity } from "~/state/city-state";
import { usePackState } from "~/state/pack-state";

interface HistoryEntry {
  key: number;
  word: VocabItem;
  correct: boolean;
}

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
  const { recordExercise } = useCity();
  const colors = useScreenColors();
  const { isWide, isTablet } = useResponsive();
  const [prefs] = useLearningPrefs();
  const [question, setQuestion] = useState<Question | null>(() => createQuestion(pack));
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
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
    recordExercise(correct);
  };

  const choose = (option: string) => {
    if (!question || isLocked) return;
    const correct = option === question.word.x;
    setSelected(option);
    onAnswer(question.word, correct);
    setHistory((previous) => [{ key: Date.now(), word: question.word, correct }, ...previous].slice(0, 12));
    const nextStreak = correct ? streak + 1 : 0;
    setStreak(nextStreak);
    setBestStreak((best) => Math.max(best, nextStreak));
    if (settings.vibrationEnabled) vibrate(correct);
    if (settings.soundEnabled) playAnswerTone(correct);
    if (prefs.autoSpeak) setTimeout(() => speak(question.word.x, pack.lang, { slow: prefs.slowSpeech }), 250);
    const previousId = question.word.id;
    timeoutRef.current = setTimeout(() => {
      setQuestion(createQuestion(pack, previousId));
      setSelected(null);
    }, ANSWER_LOCK_MS + (prefs.autoSpeak ? 600 : 0));
  };

  if (!question) {
    return <View className={`flex-1 items-center justify-center p-6 ${colors.screen}`}><Text className={`text-center ${colors.muted}`}>Dieses Pack benötigt mindestens vier unterschiedliche Vokabeln für Multiple Choice.</Text></View>;
  }
  const isCorrect = selected === question.word.x;
  const correctCount = history.filter((entry) => entry.correct).length;
  const accuracy = history.length ? Math.round((correctCount / history.length) * 100) : 0;
  const image = prefs.showImages ? WORD_IMAGES[question.word.id] : undefined;
  const optionStyle = (option: string) => {
    if (!isLocked) return { box: "border-transparent bg-white", text: "text-gray-900" };
    if (option === question.word.x) return { box: "border-green-400 bg-green-100", text: "text-green-800" };
    if (option === selected) return { box: "border-red-400 bg-red-100", text: "text-red-800" };
    return { box: "border-transparent bg-white/70", text: "text-gray-500" };
  };

  const stats = (
    <View className="flex-row gap-3">
      <MiniStat label="Serie" value={`🔥 ${streak}`} />
      <MiniStat label="Beste" value={`🏅 ${bestStreak}`} />
      <MiniStat label="Treffer" value={history.length ? `${accuracy}%` : "–"} />
    </View>
  );

  const quiz = (
    <View className="w-full items-center self-center" style={{ maxWidth: isTablet ? 640 : undefined }}>
      <Text className={`mb-4 text-lg font-bold uppercase tracking-wider ${colors.muted}`}>Welches Wort passt?</Text>
      {image ? <Image source={image} style={{ width: 112, height: 112, borderRadius: 16, marginBottom: 16 }} accessibilityIgnoresInvertColors accessibilityLabel={`Bild zu ${question.word.de}`} /> : null}
      <View className="mb-4 flex-row items-center gap-3">
        <Text className={`text-center text-4xl font-extrabold ${colors.text}`}>{question.word.de}</Text>
        <IconButton icon="🔊" label={`${question.word.de} vorlesen`} onPress={() => speak(question.word.de, "DE")} />
      </View>
      <View className="mb-5 min-h-9 flex-row items-center gap-2" accessibilityLiveRegion="assertive">
        {isLocked ? (
          <>
            <Text className={`rounded-xl px-3 py-2 text-sm font-bold ${isCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
              {isCorrect ? "Richtig! Stark gemacht ✅" : `Nicht ganz. Richtig ist: ${question.word.x}`}
            </Text>
            <IconButton icon="🔊" label={`${question.word.x} vorlesen`} onPress={() => speak(question.word.x, pack.lang, { slow: prefs.slowSpeech })} />
          </>
        ) : null}
      </View>
      <View className={`w-full ${isTablet ? "flex-row flex-wrap justify-between gap-y-4" : "max-w-md gap-4"}`}>
        {question.options.map((option) => {
          const style = optionStyle(option);
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={isLocked && option === question.word.x ? `${option} (richtige Antwort)` : option}
              disabled={isLocked}
              onPress={() => choose(option)}
              className={`items-center justify-center rounded-2xl border-2 p-5 shadow-sm active:scale-95 ${isTablet ? "min-h-[84px] w-[48.5%]" : ""} ${style.box}`}
            >
              <Text className={`text-center text-lg font-semibold ${style.text}`}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text className={`mt-5 text-xs ${colors.muted}`}>Antwort-Farben: Grün = richtig, Rot = falsch</Text>
    </View>
  );

  const historyList = (
    <View className="rounded-3xl bg-white p-4 shadow-sm">
      <Label>Letzte Antworten</Label>
      {history.length === 0 ? <Text className="text-sm text-gray-500">Noch keine Antworten in dieser Runde.</Text> : null}
      {history.map((entry) => (
        <View key={entry.key} className="mb-1 flex-row items-center rounded-xl px-1">
          <Text className={`mr-2 w-5 text-sm ${entry.correct ? "text-green-600" : "text-red-600"}`}>{entry.correct ? "✓" : "✗"}</Text>
          <Text className="flex-1 text-sm text-gray-900" numberOfLines={1}><Text className="font-semibold">{entry.word.de}</Text><Text className="text-gray-500"> · {entry.word.x}</Text></Text>
          <Pressable accessibilityLabel={`${entry.word.x} vorlesen`} hitSlop={8} onPress={() => speak(entry.word.x, pack.lang, { slow: prefs.slowSpeech })} className="px-2 py-2 active:opacity-50"><Text>🔊</Text></Pressable>
        </View>
      ))}
    </View>
  );

  if (isWide) {
    return (
      <View className={`flex-1 flex-row ${colors.screen}`}>
        <ScrollView className="flex-1" contentContainerClassName="items-center p-6 pt-10 pb-10">{quiz}</ScrollView>
        <ScrollView style={{ width: 320, flexGrow: 0 }} contentContainerClassName="gap-4 p-4 pb-10">
          {stats}
          {historyList}
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView className={`flex-1 ${colors.screen}`} contentContainerClassName="items-center p-4 pt-6 pb-10">
      <View className="mb-6 w-full self-center" style={{ maxWidth: isTablet ? 640 : 448 }}>{stats}</View>
      {quiz}
      {isTablet ? <View className="mt-8 w-full self-center" style={{ maxWidth: 640 }}>{historyList}</View> : null}
    </ScrollView>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center rounded-2xl bg-white px-2 py-3 shadow-sm">
      <Text className="text-lg font-black text-gray-900">{value}</Text>
      <Text className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</Text>
    </View>
  );
}
