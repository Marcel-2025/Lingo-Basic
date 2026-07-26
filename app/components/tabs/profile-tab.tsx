"use client";

import { useState } from "react";
import { Achievement, StatBox } from "@/app/components/ui";
import type { LanguagePack, LearningInsights, UserStats } from "@/app/lib/types";

interface ProfileTabProps {
  stats: UserStats;
  learningInsights: LearningInsights;
  pack: LanguagePack | null;
  gradient: string;
}

export function ProfileTab({ stats, learningInsights, pack, gradient }: ProfileTabProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const accuracy = stats.totalAnswers === 0 ? 0 : Math.round((stats.correctAnswers / stats.totalAnswers) * 100);
  const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const monthEnd = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const totalDays = monthEnd.getDate();
  const topicNames = new Map(pack?.topics.map((topic) => [topic.id, topic.title]) ?? []);
  const dayCells = Array.from({ length: firstWeekday + totalDays }, (_, index) => {
    if (index < firstWeekday) return null;
    const day = index - firstWeekday + 1;
    const dateKey = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { day, dateKey, count: learningInsights.learnedDays[dateKey] ?? 0 };
  });

  return (
    <div className="mt-4 space-y-6">
      <div className="text-center"><div className={`mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-full border-4 border-white bg-gradient-to-r ${gradient} text-5xl text-white shadow-xl`}>🦉</div><h2 className="text-3xl font-bold">Level {stats.level}</h2><p className="mt-1 opacity-70">Sprachmeister in Ausbildung</p></div>
      <div className="grid grid-cols-2 gap-4"><StatBox title="XP Gesamt" value={stats.xp} icon="⭐" /><StatBox title="Tages-Streak" value={stats.streak} icon="🔥" onClick={() => setShowCalendar((value) => !value)} /><StatBox title="Gelernte Wörter" value={stats.learnedWords} icon="📚" /><StatBox title="Genauigkeit" value={`${accuracy}%`} icon="🎯" /></div>
      {showCalendar && <div className="rounded-3xl bg-white p-6 text-gray-900 shadow-sm"><div className="mb-4 flex items-center justify-between"><button type="button" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} className="rounded-lg bg-gray-100 px-3 py-1 focus-visible:outline-2 focus-visible:outline-indigo-500" aria-label="Vorheriger Monat">←</button><h3 className="font-bold">{calendarDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</h3><button type="button" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} className="rounded-lg bg-gray-100 px-3 py-1 focus-visible:outline-2 focus-visible:outline-indigo-500" aria-label="Nächster Monat">→</button></div><div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-bold opacity-60">{["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => <div key={day}>{day}</div>)}</div><div className="grid grid-cols-7 gap-2 text-sm">{dayCells.map((cell, index) => cell ? <div key={cell.dateKey} className={`rounded-lg p-2 text-center ${cell.count > 0 ? "bg-green-100 font-bold text-green-800" : "bg-gray-50 text-gray-500"}`} title={cell.count > 0 ? `${cell.count} Lernaktivitäten` : undefined}>{cell.day}{cell.count > 1 && <span className="ml-1 text-[10px]">·{cell.count}</span>}</div> : <div key={`blank-${index}`} />)}</div></div>}
      <div className="rounded-3xl bg-white p-6 text-gray-900 shadow-sm"><h3 className="mb-4 text-lg font-bold">Gelernte Wörter nach Themen</h3><div className="space-y-4">{Object.keys(learningInsights.learnedWordsByTopic).length === 0 && <p className="text-sm opacity-70">Noch keine Wörter als gelernt markiert.</p>}{Object.entries(learningInsights.learnedWordsByTopic).map(([topicId, words]) => <div key={topicId}><h4 className="mb-2 font-bold">{topicNames.get(topicId) ?? topicId}</h4><div className="flex flex-wrap gap-2">{words.map((word) => <span key={word.id} className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{word.de}{word.x && <span className="font-normal"> · {word.x}</span>}</span>)}</div></div>)}</div></div>
      <div className="rounded-3xl bg-white p-6 text-gray-900 shadow-sm"><h3 className="mb-4 text-lg font-bold">Achievements</h3><ul className="space-y-3"><Achievement name="Erster Schritt" done={stats.xp > 0} /><Achievement name="Feuer & Flamme" done={stats.streak >= 7} subtitle="7 Tage Streak" /><Achievement name="Wortschatz" done={stats.learnedWords >= 100} subtitle="100 Wörter gelernt" /></ul></div>
    </div>
  );
}
