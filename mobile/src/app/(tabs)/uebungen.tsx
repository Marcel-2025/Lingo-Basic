import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { ANSWER_LOCK_MS, createQuestion, type Question } from "@/app/lib/exercises";
import { formatCountdown, MAX_LIVES, REFILL_COIN_COST } from "@/app/lib/lives";
import { findTopicForWord } from "@/app/lib/pack-normalization";
import { isWordLearned, recordLearningInInsights } from "@/app/lib/learning-history";
import type { LanguagePack, VocabItem } from "@/app/lib/types";
import { FloatingReward, Pop, SparkleBurst } from "~/components/effects";
import { GradientButton, IconButton, Label, SoftButton, useScreenColors } from "~/components/ui";
import { useT } from "~/i18n";
import { playAnswerTone, speak, vibrate } from "~/lib/feedback";
import { useLearningPrefs } from "~/lib/learning-prefs";
import { livesActions, useLives } from "~/lib/lives-store";
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
  const t = useT();
  if (!activePack || !pack) {
    return <View className={`flex-1 items-center justify-center p-6 ${colors.screen}`}><Text className={`text-center ${colors.muted}`}>{t("packs.none")}</Text></View>;
  }
  return <MultipleChoice key={`${activePack.lang}:${activePack.level}:${activePack.topics.length}`} pack={activePack} fullPack={pack} />;
}

function MultipleChoice({ pack, fullPack }: { pack: LanguagePack; fullPack: LanguagePack }) {
  const { insights, settings, updateInsights, awardAnswer, todayKey, isPremium } = useAppState();
  const { recordExercise, refillLivesWithCoins, coins } = useCity();
  const { lives, extra, msUntilNext } = useLives();
  const outOfLives = !isPremium && lives === 0 && extra === 0;
  const colors = useScreenColors();
  const t = useT();
  const { isWide, isTablet } = useResponsive();
  const [prefs] = useLearningPrefs();
  const [question, setQuestion] = useState<Question | null>(() => createQuestion(pack));
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [reward, setReward] = useState({ trigger: 0, correct: false });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLocked = selected !== null;

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  // Auto pronunciation: each new question is read in the learner's own language; the answer follows in the target language.
  useEffect(() => {
    if (!question || !prefs.autoSpeak || outOfLives) return;
    const timer = setTimeout(() => speak(question.word.de, settings.uiLang), 200);
    return () => clearTimeout(timer);
  }, [question, prefs.autoSpeak, outOfLives, settings.uiLang]);

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
    if (!question || isLocked || outOfLives) return;
    const correct = option === question.word.x;
    setSelected(option);
    if (!correct) livesActions.lose(isPremium);
    onAnswer(question.word, correct);
    setHistory((previous) => [{ key: Date.now(), word: question.word, correct }, ...previous].slice(0, 12));
    setReward((previous) => ({ trigger: previous.trigger + 1, correct }));
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
    return <View className={`flex-1 items-center justify-center p-6 ${colors.screen}`}><Text className={`text-center ${colors.muted}`}>{t("exercises.needFour")}</Text></View>;
  }
  const isCorrect = selected === question.word.x;
  const correctCount = history.filter((entry) => entry.correct).length;
  const accuracy = history.length ? Math.round((correctCount / history.length) * 100) : 0;
  const image = prefs.showImages ? WORD_IMAGES[question.word.id] : undefined;
  const optionStyle = (option: string) => {
    if (!isLocked) return { box: "border-transparent bg-white dark:border dark:border-white/10 dark:bg-black/30", text: "text-gray-900 dark:text-white" };
    if (option === question.word.x) return { box: "border-green-400 dark:border-mint-400 bg-green-100 dark:bg-mint-500/25", text: "text-green-800 dark:text-mint-300" };
    if (option === selected) return { box: "border-red-400 dark:border-red-300 bg-red-100 dark:bg-red-500/25", text: "text-red-800 dark:text-red-200" };
    return { box: "border-transparent bg-white/70 dark:bg-white/5", text: "text-gray-500 dark:text-blue-200/75" };
  };

  const hearts = (
    <View className="flex-row items-center justify-between rounded-2xl bg-white dark:border dark:border-white/10 dark:bg-black/30 px-4 py-3 shadow-sm" accessibilityLabel={isPremium ? t("exercises.infiniteLives") : `${t("exercises.livesLabel", { lives, max: MAX_LIVES })}${extra ? t("exercises.extraLives", { n: extra }) : ""}`}>
      <View className="flex-row items-center gap-1">
        {isPremium ? <Text className="text-xl">❤️</Text> : Array.from({ length: MAX_LIVES }, (_, index) => <Text key={index} className="text-xl" style={index >= lives ? { opacity: 0.25 } : null}>❤️</Text>)}
        {isPremium ? <Text className="ml-1 text-sm font-bold text-gray-900 dark:text-white">{t("exercises.premiumInfinite")}</Text> : extra > 0 ? <Text className="ml-1 text-xs font-bold text-pink-700">+{extra}</Text> : null}
      </View>
      {!isPremium && lives < MAX_LIVES ? <Text className="text-xs font-semibold text-gray-500 dark:text-blue-200/75">{t("exercises.nextIn", { time: formatCountdown(msUntilNext) })}</Text> : null}
      {!isPremium ? <Pressable accessibilityRole="button" onPress={() => router.push("/premium")} className="rounded-full bg-indigo-50 dark:bg-white/10 px-2 py-1 active:opacity-70"><Text className="text-xs font-bold text-indigo-700 dark:text-mint-300">💎</Text></Pressable> : null}
    </View>
  );
  const outOfLivesCard = (
    <View className="w-full items-center rounded-3xl bg-white dark:border dark:border-white/10 dark:bg-black/30 p-6 shadow-sm" style={{ maxWidth: 448 }}>
      <Text className="text-5xl">💔</Text>
      <Text className="mt-2 text-xl font-black text-gray-900 dark:text-white">{t("exercises.outOfLives")}</Text>
      <Text className="mt-1 text-center text-sm text-gray-600 dark:text-blue-100/85">{t("exercises.outOfLivesText", { time: formatCountdown(msUntilNext) })}</Text>
      <View className="mt-4 w-full gap-2">
        <SoftButton label={t("exercises.refill", { cost: REFILL_COIN_COST, coins })} disabled={coins < REFILL_COIN_COST} onPress={() => void refillLivesWithCoins()} />
        <GradientButton label={t("exercises.premiumLives")} onPress={() => router.push("/premium")} />
        <SoftButton label={t("exercises.toCards")} onPress={() => router.navigate("/")} />
      </View>
    </View>
  );
  const stats = (
    <View className="flex-row gap-3">
      <MiniStat label={t("exercises.streak")} value={`🔥 ${streak}`} />
      <MiniStat label={t("exercises.best")} value={`🏅 ${bestStreak}`} />
      <MiniStat label={t("exercises.accuracy")} value={history.length ? `${accuracy}%` : "–"} />
    </View>
  );

  const quiz = (
    <View className="w-full items-center self-center" style={{ maxWidth: isTablet ? 640 : undefined }}>
      <Text className={`mb-4 text-lg font-bold uppercase tracking-wider ${colors.muted}`}>{t("exercises.whichWord")}</Text>
      {image ? <Image source={image} style={{ width: 112, height: 112, borderRadius: 16, marginBottom: 16 }} accessibilityIgnoresInvertColors accessibilityLabel={t("learn.imageFor", { word: question.word.de })} /> : null}
      <View className="mb-4 flex-row items-center gap-3">
        <Pop trigger={question.word.id.length + history.length}><Text className={`text-center text-4xl font-extrabold ${colors.text}`}>{question.word.de}</Text></Pop>
        <IconButton icon="🔊" label={t("learn.speak", { text: question.word.de })} onPress={() => speak(question.word.de, settings.uiLang)} />
      </View>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 40, alignItems: "center" }}>
        {reward.correct ? <FloatingReward text="+15 XP ✨" trigger={reward.trigger} /> : null}
        {reward.correct ? <SparkleBurst trigger={reward.trigger} /> : null}
      </View>
      <View className="mb-5 min-h-9 flex-row items-center gap-2" accessibilityLiveRegion="assertive">
        {isLocked ? (
          <>
            <Text className={`rounded-xl px-3 py-2 text-sm font-bold ${isCorrect ? "bg-green-100 dark:bg-mint-500/25 text-green-800 dark:text-mint-300" : "bg-red-100 dark:bg-red-500/25 text-red-800 dark:text-red-200"}`}>
              {isCorrect ? t("exercises.correct") : t("exercises.wrong", { answer: question.word.x })}
            </Text>
            <IconButton icon="🔊" label={t("learn.speak", { text: question.word.x })} onPress={() => speak(question.word.x, pack.lang, { slow: prefs.slowSpeech })} />
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
              accessibilityLabel={isLocked && option === question.word.x ? t("exercises.correctAnswer", { option }) : option}
              disabled={isLocked}
              onPress={() => choose(option)}
              className={`items-center justify-center rounded-2xl border-2 p-5 shadow-sm active:scale-95 ${isTablet ? "min-h-[84px] w-[48.5%]" : ""} ${style.box}`}
            >
              <Pop trigger={isLocked && option === question.word.x ? history.length : 0}><Text className={`text-center text-lg font-semibold ${style.text}`}>{option}</Text></Pop>
            </Pressable>
          );
        })}
      </View>
      <Text className={`mt-5 text-xs ${colors.muted}`}>{t("exercises.colors")}</Text>
    </View>
  );

  const historyList = (
    <View className="rounded-3xl bg-white dark:border dark:border-white/10 dark:bg-black/30 p-4 shadow-sm">
      <Label>{t("exercises.lastAnswers")}</Label>
      {history.length === 0 ? <Text className="text-sm text-gray-500 dark:text-blue-200/75">{t("exercises.noAnswers")}</Text> : null}
      {history.map((entry) => (
        <View key={entry.key} className="mb-1 flex-row items-center rounded-xl px-1">
          <Text className={`mr-2 w-5 text-sm ${entry.correct ? "text-green-600 dark:text-mint-300" : "text-red-600 dark:text-red-300"}`}>{entry.correct ? "✓" : "✗"}</Text>
          <Text className="flex-1 text-sm text-gray-900 dark:text-white" numberOfLines={1}><Text className="font-semibold">{entry.word.de}</Text><Text className="text-gray-500 dark:text-blue-200/75"> · {entry.word.x}</Text></Text>
          <Pressable accessibilityLabel={t("learn.speak", { text: entry.word.x })} hitSlop={8} onPress={() => speak(entry.word.x, pack.lang, { slow: prefs.slowSpeech })} className="px-2 py-2 active:opacity-50"><Text>🔊</Text></Pressable>
        </View>
      ))}
    </View>
  );

  if (isWide) {
    return (
      <View className={`flex-1 flex-row ${colors.screen}`}>
        <ScrollView className="flex-1" contentContainerClassName="items-center p-6 pt-10 pb-10">{outOfLives ? outOfLivesCard : quiz}</ScrollView>
        <ScrollView style={{ width: 320, flexGrow: 0 }} contentContainerClassName="gap-4 p-4 pb-10">
          {hearts}
          {stats}
          {historyList}
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView className={`flex-1 ${colors.screen}`} contentContainerClassName="items-center p-4 pt-6 pb-10">
      <View className="mb-6 w-full gap-3 self-center" style={{ maxWidth: isTablet ? 640 : 448 }}>{hearts}{stats}</View>
      {outOfLives ? outOfLivesCard : quiz}
      {isTablet ? <View className="mt-8 w-full self-center" style={{ maxWidth: 640 }}>{historyList}</View> : null}
    </ScrollView>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center rounded-2xl bg-white dark:border dark:border-white/10 dark:bg-black/30 px-2 py-3 shadow-sm">
      <Text className="text-lg font-black text-gray-900 dark:text-white">{value}</Text>
      <Text className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-blue-200/75">{label}</Text>
    </View>
  );
}
