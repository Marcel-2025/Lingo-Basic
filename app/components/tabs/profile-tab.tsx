"use client";

import { useState } from "react";
import { Achievement, StatBox } from "@/app/components/ui";
import { SUPPORTED_LANGUAGES } from "@/app/lib/languages";
import { getDateKey } from "@/app/lib/utils";
import type { LanguagePack, LearningInsights, UserStats } from "@/app/lib/types";

interface ProfileTabProps {
  stats: UserStats;
  learningInsights: LearningInsights;
  pack: LanguagePack | null;
  gradient: string;
  timeZone: string;
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Readable fallback for topics that are not part of the currently loaded pack (e.g. another level). */
const humanizeTopicId = (topicId: string) =>
  topicId.replace(/_\d+$/, "").replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());

export function ProfileTab({ stats, learningInsights, pack, gradient, timeZone }: ProfileTabProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const accuracy = stats.totalAnswers === 0 ? 0 : Math.round((stats.correctAnswers / stats.totalAnswers) * 100);
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();
  const todayKey = getDateKey(new Date(), timeZone);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const dayCells = Array.from({ length: firstWeekday + totalDays }, (_, index) => {
    if (index < firstWeekday) return null;
    const day = index - firstWeekday + 1;
    const dateKey = `${monthPrefix}${String(day).padStart(2, "0")}`;
    return { day, dateKey, count: learningInsights.learnedDays[dateKey] ?? 0 };
  });
  const activeDaysInMonth = dayCells.filter((cell) => cell && cell.count > 0).length;
  const activitiesInMonth = dayCells.reduce((sum, cell) => sum + (cell?.count ?? 0), 0);
  const isCurrentMonth = todayKey.startsWith(monthPrefix);
  const topicNames = new Map(pack?.topics.map((topic) => [topic.id, `${topic.icon ? `${topic.icon} ` : ""}${topic.title}`]) ?? []);
  const topicEntries = Object.entries(learningInsights.learnedWordsByTopic).filter(([, words]) => words.length > 0);
  const totalActiveDays = Object.keys(learningInsights.learnedDays).length;

  return (
    <div className="mt-4 space-y-6">
      <div className="text-center"><div className={`mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-full border-4 border-white bg-gradient-to-r ${gradient} text-5xl text-white shadow-xl`}>🦉</div><h2 className="text-3xl font-bold">Level {stats.level}</h2><p className="mt-1 opacity-70">Sprachmeister in Ausbildung</p></div>
      <div className="grid grid-cols-2 gap-4">
        <StatBox title="XP Gesamt" value={stats.xp} icon="⭐" />
        <StatBox title={showCalendar ? "Kalender schließen" : "Tages-Streak · Kalender"} value={stats.streak} icon="🔥" onClick={() => setShowCalendar((value) => !value)} ariaExpanded={showCalendar} />
        <StatBox title="Gelernte Wörter" value={stats.learnedWords} icon="📚" />
        <StatBox title="Genauigkeit" value={`${accuracy}%`} icon="🎯" />
      </div>
      {showCalendar && (
        <section className="rounded-3xl bg-white p-6 text-gray-900 shadow-sm" aria-label="Lernkalender">
          <div className="mb-4 flex items-center justify-between">
            <button type="button" onClick={() => setCalendarDate(new Date(year, month - 1, 1))} className="rounded-lg bg-gray-100 px-3 py-2 focus-visible:outline-2 focus-visible:outline-indigo-500" aria-label="Vorheriger Monat">←</button>
            <h3 className="font-bold">{calendarDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</h3>
            <button type="button" onClick={() => setCalendarDate(new Date(year, month + 1, 1))} disabled={isCurrentMonth} className="rounded-lg bg-gray-100 px-3 py-2 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-40" aria-label="Nächster Monat">→</button>
          </div>
          <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-bold text-gray-500">{WEEKDAYS.map((day) => <div key={day}>{day}</div>)}</div>
          <div className="grid grid-cols-7 gap-2 text-sm">
            {dayCells.map((cell, index) => cell ? (
              <div
                key={cell.dateKey}
                className={`rounded-lg p-2 text-center ${cell.count > 0 ? "bg-green-100 font-bold text-green-800" : "bg-gray-50 text-gray-500"} ${cell.dateKey === todayKey ? "ring-2 ring-indigo-400" : ""}`}
                title={cell.count > 0 ? `${cell.count} Lernaktivitäten` : undefined}
                aria-label={`${cell.day}. ${cell.count > 0 ? `${cell.count} Lernaktivitäten` : "keine Aktivität"}`}
              >
                {cell.day}{cell.count > 1 && <span className="block text-[10px] font-semibold leading-none">{cell.count}×</span>}
              </div>
            ) : <div key={`blank-${index}`} />)}
          </div>
          <p className="mt-4 text-xs text-gray-600">{activeDaysInMonth} Lerntage · {activitiesInMonth} Aktivitäten in diesem Monat · {totalActiveDays} Lerntage insgesamt</p>
          <button type="button" onClick={() => setCalendarDate(new Date())} className="mt-2 text-xs font-bold text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-500">Zum aktuellen Monat</button>
        </section>
      )}
      <section className="rounded-3xl bg-white p-6 text-gray-900 shadow-sm">
        <h3 className="mb-4 text-lg font-bold">Gelernte Wörter nach Themen</h3>
        <div className="space-y-4">
          {topicEntries.length === 0 && <p className="text-sm text-gray-600">Noch keine Wörter als gelernt markiert. Tippe bei einer Lernkarte auf „Gewusst“.</p>}
          {topicEntries.map(([topicId, words]) => (
            <div key={topicId}>
              <h4 className="mb-2 font-bold">{topicNames.get(topicId) ?? humanizeTopicId(topicId)} <span className="text-xs font-semibold text-gray-500">({words.length})</span></h4>
              <div className="flex flex-wrap gap-2">
                {words.map((word) => (
                  <span key={`${word.lang ?? "legacy"}:${word.id}`} className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-800">
                    {word.de}{word.x && <span className="font-normal"> · {word.x}</span>}
                    {word.lang && word.lang !== pack?.lang && <span className="ml-1 rounded bg-white px-1 text-[10px] text-gray-600" title={SUPPORTED_LANGUAGES[word.lang].label}>{word.lang}</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-3xl bg-white p-6 text-gray-900 shadow-sm">
        <h3 className="mb-4 text-lg font-bold">Achievements</h3>
        <ul className="space-y-3">
          <Achievement name="Erster Schritt" done={stats.xp > 0} subtitle="Erste XP gesammelt" />
          <Achievement name="Dranbleiben" done={stats.streak >= 3} subtitle="3 Tage Streak" />
          <Achievement name="Feuer & Flamme" done={stats.streak >= 7} subtitle="7 Tage Streak" />
          <Achievement name="Treffsicher" done={stats.totalAnswers >= 20 && accuracy >= 80} subtitle="80 % Genauigkeit bei mindestens 20 Antworten" />
          <Achievement name="Wortschatz" done={stats.learnedWords >= 100} subtitle="100 Wörter gelernt" />
        </ul>
      </section>
    </div>
  );
}
