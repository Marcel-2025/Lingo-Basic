"use client";

import { useState } from "react";
import { getVocabFromPack } from "@/app/lib/pack-normalization";
import { shuffle } from "@/app/lib/utils";
import type { LanguagePack, VocabItem } from "@/app/lib/types";

interface Question {
  word: VocabItem;
  options: string[];
}

const createQuestion = (pack: LanguagePack): Question | null => {
  const vocab = getVocabFromPack(pack);
  if (vocab.length < 4) return null;
  const word = shuffle(vocab)[0];
  const distractors = shuffle(vocab.filter((entry) => entry.id !== word.id && entry.x !== word.x)).slice(0, 3).map((entry) => entry.x);
  return distractors.length === 3 ? { word, options: shuffle([word.x, ...distractors]) } : null;
};

interface ExercisesTabProps {
  pack: LanguagePack;
  onAnswer: (word: VocabItem, correct: boolean) => void;
  isPremiumUser: boolean;
  dailyLimit: number;
  completedToday: number;
  gradient: string;
  onUpgrade: () => void;
}

export function ExercisesTab({ pack, onAnswer, isPremiumUser, dailyLimit, completedToday, gradient, onUpgrade }: ExercisesTabProps) {
  const [question, setQuestion] = useState<Question | null>(() => createQuestion(pack));
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const playFeedbackTone = (success: boolean) => {
    const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = success ? "sine" : "sawtooth";
    oscillator.frequency.value = success ? 740 : 220;
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.24);
    oscillator.onended = () => void context.close();
  };

  const handleSelect = (option: string) => {
    if (!question || isLocked) return;
    const correct = option === question.word.x;
    setSelectedOption(option);
    setIsLocked(true);
    onAnswer(question.word, correct);
    if ("vibrate" in navigator) navigator.vibrate(correct ? [30, 30] : [120]);
    playFeedbackTone(correct);
    window.setTimeout(() => {
      setQuestion(createQuestion(pack));
      setSelectedOption(null);
      setIsLocked(false);
    }, 900);
  };

  if (!isPremiumUser && completedToday >= dailyLimit) {
    return <div className="mt-16 rounded-3xl bg-white p-8 text-center text-gray-900 shadow-sm"><div className="text-4xl" aria-hidden="true">🎯</div><h2 className="mt-3 text-2xl font-bold">Dein Tagesziel ist geschafft</h2><p className="mt-2 text-gray-600">Mit Premium kannst du heute unbegrenzt weiterüben.</p><button type="button" onClick={onUpgrade} className={`mt-6 rounded-2xl bg-gradient-to-r ${gradient} px-6 py-3 font-bold text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500`}>Premium entdecken</button></div>;
  }
  if (!question) return <div className="mt-10 text-center">Dieses Pack benötigt mindestens vier unterschiedliche Vokabeln für Multiple Choice.</div>;
  const isCorrect = selectedOption === question.word.x;
  const optionClasses = (option: string) => {
    if (!isLocked) return "border-transparent bg-white text-gray-900 hover:border-indigo-400";
    if (option === question.word.x) return "border-green-400 bg-green-100 text-green-800";
    if (option === selectedOption) return "border-red-400 bg-red-100 text-red-800";
    return "border-transparent bg-white/70 text-gray-500";
  };

  return (
    <div className="mt-6 flex flex-col items-center">
      <h2 className="mb-8 text-xl font-bold uppercase tracking-wider opacity-70">Welches Wort passt?</h2>
      <div className="mb-6 w-full break-words text-center text-4xl font-extrabold">{question.word.de}</div>
      {isLocked && <p className={`mb-6 text-sm font-bold ${isCorrect ? "text-green-700" : "text-red-700"}`}>{isCorrect ? "Richtig! Stark gemacht ✅" : `Nicht ganz. Richtig ist: ${question.word.x}`}</p>}
      <div className="grid w-full max-w-md grid-cols-1 gap-4">{question.options.map((option) => <button key={option} type="button" onClick={() => handleSelect(option)} disabled={isLocked} className={`rounded-2xl border-2 p-5 text-lg font-semibold shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${optionClasses(option)} ${isLocked ? "cursor-not-allowed" : "active:scale-95"}`}>{option}</button>)}</div>
      <p className="mt-5 text-xs opacity-60">Antwort-Farben: Grün = richtig, Rot = falsch</p>
    </div>
  );
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
