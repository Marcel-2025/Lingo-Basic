import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { isWordLearned, isWordMastered, recordLearningInInsights } from "@/app/lib/learning-history";
import { getVocabFromPack } from "@/app/lib/pack-normalization";
import { shuffle } from "@/app/lib/utils";
import type { LanguagePack, TopicItem, VocabItem } from "@/app/lib/types";
import { FloatingReward, SparkleBurst } from "~/components/effects";
import { LearnPanel, type SessionStats } from "~/components/learn-panel";
import { LearningPath } from "~/components/learning-path";
import { Appear, Card, Chip, GradientButton, IconButton, ProgressBar, SelectField, useScreenColors } from "~/components/ui";
import { useT } from "~/i18n";
import { speak, vibrate } from "~/lib/feedback";
import { useLearningPrefs } from "~/lib/learning-prefs";
import { useResponsive } from "~/lib/responsive";
import { WORD_IMAGES } from "~/lib/word-images";
import { useAppState } from "~/state/app-state";
import { useCity } from "~/state/city-state";
import { usePackState } from "~/state/pack-state";

export default function TodayScreen() {
  const { activePack, pack, isLoading, message } = usePackState();
  const colors = useScreenColors();
  const t = useT();
  const [prefs, setPrefs] = useLearningPrefs();
  if (!activePack || !pack) {
    return (
      <View className={`flex-1 items-center justify-center p-6 ${colors.screen}`}>
        <Text className={`mb-3 text-center text-2xl font-bold ${colors.text}`}>{isLoading ? t("packs.loading") : t("packs.unavailableTitle")}</Text>
        {!isLoading ? <Text className={`mb-6 text-center ${colors.muted}`}>{message === "packs.unavailable" || !message ? t("packs.unavailable") : message}</Text> : null}
        {!isLoading ? <GradientButton label={t("packs.toSettings")} onPress={() => router.navigate("/settings")} /> : null}
      </View>
    );
  }
  const modeSwitch = <ModeSwitch mode={prefs.learnMode} onChange={(learnMode) => setPrefs({ learnMode })} />;
  if (prefs.learnMode === "path") return <LearningPath key={`${pack.lang}:${pack.level}`} pack={pack} header={modeSwitch} />;
  return <Flashcards key={`${activePack.lang}:${activePack.level}:${activePack.topics.length}`} pack={activePack} header={modeSwitch} />;
}

/** Segmented switch between the lesson path and free flashcard practice. */
function ModeSwitch({ mode, onChange }: { mode: "path" | "free"; onChange: (mode: "path" | "free") => void }) {
  const t = useT();
  const options: { value: "path" | "free"; label: string }[] = [
    { value: "path", label: `🗺️ ${t("path.modePath")}` },
    { value: "free", label: `🃏 ${t("path.modeFree")}` },
  ];
  return (
    <View className="mb-4 flex-row rounded-2xl bg-white/80 p-1 shadow-sm dark:border dark:border-white/10 dark:bg-black/30" accessibilityRole="tablist">
      {options.map((option) => {
        const active = mode === option.value;
        return (
          <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(option.value)} className={`flex-1 items-center rounded-xl py-2.5 active:opacity-70 ${active ? "bg-indigo-600 dark:bg-mint-400" : ""}`}>
            <Text className={`text-sm font-black ${active ? "text-white dark:text-night-950" : "text-gray-600 dark:text-blue-100/85"}`}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Flashcards({ pack, header }: { pack: LanguagePack; header: React.ReactNode }) {
  const { insights, settings, updateInsights, awardAnswer, todayKey } = useAppState();
  const { recordCard } = useCity();
  const colors = useScreenColors();
  const t = useT();
  const { isWide, isTablet, cardMaxWidth, contentMaxWidth } = useResponsive();
  const [prefs, setPrefs] = useLearningPrefs();
  const allVocab = useMemo(() => getVocabFromPack(pack), [pack]);
  const [topicId, setTopicId] = useState("all");
  const activeTopic: TopicItem = topicId === "all"
    ? { id: "all", title: t("learn.allTopics"), difficulty: 1, vocab: allVocab }
    : pack.topics.find((topic) => topic.id === topicId) ?? { id: "all", title: t("learn.allTopics"), difficulty: 1, vocab: allVocab };
  const [queue, setQueue] = useState<VocabItem[]>(() => shuffle(allVocab));
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [isFlipped, setIsFlipped] = useState(false);
  const [session, setSession] = useState<SessionStats>({ known: 0, practice: 0 });
  const [listOpen, setListOpen] = useState(false);
  const [reward, setReward] = useState({ trigger: 0, text: "" });
  const card = queue[index];
  const baseLang = settings.uiLang;
  // Card flip: a quick squeeze on the horizontal axis whenever the card turns or a new word arrives.
  const flip = useSharedValue(1);
  useEffect(() => {
    flip.value = withSequence(withTiming(0.05, { duration: 110 }), withSpring(1, { damping: 14, stiffness: 180 }));
  }, [flip, isFlipped, card?.id]);
  const flipStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: flip.value }] }));
  const langLabel = t(`languages.${pack.lang}`);
  const baseLabel = t(`languages.${baseLang}`);
  const reverse = prefs.direction === "x-de";
  const front = card ? (reverse ? { text: card.x, lang: pack.lang, label: langLabel } : { text: card.de, lang: baseLang, label: baseLabel }) : null;
  const back = card ? (reverse ? { text: card.de, lang: baseLang, label: baseLabel } : { text: card.x, lang: pack.lang, label: langLabel }) : null;
  const image = card && prefs.showImages ? WORD_IMAGES[card.id] : undefined;

  // Auto pronunciation: whatever side is visible is read in its own language (base word first, then the
  // target word once the card is turned).
  useEffect(() => {
    if (!card || !prefs.autoSpeak) return;
    const frontIsTarget = reverse !== isFlipped;
    const timer = setTimeout(() => {
      if (frontIsTarget) speak(card.x, pack.lang, { slow: prefs.slowSpeech });
      else speak(card.de, baseLang);
    }, 150);
    return () => clearTimeout(timer);
  }, [card, isFlipped, reverse, prefs.autoSpeak, prefs.slowSpeech, pack.lang, baseLang]);

  const selectTopic = (nextTopicId: string) => {
    const vocab = nextTopicId === "all" ? allVocab : pack.topics.find((topic) => topic.id === nextTopicId)?.vocab ?? [];
    setTopicId(nextTopicId);
    setQueue(shuffle(vocab));
    setIndex(0);
    setRound(1);
    setIsFlipped(false);
  };

  /** Puts the chosen word on the current card (from the word list). */
  const pickWord = (word: VocabItem) => {
    const wasBefore = queue.slice(0, index).some((entry) => entry.id === word.id);
    const without = queue.filter((entry) => entry.id !== word.id);
    const at = Math.min(wasBefore ? index - 1 : index, without.length);
    setQueue([...without.slice(0, at), word, ...without.slice(at)]);
    setIndex(at);
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
    setReward((previous) => ({ trigger: previous.trigger + 1, text: known ? "+10 XP ✨" : "+2 XP" }));
    recordCard(known && !alreadyLearned ? 1 : 0);
    setSession((previous) => (known ? { ...previous, known: previous.known + 1 } : { ...previous, practice: previous.practice + 1 }));
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

  const panel = (
    <LearnPanel
      pack={pack}
      activeTopic={activeTopic}
      allCount={allVocab.length}
      currentWordId={card?.id}
      session={session}
      onSelectTopic={selectTopic}
      onPickWord={pickWord}
      showTopics={isWide}
    />
  );

  const toolbar = (
    <View className="mb-4 w-full flex-row flex-wrap items-center gap-2 self-center" style={{ maxWidth: cardMaxWidth }}>
      {isWide ? <Chip label={prefs.panelOpen ? `◀ ${t("learn.list")}` : `▶ ${t("learn.list")}`} accessibilityLabel={prefs.panelOpen ? t("learn.panelCollapse") : t("learn.panelExpand")} active={prefs.panelOpen} onPress={() => setPrefs({ panelOpen: !prefs.panelOpen })} /> : null}
      <Chip label={reverse ? `${pack.lang} → ${baseLang}` : `${baseLang} → ${pack.lang}`} accessibilityLabel={reverse ? t("learn.direction", { from: langLabel, to: baseLabel }) : t("learn.direction", { from: baseLabel, to: langLabel })} onPress={() => { setPrefs({ direction: reverse ? "de-x" : "x-de" }); setIsFlipped(false); }} />
      <Chip label={t("learn.autoSpeak")} accessibilityLabel={t("learn.autoSpeakLabel")} active={prefs.autoSpeak} onPress={() => setPrefs({ autoSpeak: !prefs.autoSpeak })} />
      <Chip label={t("learn.slow")} accessibilityLabel={t("learn.slowLabel")} active={prefs.slowSpeech} onPress={() => setPrefs({ slowSpeech: !prefs.slowSpeech })} />
      {Object.keys(WORD_IMAGES).length > 0 ? <Chip label={t("learn.images")} accessibilityLabel={t("learn.imagesLabel")} active={prefs.showImages} onPress={() => setPrefs({ showImages: !prefs.showImages })} /> : null}
    </View>
  );

  const flashcard = card && front && back ? (
    <View className="w-full self-center" style={{ maxWidth: cardMaxWidth }}>
      <View className="mb-2 flex-row justify-between">
        <Text className={`text-sm font-semibold ${colors.muted}`}>{t("learn.progress")}{round > 1 ? t("learn.round", { n: round }) : ""}</Text>
        <Text className={`text-sm font-semibold ${colors.muted}`}>{index + 1} / {queue.length}</Text>
      </View>
      <ProgressBar value={(index + 1) / queue.length} className="mb-5" />

      <Animated.View style={flipStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isFlipped ? t("learn.cardShown", { front: front.text, back: back.text }) : t("learn.cardHidden", { front: front.text })}
        onPress={() => setIsFlipped(true)}
        className={`items-center justify-center rounded-3xl bg-white dark:border dark:border-white/10 dark:bg-black/30 p-6 shadow-xl ${isTablet ? "min-h-[240px]" : "min-h-[300px]"} ${isFlipped ? "border-2 border-indigo-200 dark:border-mint-400/50" : ""}`}
      >
        {image ? <Image source={image} style={{ width: isTablet ? 112 : 128, height: isTablet ? 112 : 128, borderRadius: 16, marginBottom: 16 }} accessibilityIgnoresInvertColors accessibilityLabel={t("learn.imageFor", { word: card.de })} /> : null}
        <Text className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-blue-200/60">{front.label}</Text>
        <View className="mb-2 flex-row items-center gap-2">
          <Text className="text-center text-3xl font-bold text-gray-900 dark:text-white">{front.text}</Text>
          <IconButton icon="🔊" label={t("learn.speak", { text: front.text })} onPress={() => speak(front.text, front.lang, { slow: prefs.slowSpeech })} />
        </View>
        {isFlipped ? (
          <View className="mt-3 w-full items-center border-t border-gray-100 dark:border-white/10 pt-4">
            <Text className="mb-1 text-xs font-bold uppercase tracking-widest text-indigo-400 dark:text-mint-300/80">{back.label}</Text>
            <Text className="mb-3 text-center text-3xl font-bold text-indigo-600 dark:text-mint-300">{back.text}</Text>
            <View className="flex-row gap-2">
              <IconButton icon={`🔊 ${pack.lang}`} label={t("learn.speak", { text: card.x })} onPress={() => speak(card.x, pack.lang)} />
              <IconButton icon="🐢" label={t("learn.speakSlow", { text: card.x })} onPress={() => speak(card.x, pack.lang, { slow: true })} />
              <IconButton icon={`🔊 ${baseLang}`} label={t("learn.speakIn", { text: card.de, language: baseLabel })} onPress={() => speak(card.de, baseLang)} />
            </View>
            {card.ex ? (
              <View className="mt-4 w-full rounded-xl bg-indigo-50 dark:bg-white/10 p-3">
                <Text className="text-sm italic text-gray-900 dark:text-white">{card.ex}</Text>
                {card.exTr ? <Text className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{card.exTr}</Text> : null}
              </View>
            ) : null}
          </View>
        ) : (
          <Text className="mt-6 text-gray-400 dark:text-blue-200/60">{t("learn.tapToReveal")}</Text>
        )}
      </Pressable>
      </Animated.View>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 120, alignItems: "center" }}>
        <FloatingReward text={reward.text} trigger={reward.trigger} color={reward.text.startsWith("+10") ? "#fde68a" : "#bfdbfe"} />
        {reward.text.startsWith("+10") ? <SparkleBurst trigger={reward.trigger} /> : null}
      </View>

      {isFlipped ? (
        <Appear entering={FadeIn.duration(250)} className="mt-6 flex-row gap-4">
          <Pressable accessibilityRole="button" onPress={() => answer(false)} className="flex-1 items-center rounded-2xl bg-red-100 dark:bg-red-500/25 py-4 active:opacity-70"><Text className="text-base font-bold text-red-700 dark:text-red-200">{t("learn.practice")}</Text></Pressable>
          <GradientButton className="flex-1" label={t("learn.known")} onPress={() => answer(true)} />
        </Appear>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setIsFlipped(true)} className="mt-6 items-center rounded-2xl bg-white dark:border dark:border-white/10 dark:bg-black/30 py-4 shadow-sm active:opacity-70"><Text className="font-bold text-indigo-700 dark:text-mint-300">{t("learn.reveal")}</Text></Pressable>
      )}
    </View>
  ) : (
    <Text className={`mt-10 text-center ${colors.muted}`}>{t("learn.noWords")}</Text>
  );

  // Tablet landscape: collapsible side panel + centered card.
  if (isWide) {
    return (
      <View className={`flex-1 flex-row ${colors.screen}`}>
        {prefs.panelOpen ? (
          <ScrollView style={{ width: 340, flexGrow: 0 }} contentContainerClassName="p-4 pb-10">{panel}</ScrollView>
        ) : null}
        <ScrollView className="flex-1" contentContainerClassName="p-6 pb-10">
          <View className="w-full self-center" style={{ maxWidth: 620 }}>
            {header}
            {toolbar}
            {flashcard}
          </View>
        </ScrollView>
      </View>
    );
  }

  // Phone and tablet portrait: one column; the list and extras are collapsible above the card.
  return (
    <ScrollView className={`flex-1 ${colors.screen}`} contentContainerClassName="p-4 pb-10">
      <View className="w-full self-center" style={{ maxWidth: contentMaxWidth }}>
        {header}
        <Card className="mb-3 p-3">
          <SelectField
            label={t("learn.chooseCategory", { n: pack.topics.length })}
            value={topicId}
            onChange={selectTopic}
            options={[{ value: "all", label: t("learn.allTopicsCount", { n: allVocab.length }) }, ...pack.topics.map((topic) => ({ value: topic.id, label: t("learn.topicOption", { icon: topic.icon ?? "", title: topic.title, n: topic.vocab.length }).trim() }))]}
          />
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: listOpen }} onPress={() => setListOpen((value) => !value)} className="mt-3 flex-row items-center justify-between rounded-xl bg-indigo-50 dark:bg-white/10 px-3 py-2 active:opacity-70">
            <Text className="text-sm font-bold text-indigo-700 dark:text-mint-300">{t("learn.listToggle")}</Text>
            <Text className="text-sm font-bold text-indigo-700 dark:text-mint-300">{listOpen ? "▴" : "▾"}</Text>
          </Pressable>
        </Card>
        {listOpen ? <View className="mb-4">{panel}</View> : null}
        {toolbar}
        {flashcard}
      </View>
    </ScrollView>
  );
}
