import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isWordLearned, isWordMastered, recordLearningInInsights } from "@/app/lib/learning-history";
import { buildLessonSteps, buildPath, correctOption, createQuizStep, LESSON_BONUS_XP, recordLessonResult, starsForMistakes, type LessonStep, type PathLesson, type QuizStep } from "@/app/lib/lessons";
import { getVocabFromPack } from "@/app/lib/pack-normalization";
import { getLevelFromXp } from "@/app/lib/utils";
import type { LanguagePack } from "@/app/lib/types";
import { Confetti, Flame } from "~/components/celebration";
import { FloatingReward, Pop, SparkleBurst } from "~/components/effects";
import { Appear, Gradient, GradientButton, IconButton, ProgressBar, SoftButton, useScreenColors } from "~/components/ui";
import { useT, type TranslationKey } from "~/i18n";
import { pauseCelebrations, resumeCelebrations } from "~/lib/celebrations";
import { playAnswerTone, speak, vibrate } from "~/lib/feedback";
import { useLearningPrefs } from "~/lib/learning-prefs";
import { WORD_IMAGES } from "~/lib/word-images";
import { useAppState } from "~/state/app-state";
import { useCity } from "~/state/city-state";
import { usePackState } from "~/state/pack-state";

/** One lesson of the path: new words as cards, then a short quiz; wrong answers come back at the end. */
export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pack } = usePackState();
  const t = useT();
  const colors = useScreenColors();
  const found = useMemo(() => findLesson(pack, id), [id, pack]);

  // The result screen shows XP, level and streak itself, so the big overlays for those are skipped afterwards.
  useEffect(() => {
    pauseCelebrations();
    return () => resumeCelebrations(["level", "streak"]);
  }, []);

  if (!pack || !found) {
    return (
      <View className={`flex-1 items-center justify-center gap-4 p-6 ${colors.screen}`}>
        <Text className={`text-center text-lg font-bold ${colors.text}`}>{t("lesson.notFound")}</Text>
        <SoftButton label={t("lesson.back")} onPress={() => router.back()} className="w-48" />
      </View>
    );
  }
  return <LessonRunner key={found.lesson.id} pack={pack} lesson={found.lesson} topicTitle={found.section.title} />;
}

const findLesson = (pack: LanguagePack | null, id: string | undefined) => {
  if (!pack) return null;
  for (const section of buildPath(pack)) {
    const lesson = section.lessons.find((entry) => entry.id === id);
    if (lesson) return { lesson, section };
  }
  return null;
};

interface Result {
  stars: number;
  mistakes: number;
  correct: number;
  xpStart: number;
  streakStart: number;
}

function LessonRunner({ pack, lesson, topicTitle }: { pack: LanguagePack; lesson: PathLesson; topicTitle: string }) {
  const { insights, settings, stats, updateInsights, updateStats, awardAnswer, todayKey } = useAppState();
  const { recordCard, recordExercise } = useCity();
  const insets = useSafeAreaInsets();
  const t = useT();
  const [prefs] = useLearningPrefs();
  const allVocab = useMemo(() => getVocabFromPack(pack), [pack]);
  const topicVocab = useMemo(() => pack.topics.find((topic) => topic.id === lesson.topicId)?.vocab ?? [], [lesson.topicId, pack.topics]);
  const [steps, setSteps] = useState<LessonStep[]>(() => buildLessonSteps(lesson, topicVocab, allVocab));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [reward, setReward] = useState(0);
  const [confirmExit, setConfirmExit] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const start = useRef({ xp: stats.xp, streak: stats.streak });
  const step = steps[index];
  const baseLang = settings.uiLang;

  // Pronunciation: a new word is read in the target language; the listening task plays only the target word.
  useEffect(() => {
    if (!step || result) return;
    if (step.kind === "learn" || step.kind === "listen") {
      if (step.kind === "learn" && !prefs.autoSpeak) return;
      const timer = setTimeout(() => speak(step.word.x, pack.lang, { slow: prefs.slowSpeech }), 250);
      return () => clearTimeout(timer);
    }
  }, [index, step, pack.lang, prefs.autoSpeak, prefs.slowSpeech, result]);

  const finish = (finalMistakes: number, finalCorrect: number) => {
    const stars = starsForMistakes(finalMistakes);
    updateInsights((previous) => recordLessonResult(previous, lesson.id, stars));
    updateStats((previous) => {
      const xp = previous.xp + LESSON_BONUS_XP;
      return { ...previous, xp, level: getLevelFromXp(xp) };
    });
    if (settings.soundEnabled) playAnswerTone(true);
    if (settings.vibrationEnabled) vibrate(true);
    setResult({ stars, mistakes: finalMistakes, correct: finalCorrect, xpStart: start.current.xp, streakStart: start.current.streak });
  };

  const next = (nextSteps = steps, finalMistakes = mistakes, finalCorrect = correct) => {
    setSelected(null);
    if (index + 1 >= nextSteps.length) finish(finalMistakes, finalCorrect);
    else setIndex(index + 1);
  };

  const learnNext = () => {
    if (step?.kind !== "learn") return;
    updateInsights((previous) => ({ ...previous, learnedDays: { ...previous.learnedDays, [todayKey()]: (previous.learnedDays[todayKey()] ?? 0) + 1 } }));
    recordCard(0);
    next();
  };

  const choose = (option: string) => {
    if (!step || step.kind === "learn" || selected !== null) return;
    const right = option === correctOption(step);
    setSelected(option);
    const word = step.word;
    if (right) {
      const alreadyLearned = isWordLearned(insights, lesson.topicId, word.id, pack.lang);
      const alreadyMastered = isWordMastered(insights, word.id, pack.lang);
      updateInsights((previous) => recordLearningInInsights(previous, { topicId: lesson.topicId, word: { id: word.id, de: word.de, x: word.x, lang: pack.lang }, mastered: true, dateKey: todayKey() }));
      awardAnswer(10, true, alreadyLearned ? 0 : 1, alreadyMastered ? 0 : 1);
      setCorrect((value) => value + 1);
      setReward((value) => value + 1);
    } else {
      updateInsights((previous) => ({ ...previous, learnedDays: { ...previous.learnedDays, [todayKey()]: (previous.learnedDays[todayKey()] ?? 0) + 1 } }));
      awardAnswer(0, false, 0, 0);
      setMistakes((value) => value + 1);
      // The word comes back at the end of the lesson (as the "choose the word" task).
      setSteps((previous) => [...previous, createQuizStep(word, "choose-target", topicVocab, allVocab)]);
    }
    recordExercise(right);
    if (settings.soundEnabled) playAnswerTone(right);
    if (settings.vibrationEnabled) vibrate(right);
    if (step.kind !== "listen" && prefs.autoSpeak) setTimeout(() => speak(word.x, pack.lang, { slow: prefs.slowSpeech }), 200);
  };

  if (result) return <LessonComplete result={result} topicTitle={topicTitle} lessonNumber={lesson.index + 1} />;
  if (!step) return null;

  const isQuiz = step.kind !== "learn";
  const answer = isQuiz ? correctOption(step) : "";
  const isRight = selected !== null && selected === answer;
  const learnCount = lesson.words.length;

  return (
    <View className="flex-1" style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }}>
      <View className="flex-row items-center gap-3 px-4">
        <Pressable accessibilityRole="button" accessibilityLabel={t("lesson.close")} hitSlop={10} onPress={() => setConfirmExit(true)} className="h-10 w-10 items-center justify-center rounded-full bg-white/80 active:opacity-60 dark:bg-white/10">
          <Text className="text-lg font-black text-gray-700 dark:text-white">✕</Text>
        </Pressable>
        <View className="flex-1"><ProgressBar value={index / steps.length} /></View>
        <Text className="text-sm font-bold text-gray-600 dark:text-blue-100/85">{index < learnCount ? t("lesson.newWords") : t("lesson.quiz")}</Text>
      </View>

      {confirmExit ? (
        <Appear entering={FadeInDown.duration(200)} className="mx-4 mt-3 rounded-2xl bg-white p-4 shadow-sm dark:shadow-none dark:border dark:border-white/10 dark:bg-black/40">
          <Text className="text-base font-bold text-gray-900 dark:text-white">{t("lesson.exitTitle")}</Text>
          <Text className="mt-1 text-sm text-gray-600 dark:text-blue-100/85">{t("lesson.exitText")}</Text>
          <View className="mt-3 flex-row gap-3">
            <SoftButton className="flex-1" tone="red" label={t("lesson.exitYes")} onPress={() => router.back()} />
            <GradientButton className="flex-1" label={t("lesson.exitNo")} onPress={() => setConfirmExit(false)} />
          </View>
        </Appear>
      ) : null}

      <ScrollView className="flex-1" contentContainerClassName="flex-grow items-center justify-center p-5">
        <View className="w-full" style={{ maxWidth: 520 }}>
          {step.kind === "learn" ? (
            <LearnCard key={`${index}-${step.word.id}`} step={step} pack={pack} baseLang={baseLang} showImage={prefs.showImages} slow={prefs.slowSpeech} />
          ) : (
            <QuizCard key={`${index}-${step.word.id}`} step={step} pack={pack} baseLang={baseLang} selected={selected} onChoose={choose} reward={reward} showImage={prefs.showImages} slow={prefs.slowSpeech} />
          )}
        </View>
      </ScrollView>

      <View className="px-5">
        <View className="w-full self-center" style={{ maxWidth: 520 }}>
          {step.kind === "learn" ? (
            <GradientButton label={index + 1 === learnCount ? t("lesson.toQuiz") : t("lesson.next")} onPress={learnNext} />
          ) : selected !== null ? (
            <Appear entering={FadeInUp.duration(220)} className={`rounded-3xl p-4 ${isRight ? "bg-green-100 dark:bg-mint-500/25" : "bg-red-100 dark:bg-red-500/25"}`}>
              <Text className={`mb-1 text-lg font-black ${isRight ? "text-green-800 dark:text-mint-300" : "text-red-800 dark:text-red-200"}`}>{isRight ? t(PRAISE[(index + correct) % PRAISE.length]) : t("lesson.correctIs")}</Text>
              {!isRight ? <Text className="mb-3 text-base font-bold text-gray-900 dark:text-white">{answer}</Text> : <View className="mb-2" />}
              <GradientButton label={t("lesson.next")} onPress={() => next()} />
            </Appear>
          ) : (
            <Text className="py-4 text-center text-sm font-semibold text-gray-500 dark:text-blue-200/75">{t("lesson.pickOne")}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const PRAISE: TranslationKey[] = ["lesson.praise1", "lesson.praise2", "lesson.praise3", "lesson.praise4"];

function LearnCard({ step, pack, baseLang, showImage, slow }: { step: Extract<LessonStep, { kind: "learn" }>; pack: LanguagePack; baseLang: LanguagePack["lang"]; showImage: boolean; slow: boolean }) {
  const t = useT();
  const image = showImage ? WORD_IMAGES[step.word.id] : undefined;
  return (
    <Appear entering={FadeIn.duration(260)} className="items-center rounded-3xl bg-white p-6 shadow-xl dark:shadow-none dark:border dark:border-white/10 dark:bg-black/30">
      <View className="mb-3 rounded-full bg-amber-100 px-3 py-1 dark:bg-amber-400/20"><Text className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-200">{t("lesson.newWord")}</Text></View>
      {image ? <Image source={image} style={{ width: 132, height: 132, borderRadius: 18, marginBottom: 14 }} accessibilityIgnoresInvertColors accessibilityLabel={t("learn.imageFor", { word: step.word.de })} /> : null}
      <View className="flex-row items-center gap-2">
        <Text className="text-center text-4xl font-black text-indigo-600 dark:text-mint-300">{step.word.x}</Text>
        <IconButton icon="🔊" label={t("learn.speak", { text: step.word.x })} onPress={() => speak(step.word.x, pack.lang, { slow })} />
        <IconButton icon="🐢" label={t("learn.speakSlow", { text: step.word.x })} onPress={() => speak(step.word.x, pack.lang, { slow: true })} />
      </View>
      <Text className="mt-2 text-center text-2xl font-bold text-gray-900 dark:text-white">{step.word.de}</Text>
      {step.word.ex ? (
        <Pressable accessibilityRole="button" onPress={() => speak(step.word.ex ?? "", pack.lang, { slow })} className="mt-5 w-full rounded-2xl bg-indigo-50 p-3 active:opacity-70 dark:bg-white/10">
          <Text className="text-sm italic text-gray-900 dark:text-white">🔊 {step.word.ex}</Text>
          {step.word.exTr ? <Text className="mt-1 text-sm font-semibold text-gray-700 dark:text-blue-100/85">{step.word.exTr}</Text> : null}
        </Pressable>
      ) : null}
      <Text className="mt-4 text-xs text-gray-400 dark:text-blue-200/60">{t("lesson.learnHint", { language: t(`languages.${baseLang}`) })}</Text>
    </Appear>
  );
}

function QuizCard({ step, pack, baseLang, selected, onChoose, reward, showImage, slow }: { step: QuizStep; pack: LanguagePack; baseLang: LanguagePack["lang"]; selected: string | null; onChoose: (option: string) => void; reward: number; showImage: boolean; slow: boolean }) {
  const t = useT();
  const answer = correctOption(step);
  const locked = selected !== null;
  const image = showImage && step.kind === "choose-target" ? WORD_IMAGES[step.word.id] : undefined;
  const prompt = step.kind === "choose-target" ? t("lesson.askTarget", { language: t(`languages.${pack.lang}`) }) : step.kind === "choose-base" ? t("lesson.askBase") : t("lesson.askListen");
  const style = (option: string) => {
    if (!locked) return "border-gray-200 bg-white dark:border-white/15 dark:bg-black/30";
    if (option === answer) return "border-green-400 bg-green-100 dark:border-mint-400 dark:bg-mint-500/25";
    if (option === selected) return "border-red-400 bg-red-100 dark:border-red-300 dark:bg-red-500/25";
    return "border-transparent bg-white/60 opacity-60 dark:bg-white/5";
  };
  return (
    <Animated.View entering={FadeIn.duration(250)}>
      <Text className="mb-4 text-center text-lg font-black text-gray-700 dark:text-blue-100">{prompt}</Text>
      <View className="mb-6 items-center">
        {image ? <Image source={image} style={{ width: 112, height: 112, borderRadius: 16, marginBottom: 12 }} accessibilityIgnoresInvertColors accessibilityLabel={t("learn.imageFor", { word: step.word.de })} /> : null}
        {step.kind === "listen" ? (
          <View className="flex-row gap-3">
            <Pressable accessibilityRole="button" accessibilityLabel={t("lesson.playAgain")} onPress={() => speak(step.word.x, pack.lang, { slow })} className="h-24 w-24 items-center justify-center overflow-hidden rounded-3xl active:scale-95">
              <Gradient className="h-full w-full items-center justify-center"><Text className="text-4xl">🔊</Text></Gradient>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t("learn.speakSlow", { text: "" })} onPress={() => speak(step.word.x, pack.lang, { slow: true })} className="h-16 w-16 items-center justify-center self-end rounded-2xl bg-white active:scale-95 dark:bg-white/10">
              <Text className="text-2xl">🐢</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row items-center gap-2">
            <Pop trigger={reward}><Text className="text-center text-4xl font-black text-gray-900 dark:text-white">{step.kind === "choose-target" ? step.word.de : step.word.x}</Text></Pop>
            <IconButton icon="🔊" label={t("learn.speak", { text: step.kind === "choose-target" ? step.word.de : step.word.x })} onPress={() => (step.kind === "choose-target" ? speak(step.word.de, baseLang) : speak(step.word.x, pack.lang, { slow }))} />
          </View>
        )}
        {locked && step.kind === "listen" ? <Text className="mt-3 text-2xl font-black text-indigo-600 dark:text-mint-300">{step.word.x}</Text> : null}
      </View>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 30, alignItems: "center" }}>
        {locked && selected === answer ? <FloatingReward text="+10 XP ✨" trigger={reward} /> : null}
        {locked && selected === answer ? <SparkleBurst trigger={reward} /> : null}
      </View>
      <View className="gap-3">
        {step.options.map((option) => (
          <Pressable key={option} accessibilityRole="button" accessibilityLabel={option} disabled={locked} onPress={() => onChoose(option)} className={`items-center rounded-2xl border-2 border-b-4 px-4 py-4 active:scale-[0.98] ${style(option)}`}>
            <Text className="text-center text-lg font-bold text-gray-900 dark:text-white">{option}</Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

const levelBounds = (level: number) => ({ from: 100 * (level - 1) ** 2, to: 100 * level ** 2 });
const levelRatio = (xp: number) => {
  const level = getLevelFromXp(xp);
  const { from, to } = levelBounds(level);
  return { level, ratio: (xp - from) / (to - from) };
};

const MOTIVATION: TranslationKey[] = ["lesson.cheer1", "lesson.cheer2", "lesson.cheer3", "lesson.cheer4", "lesson.cheer5"];

/** Result screen: stars pop in, XP counts up, the level bar fills and the streak flame burns. */
function LessonComplete({ result, topicTitle, lessonNumber }: { result: Result; topicTitle: string; lessonNumber: number }) {
  const { stats } = useAppState();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const gained = Math.max(0, stats.xp - result.xpStart);
  const before = levelRatio(result.xpStart);
  const after = levelRatio(stats.xp);
  const levelUp = after.level > before.level;
  const streakUp = stats.streak > result.streakStart;
  const accuracy = result.correct + result.mistakes ? Math.round((result.correct / (result.correct + result.mistakes)) * 100) : 100;
  const cheer = MOTIVATION[(lessonNumber + result.stars) % MOTIVATION.length];

  // XP counter and level bar.
  const [shownXp, setShownXp] = useState(0);
  useEffect(() => {
    let frame = 0;
    const frames = 30;
    const timer = setInterval(() => {
      frame += 1;
      setShownXp(Math.round((gained * frame) / frames));
      if (frame >= frames) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [gained]);
  const bar = useSharedValue(before.ratio);
  useEffect(() => {
    bar.value = levelUp
      ? withSequence(withDelay(700, withTiming(1, { duration: 700 })), withTiming(0, { duration: 0 }), withTiming(after.ratio, { duration: 600 }))
      : withDelay(700, withTiming(after.ratio, { duration: 1000 }));
  }, [after.ratio, bar, levelUp]);
  const barStyle = useAnimatedStyle(() => ({ width: `${Math.max(3, Math.min(1, bar.value) * 100)}%` }));
  const trophy = useSharedValue(0);
  useEffect(() => {
    trophy.value = withSpring(1, { damping: 14, stiffness: 120 });
  }, [trophy]);
  const trophyStyle = useAnimatedStyle(() => ({ transform: [{ scale: trophy.value }, { rotate: `${(1 - trophy.value) * -30}deg` }] }));

  return (
    <View className="flex-1" style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }}>
      {Array.from({ length: 60 }, (_, index) => <Confetti key={index} index={index} width={width} height={height} />)}
      <ScrollView contentContainerClassName="flex-grow items-center justify-center px-6">
        <View className="w-full items-center" style={{ maxWidth: 480 }}>
          <Animated.Text style={[{ fontSize: 84, lineHeight: 100 }, trophyStyle]}>{result.stars === 3 ? "🏆" : "🎉"}</Animated.Text>
          <Appear entering={FadeInDown.delay(150)}><Text className="text-center text-3xl font-black text-gray-900 dark:text-white">{t("lesson.complete")}</Text></Appear>
          <Appear entering={FadeInDown.delay(250)}><Text className="mt-1 text-center text-base font-semibold text-gray-600 dark:text-blue-100/85">{t("lesson.completeSub", { n: lessonNumber, topic: topicTitle })}</Text></Appear>

          <View className="my-5 flex-row gap-2">
            {[1, 2, 3].map((value) => (
              <Animated.Text key={value} entering={ZoomIn.delay(350 + value * 220).springify().damping(16).stiffness(140)} style={{ fontSize: 54, opacity: value <= result.stars ? 1 : 0.2 }}>⭐</Animated.Text>
            ))}
          </View>
          <Appear entering={FadeIn.delay(1100)}><Text className="mb-5 text-center text-lg font-bold text-indigo-700 dark:text-mint-300">{t(cheer)}</Text></Appear>

          <Appear entering={FadeInUp.delay(500)} style={{ alignSelf: "stretch" }} className="mb-4 w-full flex-row gap-3">
            <ResultTile icon="⚡" value={`+${shownXp}`} label={t("lesson.xp")} />
            <ResultTile icon="🎯" value={`${accuracy}%`} label={t("lesson.accuracy")} />
            <View className="flex-1 items-center rounded-2xl bg-white px-2 py-3 shadow-sm dark:shadow-none dark:border dark:border-white/10 dark:bg-black/30">
              {stats.streak > 0 ? <Flame size={28} /> : <Text style={{ fontSize: 28 }}>🔥</Text>}
              <Text className="text-xl font-black text-gray-900 dark:text-white">{stats.streak}</Text>
              <Text className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-blue-200/75">{t("lesson.streak")}</Text>
            </View>
          </Appear>

          <Appear entering={FadeInUp.delay(650)} style={{ alignSelf: "stretch" }} className="mb-3 w-full rounded-2xl bg-white p-4 shadow-sm dark:shadow-none dark:border dark:border-white/10 dark:bg-black/30">
            <View className="mb-2 flex-row justify-between">
              <Text className="text-sm font-black text-gray-900 dark:text-white">{t("lesson.level", { n: after.level })}</Text>
              <Text className="text-sm font-bold text-gray-500 dark:text-blue-200/75">{stats.xp} / {levelBounds(after.level).to} XP</Text>
            </View>
            <View className="h-4 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
              <Animated.View style={[{ height: "100%", borderRadius: 999, overflow: "hidden" }, barStyle]}><Gradient className="h-full w-full" /></Animated.View>
            </View>
          </Appear>

          {levelUp ? (
            <Appear entering={ZoomIn.delay(1500).springify().damping(18)} className="mb-3 rounded-full bg-amber-300 px-4 py-2"><Text className="text-base font-black text-night-950">⭐ {t("lesson.levelUp", { n: after.level })}</Text></Appear>
          ) : null}
          {streakUp ? (
            <Appear entering={ZoomIn.delay(1200).springify().damping(18)} className="mb-3 rounded-full bg-orange-400 px-4 py-2"><Text className="text-base font-black text-night-950">🔥 {t("lesson.streakUp", { n: stats.streak })}</Text></Appear>
          ) : null}
        </View>
      </ScrollView>
      <View className="w-full self-center px-6" style={{ maxWidth: 520 }}>
        <GradientButton label={t("lesson.continue")} onPress={() => router.back()} />
      </View>
    </View>
  );
}

function ResultTile({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View className="flex-1 items-center rounded-2xl bg-white px-2 py-3 shadow-sm dark:shadow-none dark:border dark:border-white/10 dark:bg-black/30">
      <Text style={{ fontSize: 26, lineHeight: 34 }}>{icon}</Text>
      <Text className="text-xl font-black text-gray-900 dark:text-white">{value}</Text>
      <Text className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-blue-200/75">{label}</Text>
    </View>
  );
}
