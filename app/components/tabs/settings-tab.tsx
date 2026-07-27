"use client";

import { useRef, useState } from "react";
import { FREE_DAILY_LEARNING_LIMIT } from "@/app/lib/billing";
import { SUPPORTED_LANGUAGES, SUPPORTED_LEVELS } from "@/app/lib/languages";
import type { AppSettings, EntitlementState, LanguagePack } from "@/app/lib/types";

interface SettingsTabProps {
  settings: AppSettings;
  gradient: string;
  updateSettings: (updater: (previous: AppSettings) => AppSettings) => void;
  reloadPack: () => Promise<void>;
  clearCurrentCache: () => Promise<void>;
  importPack: (input: unknown, source?: "import" | "network") => Promise<{ pack: LanguagePack; warnings: string[] }>;
  entitlement: EntitlementState;
  onUpgrade: () => void;
}

export function SettingsTab({ settings, gradient, updateSettings, reloadPack, clearCurrentCache, importPack, entitlement, onUpgrade }: SettingsTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const setSetting = <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => updateSettings((previous) => ({ ...previous, [key]: value }));

  const importContent = async (input: unknown, source: "import" | "network") => {
    setIsBusy(true);
    try {
      const { pack, warnings } = await importPack(input, source);
      updateSettings((previous) => ({ ...previous, targetLang: pack.lang, contentLevel: pack.level }));
      setMessage(warnings[0] ?? `Paket ${pack.lang} ${pack.level} wurde gespeichert.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Das Sprachpaket konnte nicht importiert werden.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        void importContent(JSON.parse(String(reader.result)), "import");
      } catch {
        setMessage("Die ausgewählte Datei enthält kein gültiges JSON.");
      }
    };
    reader.onerror = () => setMessage("Die ausgewählte Datei konnte nicht gelesen werden.");
    reader.readAsText(file);
  };

  const loadFromUrl = async () => {
    if (!url) return;
    setIsBusy(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Die URL konnte nicht geladen werden.");
      await importContent(await response.json(), "network");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Das Sprachpaket konnte nicht von der URL geladen werden.");
      setIsBusy(false);
    }
  };

  const clearCache = async () => {
    setIsBusy(true);
    try {
      await clearCurrentCache();
      setMessage(`Der Cache für ${settings.targetLang} ${settings.contentLevel} wurde erneuert.`);
    } catch {
      setMessage("Der Cache konnte nicht gelöscht werden.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-6 pb-10">
      <h2 className="mb-6 text-3xl font-bold">Einstellungen</h2>
      <section className="rounded-3xl bg-white p-6 text-gray-900 shadow-sm">
        <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-wide text-indigo-600">Lingo Premium</p><h3 className="mt-1 text-xl font-bold">{entitlement.isPremium ? "Premium ist aktiv" : entitlement.isAdFree ? "Werbefrei ist aktiv" : "Kostenloser Lernplan"}</h3><p className="mt-2 text-sm text-gray-600">{entitlement.isPremium ? "Du kannst unbegrenzt lernen und alle Level verwenden." : `${FREE_DAILY_LEARNING_LIMIT} kostenlose Lernschritte pro Tag, A1 und alle Basisfunktionen.`}</p></div><span className="text-3xl" aria-hidden="true">👑</span></div>
        {!entitlement.isPremium && <button type="button" onClick={onUpgrade} className={`mt-5 w-full rounded-xl bg-gradient-to-r ${gradient} py-3 font-bold text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500`}>Premium freischalten</button>}
      </section>
      <section className="space-y-4 rounded-3xl bg-white p-6 text-gray-900 shadow-sm">
        <div><label className="mb-2 block text-sm font-bold opacity-70" htmlFor="target-language">Zielsprache</label><select id="target-language" className="w-full rounded-xl bg-gray-100 p-3 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" value={settings.targetLang} onChange={(event) => setSetting("targetLang", event.target.value as AppSettings["targetLang"])}>{Object.entries(SUPPORTED_LANGUAGES).map(([code, language]) => <option key={code} value={code}>{language.label}</option>)}</select></div>
        <div><label className="mb-2 block text-sm font-bold opacity-70" htmlFor="content-level">Content-Level</label><select id="content-level" disabled={!entitlement.isPremium} className="w-full rounded-xl bg-gray-100 p-3 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60" value={entitlement.isPremium ? settings.contentLevel : "A1"} onChange={(event) => setSetting("contentLevel", event.target.value as AppSettings["contentLevel"])}>{SUPPORTED_LEVELS.map((level) => <option key={level} value={level} disabled={!entitlement.isPremium && level !== "A1"}>{level}{level === "A1" ? " · Kostenlos" : " · Premium"}</option>)}</select><p className="mt-2 text-xs opacity-60">{entitlement.isPremium ? "Nicht vorhandene Level werden klar als noch nicht verfügbar angezeigt." : "A2 und B1 werden mit Premium freigeschaltet."}</p></div>
        <div><label className="mb-2 block text-sm font-bold opacity-70" htmlFor="difficulty">Lernmodus</label><select id="difficulty" className="w-full rounded-xl bg-gray-100 p-3 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" value={settings.difficulty} onChange={(event) => setSetting("difficulty", event.target.value === "all" ? "all" : Number(event.target.value) as 1 | 2 | 3)}><option value="all">Alle Schwierigkeiten</option><option value="1">Einfach</option><option value="2">Mittel</option><option value="3">Schwer</option></select></div>
        <div><label className="mb-2 block text-sm font-bold opacity-70" htmlFor="daily-goal">Tagesziel (Karten)</label><input id="daily-goal" type="number" min="1" max="200" disabled={!entitlement.isPremium} value={entitlement.isPremium ? settings.dailyGoal : FREE_DAILY_LEARNING_LIMIT} onChange={(event) => setSetting("dailyGoal", Math.max(1, Number(event.target.value) || 1))} className="w-full rounded-xl bg-gray-100 p-3 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60" />{!entitlement.isPremium && <p className="mt-2 text-xs opacity-60">Premium erlaubt ein eigenes Tagesziel und unbegrenztes Lernen.</p>}</div>
        <div><p className="mb-2 text-sm font-bold opacity-70">Farbschema</p><div className="flex gap-2">{(["Ocean", "Sunset", "Lime", "Grape"] as const).map((theme) => <button key={theme} type="button" onClick={() => setSetting("theme", theme)} className={`flex-1 rounded-lg bg-gray-100 py-2 text-sm font-bold text-gray-900 focus-visible:outline-2 focus-visible:outline-indigo-500 ${settings.theme === theme ? "ring-2 ring-indigo-500" : "opacity-50"}`}>{theme}</button>)}</div></div>
        <div className="flex items-center justify-between pt-2"><span className="font-bold opacity-70">Dark Mode</span><button type="button" onClick={() => setSetting("isDarkMode", !settings.isDarkMode)} className={`h-8 w-14 rounded-full p-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${settings.isDarkMode ? `bg-gradient-to-r ${gradient}` : "bg-gray-300"}`} aria-pressed={settings.isDarkMode}><span className={`block h-6 w-6 rounded-full bg-white shadow-md transition-transform ${settings.isDarkMode ? "translate-x-6" : ""}`} /></button></div>
      </section>
      <section className="space-y-4 rounded-3xl bg-white p-6 text-gray-900 shadow-sm"><h3 className="text-lg font-bold">Inhalte verwalten</h3><div><p className="mb-2 text-sm font-bold opacity-70">Pack aus diesem Projekt laden</p><button type="button" disabled={isBusy} onClick={() => void reloadPack()} className={`w-full rounded-xl bg-gradient-to-r ${gradient} py-3 font-bold text-white disabled:cursor-wait disabled:opacity-60`}>Pack für {settings.targetLang} {entitlement.isPremium ? settings.contentLevel : "A1"} laden</button></div><div><p className="mb-2 text-sm font-bold opacity-70">Aus JSON-Datei importieren</p><input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleFileUpload} className="hidden" /><button type="button" disabled={isBusy} onClick={() => fileInputRef.current?.click()} className="w-full rounded-xl bg-gray-100 py-3 font-semibold text-gray-900 disabled:opacity-60">Datei auswählen</button></div><div><p className="mb-2 text-sm font-bold opacity-70">Von URL importieren</p><div className="flex gap-2"><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…/a1.json" className="min-w-0 flex-1 rounded-xl bg-gray-100 p-3 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" /><button type="button" disabled={isBusy || !url} onClick={() => void loadFromUrl()} className={`rounded-xl bg-gradient-to-r ${gradient} px-4 font-bold text-white disabled:opacity-60`}>Laden</button></div></div><button type="button" disabled={isBusy} onClick={() => void clearCache()} className="mt-4 w-full rounded-xl bg-red-50 py-3 font-bold text-red-600 disabled:opacity-60">Cache für dieses Level erneuern</button>{message && <p role="status" className="text-sm font-semibold text-indigo-700">{message}</p>}</section>
    </div>
  );
}
