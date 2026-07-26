"use client";

import { useState } from "react";
import { getVocabFromPack } from "@/app/lib/pack-normalization";
import { shuffle } from "@/app/lib/utils";
import type { LanguagePack, TopicItem, VocabItem } from "@/app/lib/types";

interface TodayTabProps {
  pack: LanguagePack;
  gradient: string;
  isPremiumUser: boolean;
  speak: (text: string, language: "DE" | LanguagePack["lang"]) => void;
  onAnswer: (word: VocabItem, topic: TopicItem, known: boolean) => void;
}

export function TodayTab({ pack, gradient, isPremiumUser, speak, onAnswer }: TodayTabProps) {
  const [selectedTopicId, setSelectedTopicId] = useState("all");
  const [queue, setQueue] = useState<VocabItem[]>(() => shuffle(getVocabFromPack(pack)));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const activeTopic: TopicItem = selectedTopicId === "all"
    ? { id: "all", title: "Alle Themen", difficulty: 1, vocab: getVocabFromPack(pack) }
    : pack.topics.find((topic) => topic.id === selectedTopicId) ?? { id: "all", title: "Alle Themen", difficulty: 1, vocab: getVocabFromPack(pack) };
  const card = queue[currentIndex];

  const buildQueue = (topicId: string) => {
    const vocab = topicId === "all" ? getVocabFromPack(pack) : pack.topics.find((topic) => topic.id === topicId)?.vocab ?? [];
    setSelectedTopicId(topicId);
    setQueue(shuffle(vocab));
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleAnswer = (known: boolean) => {
    if (!card) return;
    const topic = pack.topics.find((entry) => entry.vocab.some((word) => word.id === card.id)) ?? activeTopic;
    onAnswer(card, topic, known);
    if ("vibrate" in navigator) navigator.vibrate(known ? [50, 50] : [100]);
    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length && isPremiumUser) {
      setQueue(shuffle(activeTopic.vocab));
      setCurrentIndex(0);
      setIsFlipped(false);
      return;
    }
    setCurrentIndex(nextIndex);
    setIsFlipped(false);
  };

  if (!card) {
    return (
      <div className="mt-20 text-center">
        <h2 className="mb-2 text-3xl font-bold">Tagesziel erreicht! 🎉</h2>
        <p>Komm morgen wieder für mehr XP.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col items-center">
      <div className="mb-6 w-full">
        <div className="mb-3 rounded-2xl bg-white p-3 text-gray-900 shadow-sm">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500" htmlFor="topic-selector">
            Kategorie auswählen ({pack.topics.length})
          </label>
          <select
            id="topic-selector"
            value={selectedTopicId}
            onChange={(event) => buildQueue(event.target.value)}
            className="w-full rounded-xl bg-gray-100 px-3 py-3 text-sm font-bold text-gray-900 outline-none transition focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">🌍 Alle Themen ({getVocabFromPack(pack).length} Wörter)</option>
            {pack.topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.icon} {topic.title} ({topic.vocab.length} Wörter)
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500">Alle Kategorien sind hier jederzeit direkt auswählbar.</p>
        </div>
        <div className="rounded-2xl bg-white p-3 text-gray-900 shadow-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">{activeTopic.title}</p>
          <div className="flex flex-wrap gap-2">
            {activeTopic.vocab.map((word) => <span key={word.id} className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{word.de}</span>)}
          </div>
        </div>
      </div>

      <div className="mb-6 w-full">
        <div className="mb-2 flex justify-between text-sm font-semibold opacity-70"><span>Fortschritt</span><span>{Math.min(currentIndex + 1, queue.length)} / {queue.length}</span></div>
        <div className="h-2.5 rounded-full bg-gray-200"><div className={`h-2.5 rounded-full bg-gradient-to-r ${gradient}`} style={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }} /></div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsFlipped(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsFlipped(true);
          }
        }}
        className={`flex min-h-[300px] w-full max-w-md flex-col items-center justify-center rounded-3xl p-8 text-center shadow-xl transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500 ${isFlipped ? "border-2 border-indigo-200 bg-white" : "bg-white"} text-gray-900`}
        aria-label={isFlipped ? "Lernkarte mit Übersetzung" : "Lernkarte aufdecken"}
      >
        <div className="mb-2 text-sm font-bold uppercase tracking-widest text-gray-400">Deutsch</div>
        <h2 className="mb-4 text-3xl font-bold">{card.de}</h2>
        {isFlipped ? (
          <div className="mt-6 w-full border-t border-gray-100 pt-6">
            <div className="mb-2 text-sm font-bold uppercase tracking-widest text-indigo-400">Zielsprache</div>
            <h2 className="mb-4 text-3xl font-bold text-indigo-600">{card.x}</h2>
            {card.ex && <div className="mt-4 rounded-xl bg-indigo-50 p-4 text-sm italic text-gray-900"><p>{card.ex}</p>{card.exTr && <p className="mt-1 font-semibold">{card.exTr}</p>}</div>}
            <div className="mt-6 flex justify-center gap-4">
              <button type="button" onClick={(event) => { event.stopPropagation(); speak(card.de, "DE"); }} className="rounded-full bg-indigo-50 p-3 text-xl transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-indigo-500" aria-label={`${card.de} auf Deutsch vorlesen`}>🇩🇪 🔊</button>
              <button type="button" onClick={(event) => { event.stopPropagation(); speak(card.x, pack.lang); }} className="rounded-full bg-indigo-50 p-3 text-xl transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-indigo-500" aria-label={`${card.x} vorlesen`}>🎯 🔊</button>
            </div>
          </div>
        ) : <p className="mt-10 animate-pulse opacity-50">Tippe zum Aufdecken</p>}
      </div>

      {isFlipped && <div className="mt-8 flex w-full max-w-md gap-4"><button type="button" onClick={() => handleAnswer(false)} className="flex-1 rounded-2xl bg-red-100 py-4 font-bold text-red-700 transition hover:bg-red-200 focus-visible:outline-2 focus-visible:outline-red-600">Noch üben</button><button type="button" onClick={() => handleAnswer(true)} className={`flex-1 rounded-2xl bg-gradient-to-r ${gradient} py-4 font-bold text-white shadow-lg transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-indigo-500`}>Gewusst</button></div>}
    </div>
  );
}
