// The accent themes.
//
// A theme here changes the *accent* only — the caret, the cued key, buttons,
// toggles, lines and bars. It never changes the ground (`--primary`), and
// because every finger-zone colour is mixed from `--primary` alone (see
// palettes.less), no theme can move a finger colour. That is a property of
// where these values are written rather than a rule anyone has to remember.
//
// Each theme carries two hexes, not one: a day ground needs a darker, more
// saturated accent to clear contrast against near-white, and a night ground
// needs a lighter one. Both are asserted to clear 3:1 in accents.test.ts.

// "custom" is a theme the household mixed itself; it is the same shape as a
// shipped one so nothing downstream needs a second code path.
export type AccentGroup = "core" | "academic" | "kids" | "custom";

export type Accent = {
  readonly id: string;
  /** English fallback; the UI renders a translated name (see accentNames). */
  readonly name: string;
  /** The colour family, shown under the name on the chip. */
  readonly hue: string;
  readonly group: AccentGroup;
  /** Hue angle on the colour wheel, or null for the near-greys. */
  readonly deg: number | null;
  /** The accent on the night ground. */
  readonly night: string;
  /** The accent on the day ground. */
  readonly day: string;
};

/**
 * Every accent is at least 30 degrees from its neighbours on the wheel; where
 * two landed closer, one was dropped rather than shipped as a near-duplicate.
 * The two near-greys are the deliberate exception — a warm brown and a cool
 * slate are never confused however close their angles sit, so they separate by
 * chroma instead. accents.test.ts holds both rules.
 */
export const ACCENTS: readonly Accent[] = [
  // ── Core: named for the keyboard ───────────────────────────────────────
  {
    id: "keylearn",
    name: "KeyLearn",
    hue: "mint",
    group: "core",
    deg: 152,
    night: "#8fd9b6",
    day: "#2f8a5d",
  },
  {
    id: "home-row",
    name: "Home Row",
    hue: "citron",
    group: "core",
    deg: 67,
    night: "#c9d94f",
    day: "#6f7d1a",
  },
  {
    id: "top-row",
    name: "Top Row",
    hue: "indigo",
    group: "core",
    deg: 240,
    night: "#8b8bec",
    day: "#4b4bc4",
  },
  {
    id: "bottom-row",
    name: "Bottom Row",
    hue: "orchid",
    group: "core",
    deg: 319,
    night: "#e28fc8",
    day: "#b03d8e",
  },
  {
    id: "space-bar",
    name: "Space Bar",
    hue: "slate",
    group: "core",
    deg: null,
    night: "#9aa8bd",
    day: "#5a6478",
  },

  // ── Academic ───────────────────────────────────────────────────────────
  // Palettes adapted from the educator dashboard's institution presets, but
  // named for the colour and never for the institution: a colour is nobody's
  // property, so the names carry the palette and none of the trade-mark risk.
  {
    id: "persimmon",
    name: "Persimmon",
    hue: "orange",
    group: "academic",
    deg: 26,
    night: "#ff6f00",
    day: "#c25400",
  },
  {
    id: "crimson",
    name: "Crimson",
    hue: "red",
    group: "academic",
    deg: 351,
    night: "#e04a60",
    day: "#c41230",
  },
  {
    id: "amethyst",
    name: "Amethyst",
    hue: "purple",
    group: "academic",
    deg: 289,
    night: "#b44fcc",
    day: "#9b26b6",
  },
  {
    id: "cerulean",
    name: "Cerulean",
    hue: "blue",
    group: "academic",
    deg: 200,
    night: "#5fa3c4",
    day: "#3b7ea1",
  },
  {
    id: "sepia",
    name: "Sepia",
    hue: "brown",
    group: "academic",
    deg: null,
    night: "#a98274",
    day: "#6d4c41",
  },

  // ── Kids ───────────────────────────────────────────────────────────────
  // Higher chroma than the grown-up set, but only just — a shade off full
  // strength so the colour sits in the scene rather than on top of it. Spread
  // far enough apart that a child never has to compare two yellows.
  {
    id: "trail-green",
    name: "Trail Green",
    hue: "green",
    group: "kids",
    deg: 131,
    night: "#6ec97e",
    // Deeper than the night green: #3da354 measures 2.96:1 on the day ground
    // and the guard refuses it.
    day: "#369149",
  },
  {
    id: "sunbeam",
    name: "Sunbeam",
    hue: "yellow",
    group: "kids",
    deg: 47,
    night: "#f2c93f",
    // A bright yellow cannot survive a near-white ground — #d0a40c is 2.16:1.
    // The day variant is the same hue taken down to a deep gold.
    day: "#8f7000",
  },
  {
    id: "dino-blue",
    name: "Dino Blue",
    hue: "blue",
    group: "kids",
    deg: 203,
    night: "#64b0e2",
    day: "#2f87bf",
  },
  {
    id: "bubblegum",
    name: "Bubblegum",
    hue: "pink",
    group: "kids",
    deg: 331,
    night: "#f083b8",
    day: "#c9457f",
  },
  {
    id: "ember",
    name: "Ember",
    hue: "orange",
    group: "kids",
    deg: 12,
    night: "#f28a66",
    day: "#b0431c",
  },
  {
    id: "grape",
    name: "Grape",
    hue: "purple",
    group: "kids",
    deg: 262,
    night: "#b28ef0",
    day: "#6b3fc4",
  },
];

/** The accent a grown-up gets before choosing: the signature mint. */
export const DEFAULT_ACCENT = "keylearn";

/** The accent a child gets before choosing. */
export const DEFAULT_KIDS_ACCENT = "trail-green";

const byId = new Map(ACCENTS.map((accent) => [accent.id, accent]));

/** The accent with this id, or the KeyLearn default when it is unknown. */
export function findAccent(id: string | null | undefined): Accent {
  return byId.get(String(id)) ?? byId.get(DEFAULT_ACCENT)!;
}

/**
 * The accents a learner may choose from, decided by `kind` and never by the
 * page they are on. Adult and braille profiles are both `kind: "adult"`, so
 * one rule covers both — a braille learner is very often sighted or partially
 * sighted, and the one who is not loses nothing by the list being there.
 */
export function accentsFor(kind: "adult" | "kid"): readonly Accent[] {
  return kind === "kid"
    ? ACCENTS.filter((accent) => accent.group === "kids")
    : ACCENTS.filter((accent) => accent.group !== "kids");
}

/** The default accent for a learner of this kind. */
export function defaultAccentFor(kind: "adult" | "kid"): string {
  return kind === "kid" ? DEFAULT_KIDS_ACCENT : DEFAULT_ACCENT;
}

/** Whether this accent may be worn by a learner of this kind. */
export function accentAllowedFor(id: string, kind: "adult" | "kid"): boolean {
  return accentsFor(kind).some((accent) => accent.id === id);
}
