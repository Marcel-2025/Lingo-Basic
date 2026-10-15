import type { ThemeName } from "@/app/lib/types";

/** Same four accent gradients as the web app (Tailwind from-/to- colors). Themes only tint accents; cards stay light. */
export const THEME_GRADIENTS: Record<ThemeName, readonly [string, string]> = {
  Ocean: ["#3b82f6", "#22d3ee"],
  Sunset: ["#f97316", "#ef4444"],
  Lime: ["#22c55e", "#a3e635"],
  Grape: ["#a855f7", "#ec4899"],
};

export const THEMES: ThemeName[] = ["Ocean", "Sunset", "Lime", "Grape"];
