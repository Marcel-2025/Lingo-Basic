import { useSyncExternalStore } from "react";
import { readJson, writeJson } from "~/lib/storage";

/** Device-local learning preferences (not synced: they are about how you practise on this device). */
export interface LearningPrefs {
  /** "de-x": German on the front · "x-de": target language on the front. */
  direction: "de-x" | "x-de";
  /** Read the target-language word aloud automatically. */
  autoSpeak: boolean;
  /** Slower speech for pronunciation practice. */
  slowSpeech: boolean;
  /** Show word pictures on the cards when available. */
  showImages: boolean;
  /** Side panel open on tablets. */
  panelOpen: boolean;
}

const KEY = "lingoLearningPrefs";
const DEFAULTS: LearningPrefs = { direction: "de-x", autoSpeak: false, slowSpeech: false, showImages: true, panelOpen: true };

let current: LearningPrefs = DEFAULTS;
const listeners = new Set<() => void>();
let loaded = false;

const load = () => {
  if (loaded) return;
  loaded = true;
  void readJson<Partial<LearningPrefs>>(KEY, {}).then((stored) => {
    current = { ...DEFAULTS, ...(stored && typeof stored === "object" ? stored : {}) };
    listeners.forEach((listener) => listener());
  });
};

export const setLearningPrefs = (patch: Partial<LearningPrefs>) => {
  current = { ...current, ...patch };
  listeners.forEach((listener) => listener());
  void writeJson(KEY, current);
};

export function useLearningPrefs(): [LearningPrefs, (patch: Partial<LearningPrefs>) => void] {
  load();
  const prefs = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => current,
  );
  return [prefs, setLearningPrefs];
}
