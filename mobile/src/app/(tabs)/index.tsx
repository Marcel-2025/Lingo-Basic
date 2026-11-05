import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { SUPPORTED_LANGUAGES } from "@/app/lib/languages";
import { isWordLearned, isWordMastered, recordLearningInInsights } from "@/app/lib/learning-history";
import { getVocabFromPack } from "@/app/lib/pack-normalization";
import { shuffle } from "@/app/lib/utils";
import type { LanguagePack, TopicItem, VocabItem } from "@/app/lib/types";
import { LearnPanel, type SessionStats } from "~/components/learn-panel";
import { Card, Chip, GradientButton, IconButton, ProgressBar, SelectField, useScreenColors } from "~/components/ui";
import { speak, vibrate } from "~/lib/feedback";
import { useLearningPrefs } from "~/lib/learning-prefs";
import { useResponsive } from "~/lib/responsive";
import { WORD_IMAGES } from "~/lib/word-images";
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
  const { isWide, isTablet, cardMaxWidth, contentMaxWidth } = useResponsive();
  const [prefs, setPrefs] = useLearningPrefs();
  const allVocab = useMemo(() => getVocabFromPack(pack), [pack]);
  const [topicId, setTopicId] = useState("all");
  const activeTopic: TopicItem = topicId === "all"
    ? { id: "all", title: "Alle Themen", difficulty: 1, vocab: allVocab }
    : pack.topics.find((topic) => topic.id === topicId) ?? { id: "all", title: "Alle Themen", difficulty: 1, vocab: allVocab };
  const [queue, setQueue] = useState<VocabItem[]>(() => shuffle(allVocab));
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [isFlipped, setIsFlipped] = useState(false);
  const [session, setSession] = useState<SessionStats>({ known: 0, practice: 0 });
  const [listOpen, setListOpen] = useState(false);
  const card = queue[index];
  const langLabel = SUPPORTED_LANGUAGES[pack.lang].label;
  const reverse = prefs.direction === "x-de";
  const front = card ? (reverse ? { text: card.x, lang: pack.lang, label: langLabel } : { text: card.de, lang: "DE" as const, label: "Deutsch" }) : null;
  const back = card ? (reverse ? { text: card.de, lang: "DE" as const, label: "Deutsch" } : { text: card.x, lang: pack.lang, label: langLabel }) : null;
  const image = card && prefs.showImages ? WORD_IMAGES[card.id] : undefined;

  // Auto pronunciation: the target-language word is read as soon as it becomes visible.
  useEffect(() => {
    if (!card || !prefs.autoSpeak) return;
    if (reverse && !isFlipped) speak(card.x, pack.lang, { slow: prefs.slowSpeech });
    if (!reverse && isFlipped) speak(card.x, pack.lang, { slow: prefs.slowSpeech });
  }, [card, isFlipped, reverse, prefs.autoSpeak, prefs.slowSpeech, pack.lang]);

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
      {isWide ? <Chip label={prefs.panelOpen ? "◀ Liste" : "▶ Liste"} accessibilityLabel={prefs.panelOpen ? "Seitenleiste einklappen" : "Seitenleiste ausklappen"} active={prefs.panelOpen} onPress={() => setPrefs({ panelOpen: !prefs.panelOpen })} /> : null}
      <Chip label={reverse ? `${pack.lang} → DE` : `DE → ${pack.lang}`} accessibilityLabel={`Richtung: ${reverse ? `${langLabel} nach Deutsch` : `Deutsch nach ${langLabel}`}. Tippen zum Umschalten`} onPress={() => { setPrefs({ direction: reverse ? "de-x" : "x-de" }); setIsFlipped(false); }} />
      <Chip label="🔊 Auto" accessibilityLabel="Automatisch vorlesen" active={prefs.autoSpeak} onPress={() => setPrefs({ autoSpeak: !prefs.autoSpeak })} />
      <Chip label="🐢 Langsam" accessibilityLabel="Langsam vorlesen" active={prefs.slowSpeech} onPress={() => setPrefs({ slowSpeech: !prefs.slowSpeech })} />
      {Object.keys(WORD_IMAGES).length > 0 ? <Chip label="🖼 Bilder" accessibilityLabel="Bilder anzeigen" active={prefs.showImages} onPress={() => setPrefs({ showImages: !prefs.showImages })} /> : null}
    </View>
  );

  const flashcard = card && front && back ? (
    <View className="w-full self-center" style={{ maxWidth: cardMaxWidth }}>
      <View className="mb-2 flex-row justify-between">
        <Text className={`text-sm font-semibold ${colors.muted}`}>Fortschritt{round > 1 ? ` · Runde ${round}` : ""}</Text>
        <Text className={`text-sm font-semibold ${colors.muted}`}>{index + 1} / {queue.length}</Text>
      </View>
      <ProgressBar value={(index + 1) / queue.length} className="mb-5" />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isFlipped ? `Lernkarte: ${front.text} – ${back.text}` : `Lernkarte: ${front.text}. Tippen zum Aufdecken`}
        onPress={() => setIsFlipped(true)}
        className={`items-center justify-center rounded-3xl bg-white p-6 shadow-xl ${isTablet ? "min-h-[240px]" : "min-h-[300px]"} ${isFlipped ? "border-2 border-indigo-200" : ""}`}
      >
        {image ? <Image source={image} style={{ width: isTablet ? 112 : 128, height: isTablet ? 112 : 128, borderRadius: 16, marginBottom: 16 }} accessibilityIgnoresInvertColors accessibilityLabel={`Bild zu ${card.de}`} /> : null}
        <Text className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400">{front.label}</Text>
        <View className="mb-2 flex-row items-center gap-2">
          <Text className="text-center text-3xl font-bold text-gray-900">{front.text}</Text>
          <IconButton icon="🔊" label={`${front.text} vorlesen`} onPress={() => speak(front.text, front.lang, { slow: prefs.slowSpeech })} />
        </View>
        {isFlipped ? (
          <View className="mt-3 w-full items-center border-t border-gray-100 pt-4">
            <Text className="mb-1 text-xs font-bold uppercase tracking-widest text-indigo-400">{back.label}</Text>
            <Text className="mb-3 text-center text-3xl font-bold text-indigo-600">{back.text}</Text>
            <View className="flex-row gap-2">
              <IconButton icon={`🔊 ${pack.lang}`} label={`${card.x} vorlesen`} onPress={() => speak(card.x, pack.lang)} />
              <IconButton icon="🐢" label={`${card.x} langsam vorlesen`} onPress={() => speak(card.x, pack.lang, { slow: true })} />
              <IconButton icon="🔊 DE" label={`${card.de} auf Deutsch vorlesen`} onPress={() => speak(card.de, "DE")} />
            </View>
            {card.ex ? (
              <View className="mt-4 w-full rounded-xl bg-indigo-50 p-3">
                <Text className="text-sm italic text-gray-900">{card.ex}</Text>
                {card.exTr ? <Text className="mt-1 text-sm font-semibold text-gray-900">{card.exTr}</Text> : null}
              </View>
            ) : null}
          </View>
        ) : (
          <Text className="mt-6 text-gray-400">Tippe zum Aufdecken</Text>
        )}
      </Pressable>

      {isFlipped ? (
        <View className="mt-6 flex-row gap-4">
          <Pressable accessibilityRole="button" onPress={() => answer(false)} className="flex-1 items-center rounded-2xl bg-red-100 py-4 active:opacity-70"><Text className="text-base font-bold text-red-700">Noch üben</Text></Pressable>
          <GradientButton className="flex-1" label="Gewusst" onPress={() => answer(true)} />
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setIsFlipped(true)} className="mt-6 items-center rounded-2xl bg-white py-4 shadow-sm active:opacity-70"><Text className="font-bold text-indigo-700">Aufdecken</Text></Pressable>
      )}
    </View>
  ) : (
    <Text className={`mt-10 text-center ${colors.muted}`}>Für diese Auswahl stehen keine Wörter bereit. Wähle in den Einstellungen einen anderen Lernmodus.</Text>
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
        <Card className="mb-3 p-3">
          <SelectField
            label={`Kategorie auswählen (${pack.topics.length})`}
            value={topicId}
            onChange={selectTopic}
            options={[{ value: "all", label: `🌍 Alle Themen (${allVocab.length} Wörter)` }, ...pack.topics.map((topic) => ({ value: topic.id, label: `${topic.icon ?? ""} ${topic.title} (${topic.vocab.length} Wörter)`.trim() }))]}
          />
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: listOpen }} onPress={() => setListOpen((value) => !value)} className="mt-3 flex-row items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 active:opacity-70">
            <Text className="text-sm font-bold text-indigo-700">Wortliste, Tagesziel & Beispielsätze</Text>
            <Text className="text-sm font-bold text-indigo-700">{listOpen ? "▴" : "▾"}</Text>
          </Pressable>
        </Card>
        {listOpen ? <View className="mb-4">{panel}</View> : null}
        {toolbar}
        {flashcard}
      </View>
    </ScrollView>
  );
}
