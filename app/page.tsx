"use client";

import { useCallback, useMemo, useState } from "react";
import { AuthModal } from "@/app/components/auth-modal";
import { PremiumModal } from "@/app/components/premium-modal";
import { ServiceWorkerRegistration } from "@/app/components/service-worker-registration";
import { ExercisesTab } from "@/app/components/tabs/exercises-tab";
import { ProfileTab } from "@/app/components/tabs/profile-tab";
import { SettingsTab } from "@/app/components/tabs/settings-tab";
import { TodayTab } from "@/app/components/tabs/today-tab";
import { NavButton } from "@/app/components/ui";
import { FREE_DAILY_LEARNING_LIMIT } from "@/app/lib/billing";
import { SUPPORTED_LANGUAGES } from "@/app/lib/languages";
import { findTopicForWord } from "@/app/lib/pack-normalization";
import { getLevelFromXp, recordActivity } from "@/app/lib/utils";
import { useAuth } from "@/app/hooks/use-auth";
import { useCloudSync } from "@/app/hooks/use-cloud-sync";
import { useEntitlement } from "@/app/hooks/use-entitlement";
import { useLanguagePack } from "@/app/hooks/use-language-pack";
import { useLearningHistory } from "@/app/hooks/use-learning-history";
import { useProgress } from "@/app/hooks/use-progress";
import type { LanguagePack, TopicItem, VocabItem } from "@/app/lib/types";

type TabName = "heute" | "uebungen" | "profil" | "settings";

const getThemeClasses = (theme: "Ocean" | "Sunset" | "Lime" | "Grape", isDarkMode: boolean) => {
  const gradients = {
    Ocean: "from-blue-500 to-cyan-400",
    Sunset: "from-orange-500 to-red-500",
    Lime: "from-green-500 to-lime-400",
    Grape: "from-purple-500 to-pink-500",
  };
  return { base: isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900", gradient: gradients[theme] };
};

const filterPackByDifficulty = (pack: LanguagePack, difficulty: "all" | 1 | 2 | 3): LanguagePack => {
  if (difficulty === "all") return pack;
  return {
    ...pack,
    topics: pack.topics.map((topic) => ({ ...topic, vocab: topic.vocab.filter((word) => word.difficulty === difficulty) })).filter((topic) => topic.vocab.length > 0),
  };
};

export default function LingoApp() {
  const [activeTab, setActiveTab] = useState<TabName>("heute");
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isPremiumOpen, setIsPremiumOpen] = useState(false);
  const [isRestoringPremium, setIsRestoringPremium] = useState(false);
  const [restorePremiumMessage, setRestorePremiumMessage] = useState("");
  const progress = useProgress();
  const auth = useAuth();
  const premium = useEntitlement(auth.user);
  const effectiveContentLevel = premium.entitlement.isPremium ? progress.settings.contentLevel : "A1";
  const { pack, loadState, reload, importPack, clearCurrentCache } = useLanguagePack(progress.settings.targetLang, effectiveContentLevel);
  const history = useLearningHistory(progress.learningInsights, progress.updateInsights);
  const { base, gradient } = getThemeClasses(progress.settings.theme, progress.settings.isDarkMode);
  const cloud = useCloudSync({
    user: auth.user,
    isReady: progress.isLoaded && auth.isReady,
    snapshot: progress.snapshot,
    applyCloudSnapshot: progress.applyCloudSnapshot,
    updateUser: auth.updateUser,
  });

  const activePack = useMemo(() => pack ? filterPackByDifficulty(pack, progress.settings.difficulty) : null, [pack, progress.settings.difficulty]);
  const completedToday = progress.learningInsights.learnedDays[progress.getTodayKey()] ?? 0;
  const dailyLimit = premium.entitlement.isPremium ? progress.settings.dailyGoal : FREE_DAILY_LEARNING_LIMIT;

  const restorePremium = useCallback(async () => {
    if (!auth.user) {
      setIsPremiumOpen(false);
      setIsAuthOpen(true);
      return;
    }
    setIsRestoringPremium(true);
    setRestorePremiumMessage("");
    try {
      const response = await fetch("/api/entitlements/restore", {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.user.idToken}` },
      });
      const result = (await response.json()) as { active?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Kauf konnte nicht wiederhergestellt werden.");
      premium.refresh();
      setRestorePremiumMessage(result.active ? "Premium wurde wiederhergestellt. Die Ansicht wird aktualisiert." : "Für dieses Lingo-Konto wurde kein aktiver Premium-Kauf gefunden.");
    } catch (error) {
      setRestorePremiumMessage(error instanceof Error ? error.message : "Kauf konnte nicht wiederhergestellt werden.");
    } finally {
      setIsRestoringPremium(false);
    }
  }, [auth.user, premium]);

  const speak = useCallback((text: string, language: "DE" | LanguagePack["lang"]) => {
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "DE" ? "de-DE" : SUPPORTED_LANGUAGES[language].speechCode;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);

  const updateStatsForAnswer = useCallback((xp: number, correct: boolean, learnedDelta: number, masteredDelta: number) => {
    progress.updateStats((previous) => {
      const activeStats = recordActivity(previous, progress.settings.timeZone);
      const nextXp = activeStats.xp + xp;
      return {
        ...activeStats,
        xp: nextXp,
        level: getLevelFromXp(nextXp),
        learnedWords: activeStats.learnedWords + learnedDelta,
        masteredWords: activeStats.masteredWords + masteredDelta,
        correctAnswers: activeStats.correctAnswers + (correct ? 1 : 0),
        totalAnswers: activeStats.totalAnswers + 1,
      };
    });
  }, [progress]);

  const handleFlashcardAnswer = useCallback((word: VocabItem, topic: TopicItem, known: boolean) => {
    const alreadyLearned = history.hasLearnedWord(topic.id, word.id);
    const alreadyMastered = history.hasMasteredWord(word.id);
    if (known) {
      history.recordLearning({ topicId: topic.id, word: { id: word.id, de: word.de, x: word.x }, mastered: true, dateKey: progress.getTodayKey() });
    } else {
      history.recordActivityDay(progress.getTodayKey());
    }
    updateStatsForAnswer(known ? 10 : 2, known, known && !alreadyLearned ? 1 : 0, known && !alreadyMastered ? 1 : 0);
  }, [history, progress, updateStatsForAnswer]);

  const handleExerciseAnswer = useCallback((word: VocabItem, correct: boolean) => {
    const topic = pack ? findTopicForWord(pack, word.id) : undefined;
    const alreadyLearned = topic ? history.hasLearnedWord(topic.id, word.id) : true;
    if (correct && topic) {
      history.recordLearning({ topicId: topic.id, word: { id: word.id, de: word.de, x: word.x }, dateKey: progress.getTodayKey() });
    } else {
      history.recordActivityDay(progress.getTodayKey());
    }
    updateStatsForAnswer(correct ? 15 : 0, correct, correct && !alreadyLearned ? 1 : 0, 0);
  }, [history, pack, progress, updateStatsForAnswer]);

  const syncLabels = { loading: "lädt…", ready: "bereit", syncing: "aktiv", error: "Fehler", offline: "lokal" } as const;

  if (!progress.isLoaded || !auth.isReady) return <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-900">Lade Lingo…</div>;

  return (
    <div className={`flex min-h-screen flex-col font-sans transition-colors duration-300 ${base}`}>
      <ServiceWorkerRegistration />
      <header className={`rounded-b-3xl bg-gradient-to-r ${gradient} p-4 text-white shadow-md`}>
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xl font-bold"><span className="text-3xl" aria-hidden="true">🦉</span><span>Lingo</span></div>
          <div className="flex items-center gap-3 text-sm font-semibold">
            {auth.user ? <button type="button" onClick={auth.logout} className="rounded-lg bg-white/20 px-2 py-1 focus-visible:outline-2 focus-visible:outline-white">👤 {auth.user.email}</button> : <button type="button" onClick={() => setIsAuthOpen(true)} className="rounded-lg bg-white/20 px-2 py-1 focus-visible:outline-2 focus-visible:outline-white">Login</button>}
            <button type="button" onClick={() => setIsPremiumOpen(true)} className="rounded-lg bg-white/20 px-2 py-1 focus-visible:outline-2 focus-visible:outline-white">👑 {premium.entitlement.isPremium ? "Premium" : "Upgrade"}</button>
            <span>🔥 {progress.stats.streak}</span><span>⭐ {progress.stats.xp} XP</span><span className="rounded-lg bg-white/20 px-2 py-1">Lvl {progress.stats.level}</span>
          </div>
          {auth.user && <div className="w-full text-right text-[11px] opacity-80">☁️ Sync {syncLabels[cloud.status]}{cloud.message ? ` · ${cloud.message}` : ""}</div>}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-4 pb-24">
        {!activePack && activeTab !== "settings" ? <div className="mt-20 text-center"><h2 className="mb-4 text-2xl font-bold">{loadState.status === "loading" ? "Sprachpaket wird geladen…" : "Sprachpaket nicht verfügbar"}</h2><p className="mb-6 opacity-80">{loadState.message ?? `Für ${progress.settings.targetLang} ${progress.settings.contentLevel} sind noch keine Inhalte vorhanden.`}</p><button type="button" onClick={() => setActiveTab("settings")} className={`rounded-xl bg-gradient-to-r ${gradient} px-6 py-3 font-bold text-white shadow-lg`}>Zu den Einstellungen</button></div> : <>
          {activeTab === "heute" && activePack && <TodayTab key={`${activePack.lang}:${activePack.level}:${progress.settings.difficulty}`} pack={activePack} speak={speak} onAnswer={handleFlashcardAnswer} gradient={gradient} isPremiumUser={premium.entitlement.isPremium} dailyLimit={dailyLimit} completedToday={completedToday} onUpgrade={() => setIsPremiumOpen(true)} />}
          {activeTab === "uebungen" && activePack && <ExercisesTab key={`${activePack.lang}:${activePack.level}:${progress.settings.difficulty}`} pack={activePack} onAnswer={handleExerciseAnswer} isPremiumUser={premium.entitlement.isPremium} dailyLimit={dailyLimit} completedToday={completedToday} gradient={gradient} onUpgrade={() => setIsPremiumOpen(true)} />}
          {activeTab === "profil" && <ProfileTab stats={progress.stats} learningInsights={progress.learningInsights} pack={pack} gradient={gradient} />}
          {activeTab === "settings" && <SettingsTab settings={progress.settings} updateSettings={progress.updateSettings} gradient={gradient} reloadPack={reload} clearCurrentCache={clearCurrentCache} importPack={importPack} entitlement={premium.entitlement} onUpgrade={() => setIsPremiumOpen(true)} />}
        </>}
      </main>

      <nav className={`fixed bottom-0 w-full p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] ${progress.settings.isDarkMode ? "bg-gray-800" : "bg-white"}`} aria-label="Hauptnavigation"><div className="mx-auto flex max-w-2xl justify-around"><NavButton icon="📚" label="Heute" isActive={activeTab === "heute"} onClick={() => setActiveTab("heute")} gradient={gradient} /><NavButton icon="🎮" label="Übungen" isActive={activeTab === "uebungen"} onClick={() => setActiveTab("uebungen")} gradient={gradient} /><NavButton icon="👤" label="Profil" isActive={activeTab === "profil"} onClick={() => setActiveTab("profil")} gradient={gradient} /><NavButton icon="⚙️" label="Settings" isActive={activeTab === "settings"} onClick={() => setActiveTab("settings")} gradient={gradient} /></div></nav>
      {isAuthOpen && <AuthModal gradient={gradient} initialMessage={auth.message} onClose={() => setIsAuthOpen(false)} onEmailAuth={auth.loginWithEmail} onGoogleAuth={auth.loginWithGoogle} />}
      {isPremiumOpen && <PremiumModal user={auth.user} entitlement={premium.entitlement} gradient={gradient} isRestoring={isRestoringPremium} onClose={() => setIsPremiumOpen(false)} onLogin={() => { setIsPremiumOpen(false); setIsAuthOpen(true); }} onRestore={restorePremium} restoreMessage={restorePremiumMessage} />}
    </div>
  );
}
