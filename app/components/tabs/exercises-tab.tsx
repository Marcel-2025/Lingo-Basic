"use client";

import { useEffect, useRef, useState } from "react";
import { ANSWER_LOCK_MS, createQuestion, type Question } from "@/app/lib/exercises";
import type { LanguagePack, VocabItem } from "@/app/lib/types";

interface ExercisesTabProps {
  pack: LanguagePack;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  onAnswer: (word: VocabItem, correct: boolean) => void;
}

export function ExercisesTab({ pack, soundEnabled, vibrationEnabled, onAnswer }: ExercisesTabProps) {
  const [question, setQuestion] = useState<Question | null>(() => createQuestion(pack));
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    void audioContextRef.current?.close();
  }, []);

  // Audio is only created inside a click handler, so browsers allow playback (autoplay policy).
  const playFeedbackTone = (success: boolean) => {
    const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = audioContextRef.current ?? new AudioContextConstructor();
    audioContextRef.current = context;
    if (context.state === "suspended") void context.resume();
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
  };

  const handleSelect = (option: string) => {
    if (!question || isLocked) return;
    const correct = option === question.word.x;
    setSelectedOption(option);
    setIsLocked(true);
    onAnswer(question.word, correct);
    if (vibrationEnabled && "vibrate" in navigator) navigator.vibrate(correct ? [30, 30] : [120]);
    if (soundEnabled) {
      try {
        playFeedbackTone(correct);
      } catch {
        // Audio feedback is optional.
      }
    }
    const previousWordId = question.word.id;
    timeoutRef.current = window.setTimeout(() => {
      setQuestion(createQuestion(pack, previousWordId));
      setSelectedOption(null);
      setIsLocked(false);
      timeoutRef.current = null;
    }, ANSWER_LOCK_MS);
  };

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
      <div className="mb-6 min-h-9" role="status" aria-live="assertive">{isLocked && <p className={`rounded-xl px-3 py-2 text-sm font-bold ${isCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{isCorrect ? "Richtig! Stark gemacht ✅" : `Nicht ganz. Richtig ist: ${question.word.x}`}</p>}</div>
      <div className="grid w-full max-w-md grid-cols-1 gap-4">{question.options.map((option) => <button key={option} type="button" onClick={() => handleSelect(option)} disabled={isLocked} aria-label={isLocked && option === question.word.x ? `${option} (richtige Antwort)` : option} className={`rounded-2xl border-2 p-5 text-lg font-semibold shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${optionClasses(option)} ${isLocked ? "cursor-not-allowed" : "active:scale-95"}`}>{option}</button>)}</div>
      <p className="mt-5 text-xs opacity-60">Antwort-Farben: Grün = richtig, Rot = falsch</p>
    </div>
  );
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
