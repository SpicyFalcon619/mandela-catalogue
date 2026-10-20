/** Visitor preferences. Safe to import from client and server code. */
export const THEMES: { id: string; label: string }[] = [
  { id: "tape", label: "Tape (VCR blue and red)" },
  { id: "phosphor", label: "Phosphor green" },
  { id: "amber", label: "Amber terminal" },
  { id: "mono", label: "Monochrome" },
  { id: "paper", label: "Paper file (light)" },
];
export const FX_LEVELS = [
  { id: "full", label: "Full: static, tracking band, glitch text" },
  { id: "low", label: "Low: scanlines only" },
  { id: "off", label: "Off: no effects" },
] as const;
export const FONTS = [
  { id: "vcr", label: "VCR display + mono" },
  { id: "typewriter", label: "Typewriter" },
  { id: "clean", label: "Clean sans" },
] as const;
export const SIZES = [
  { id: "sm", label: "Small" },
  { id: "md", label: "Medium" },
  { id: "lg", label: "Large" },
] as const;

export type Prefs = {
  theme: string;
  fx: "full" | "low" | "off";
  font: "vcr" | "typewriter" | "clean";
  size: "sm" | "md" | "lg";
  spoilers: boolean;
  shelf: "grid" | "list";
};

export const PREFS_COOKIE = "mc_prefs";

export function defaultPrefs(theme = "tape"): Prefs {
  return { theme, fx: "full", font: "vcr", size: "md", spoilers: false, shelf: "grid" };
}

export function sanitizePrefs(input: unknown, base: Prefs): Prefs {
  const x = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
    typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  return {
    theme: pick(x.theme, THEMES.map((t) => t.id), base.theme),
    fx: pick(x.fx, ["full", "low", "off"] as const, base.fx),
    font: pick(x.font, ["vcr", "typewriter", "clean"] as const, base.font),
    size: pick(x.size, ["sm", "md", "lg"] as const, base.size),
    spoilers: typeof x.spoilers === "boolean" ? x.spoilers : base.spoilers,
    shelf: pick(x.shelf, ["grid", "list"] as const, base.shelf),
  };
}
