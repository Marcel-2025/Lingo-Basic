"use client";

import { useRef, useState } from "react";
import { SUPPORTED_LANGUAGES, SUPPORTED_LEVELS } from "@/app/lib/languages";
import type { AppSettings, LanguagePack, PackLoadState, PackOrigin } from "@/app/lib/types";

const URL_IMPORT_TIMEOUT_MS = 15_000;

interface SettingsTabProps {
  settings: AppSettings;
  gradient: string;
  loadState: PackLoadState;
  updateSettings: (updater: (previous: AppSettings) => AppSettings) => void;
  reloadPack: () => Promise<void>;
  clearCurrentCache: () => Promise<void>;
  clearAllCaches: () => Promise<void>;
  importPack: (input: unknown, origin?: PackOrigin) => Promise<{ pack: LanguagePack; warnings: string[] }>;
}

const SOURCE_LABELS: Record<NonNullable<PackLoadState["source"]>, string> = {
  network: "aus dem Projekt geladen",
  cache: "aus dem Offline-Speicher",
  legacy: "Legacy-Pack",
  import: "importiertes Pack",
};

interface ToggleProps {
  label: string;
  checked: boolean;
  gradient: string;
  onChange: (value: boolean) => void;
}

function Toggle({ label, checked, gradient, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between pt-2">
      <span className="font-bold opacity-70">{label}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`h-8 w-14 rounded-full p-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${checked ? `bg-gradient-to-r ${gradient}` : "bg-gray-300"}`}>
        <span className={`block h-6 w-6 rounded-full bg-white shadow-md transition-transform ${checked ? "translate-x-6" : ""}`} />
      </button>
    </div>
  );
}

export function SettingsTab({ settings, gradient, loadState, updateSettings, reloadPack, clearCurrentCache, clearAllCaches, importPack }: SettingsTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const setSetting = <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => updateSettings((previous) => ({ ...previous, [key]: value }));

  const runBusy = async (action: () => Promise<void>) => {
    setIsBusy(true);
    try {
      await action();
    } finally {
      setIsBusy(false);
    }
  };

  const importContent = async (input: unknown) => {
    setIsBusy(true);
    try {
      const { pack, warnings } = await importPack(input, "import");
      updateSettings((previous) => ({ ...previous, targetLang: pack.lang, contentLevel: pack.level }));
      const warningText = warnings.length > 0 ? ` ${warnings.length} Hinweis(e), z. B.: ${warnings[0]}` : "";
      setMessage(`Paket ${SUPPORTED_LANGUAGES[pack.lang].label} ${pack.level} wurde validiert und offline gespeichert.${warningText}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Das Sprachpaket konnte nicht importiert werden.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let json: unknown;
      try {
        json = JSON.parse(String(reader.result));
      } catch {
        setMessage(`„${file.name}“ enthält kein gültiges JSON.`);
        return;
      }
      void importContent(json);
    };
    reader.onerror = () => setMessage("Die ausgewählte Datei konnte nicht gelesen werden.");
    reader.readAsText(file);
  };

  const loadFromUrl = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    setIsBusy(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), URL_IMPORT_TIMEOUT_MS);
    let json: unknown;
    try {
      const response = await fetch(trimmedUrl, { signal: controller.signal });
      if (!response.ok) throw new Error(`Die URL antwortet mit HTTP ${response.status}.`);
      try {
        json = await response.json();
      } catch {
        throw new Error("Die URL liefert kein gültiges JSON.");
      }
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      setMessage(aborted ? "Zeitüberschreitung beim Laden der URL." : error instanceof TypeError ? "Die URL ist nicht erreichbar (offline oder CORS blockiert)." : error instanceof Error ? error.message : "Das Sprachpaket konnte nicht von der URL geladen werden.");
      setIsBusy(false);
      return;
    } finally {
      window.clearTimeout(timeoutId);
    }
    await importContent(json);
  };

  const reload = () => runBusy(async () => {
    await reloadPack();
    setMessage(`Pack für ${SUPPORTED_LANGUAGES[settings.targetLang].label} ${settings.contentLevel} wurde neu geladen.`);
  });

  const clearCache = () => runBusy(async () => {
    try {
      await clearCurrentCache();
      setMessage(`Der Cache für ${SUPPORTED_LANGUAGES[settings.targetLang].label} ${settings.contentLevel} wurde gelöscht und neu geladen.`);
    } catch {
      setMessage("Der Cache konnte nicht gelöscht werden.");
    }
  });

  const clearAll = () => runBusy(async () => {
    try {
      await clearAllCaches();
      setMessage("Alle gespeicherten und importierten Packs wurden gelöscht.");
    } catch {
      setMessage("Der Offline-Speicher konnte nicht gelöscht werden.");
    }
  });

  return (
    <div className="mt-4 space-y-6 pb-10">
      <h2 className="mb-6 text-3xl font-bold">Einstellungen</h2>
      <section className="space-y-4 rounded-3xl bg-white p-6 text-gray-900 shadow-sm">
        <div><label className="mb-2 block text-sm font-bold opacity-70" htmlFor="target-language">Zielsprache</label><select id="target-language" className="w-full rounded-xl bg-gray-100 p-3 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" value={settings.targetLang} onChange={(event) => setSetting("targetLang", event.target.value as AppSettings["targetLang"])}>{Object.entries(SUPPORTED_LANGUAGES).map(([code, language]) => <option key={code} value={code}>{language.label}</option>)}</select></div>
        <div><label className="mb-2 block text-sm font-bold opacity-70" htmlFor="content-level">Content-Level</label><select id="content-level" className="w-full rounded-xl bg-gray-100 p-3 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" value={settings.contentLevel} onChange={(event) => setSetting("contentLevel", event.target.value as AppSettings["contentLevel"])}>{SUPPORTED_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}</select><p className={`mt-2 text-xs font-semibold ${loadState.status === "error" ? "text-red-700" : "text-gray-600"}`} role="status" aria-live="polite">{loadState.status === "loading" ? "Pack wird geladen…" : loadState.status === "error" ? loadState.message : loadState.status === "ready" ? `✓ Verfügbar${loadState.source ? ` · ${SOURCE_LABELS[loadState.source]}` : ""}` : ""}</p></div>
        <div><label className="mb-2 block text-sm font-bold opacity-70" htmlFor="difficulty">Lernmodus</label><select id="difficulty" className="w-full rounded-xl bg-gray-100 p-3 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" value={settings.difficulty} onChange={(event) => setSetting("difficulty", event.target.value === "all" ? "all" : Number(event.target.value) as 1 | 2 | 3)}><option value="all">Alle Schwierigkeiten</option><option value="1">Einfach</option><option value="2">Mittel</option><option value="3">Schwer</option></select></div>
        <div><label className="mb-2 block text-sm font-bold opacity-70" htmlFor="daily-goal">Tagesziel (Karten)</label><input id="daily-goal" type="number" min="1" max="200" value={settings.dailyGoal} onChange={(event) => setSetting("dailyGoal", Math.min(200, Math.max(1, Number(event.target.value) || 1)))} className="w-full rounded-xl bg-gray-100 p-3 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" /></div>
        <div><p className="mb-2 text-sm font-bold opacity-70">Farbschema</p><div className="flex gap-2">{(["Ocean", "Sunset", "Lime", "Grape"] as const).map((theme) => <button key={theme} type="button" onClick={() => setSetting("theme", theme)} className={`flex-1 rounded-lg bg-gray-100 py-2 text-sm font-bold text-gray-900 focus-visible:outline-2 focus-visible:outline-indigo-500 ${settings.theme === theme ? "ring-2 ring-indigo-500" : "opacity-50"}`}>{theme}</button>)}</div></div>
        <Toggle label="Dark Mode" checked={settings.isDarkMode} gradient={gradient} onChange={(value) => setSetting("isDarkMode", value)} />
        <Toggle label="Feedback-Töne" checked={settings.soundEnabled} gradient={gradient} onChange={(value) => setSetting("soundEnabled", value)} />
        <Toggle label="Vibration" checked={settings.vibrationEnabled} gradient={gradient} onChange={(value) => setSetting("vibrationEnabled", value)} />
      </section>
      <section className="space-y-4 rounded-3xl bg-white p-6 text-gray-900 shadow-sm"><h3 className="text-lg font-bold">Inhalte verwalten</h3><div><p className="mb-2 text-sm font-bold opacity-70">Pack aus diesem Projekt laden</p><button type="button" disabled={isBusy} onClick={() => void reload()} className={`w-full rounded-xl bg-gradient-to-r ${gradient} py-3 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-wait disabled:opacity-60`}>Pack für {SUPPORTED_LANGUAGES[settings.targetLang].label} {settings.contentLevel} laden</button><p className="mt-1 text-xs opacity-60">Ersetzt ein importiertes Pack für dieses Level durch die Projektversion.</p></div><div><p className="mb-2 text-sm font-bold opacity-70">Aus JSON-Datei importieren</p><input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleFileUpload} className="hidden" /><button type="button" disabled={isBusy} onClick={() => fileInputRef.current?.click()} className="w-full rounded-xl bg-gray-100 py-3 font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-60">Datei auswählen</button></div><div><p className="mb-2 text-sm font-bold opacity-70">Von URL importieren</p><div className="flex gap-2"><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…/a1.json" className="min-w-0 flex-1 rounded-xl bg-gray-100 p-3 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" /><button type="button" disabled={isBusy || !url} onClick={() => void loadFromUrl()} className={`rounded-xl bg-gradient-to-r ${gradient} px-4 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-60`}>{isBusy ? "…" : "Laden"}</button></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" disabled={isBusy} onClick={() => void clearCache()} className="w-full rounded-xl bg-red-50 py-3 font-bold text-red-700 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-60">Cache für dieses Level löschen</button><button type="button" disabled={isBusy} onClick={() => void clearAll()} className="w-full rounded-xl bg-red-50 py-3 font-bold text-red-700 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-60">Alle Packs löschen</button></div>{message && <p role="status" className="text-sm font-semibold text-indigo-700">{message}</p>}</section>
    </div>
  );
}
