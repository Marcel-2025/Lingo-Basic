import type { SkyName, ThemeName } from "@/app/lib/types";

/**
 * Two independent choices make up the look: the accent (buttons, active tabs, highlights) and the sky
 * (background gradient). Accent colors are injected as CSS variables (NativeWind `vars`), so the Tailwind
 * classes `mint-300/400/500` follow the chosen accent everywhere without touching the screens.
 */

export const THEME_GRADIENTS: Record<ThemeName, readonly [string, string]> = {
  Ocean: ["#22d3ee", "#3ee9a8"],
  Sunset: ["#fb923c", "#f43f5e"],
  Lime: ["#a3e635", "#22c55e"],
  Grape: ["#c084fc", "#f472b6"],
};

/** soft (text on dark), main (fills), deep (tints). */
export const ACCENTS: Record<ThemeName, { soft: string; main: string; deep: string }> = {
  Ocean: { soft: "#7af5c9", main: "#3ee9a8", deep: "#1dd49a" },
  Sunset: { soft: "#fdba74", main: "#fb923c", deep: "#f97316" },
  Lime: { soft: "#bef264", main: "#a3e635", deep: "#84cc16" },
  Grape: { soft: "#f0abfc", main: "#e879f9", deep: "#d946ef" },
};

export const THEMES: ThemeName[] = ["Ocean", "Sunset", "Lime", "Grape"];

/** "#3ee9a8" → "62 233 168": the form Tailwind needs for `rgb(var(--accent) / <alpha-value>)` so opacity modifiers work. */
export const rgbChannels = (hex: string) => {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)).join(" ");
};

export interface Sky {
  /** Night gradient, top → bottom. */
  night: readonly [string, string, string, string];
  /** Day gradient, top → bottom. */
  day: readonly [string, string, string, string];
  cloud: string;
  /** Swatch shown in the settings. */
  swatch: string;
}

export const SKIES: Record<SkyName, Sky> = {
  night: { night: ["#050d2b", "#0b1f63", "#1443b5", "#1b5bd6"], day: ["#bfdbfe", "#dbeafe", "#eff6ff", "#f8fbff"], cloud: "rgba(120,170,255,0.14)", swatch: "#1443b5" },
  midnight: { night: ["#06031a", "#170b4a", "#2d1a86", "#4b2cb3"], day: ["#ddd6fe", "#ede9fe", "#f5f3ff", "#faf8ff"], cloud: "rgba(170,140,255,0.14)", swatch: "#2d1a86" },
  forest: { night: ["#02110c", "#06302a", "#0b5a4d", "#107a68"], day: ["#bbf7d0", "#d1fae5", "#ecfdf5", "#f6fffa"], cloud: "rgba(120,230,190,0.12)", swatch: "#0b5a4d" },
  dusk: { night: ["#120821", "#3a1442", "#7a2a55", "#c2473f"], day: ["#fed7aa", "#ffe4e6", "#fff1f2", "#fff8f6"], cloud: "rgba(255,170,140,0.14)", swatch: "#7a2a55" },
  rose: { night: ["#1a0612", "#4a1034", "#8a1e5c", "#b8336a"], day: ["#fbcfe8", "#fce7f3", "#fdf2f8", "#fff7fb"], cloud: "rgba(255,150,210,0.14)", swatch: "#8a1e5c" },
  graphite: { night: ["#07080c", "#15181f", "#262b36", "#3a4150"], day: ["#e2e8f0", "#eef2f7", "#f8fafc", "#ffffff"], cloud: "rgba(200,210,230,0.10)", swatch: "#262b36" },
};

export const SKY_NAMES: SkyName[] = ["night", "midnight", "forest", "dusk", "rose", "graphite"];
