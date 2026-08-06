// Generated profile avatars: a small abstract painting per learner.
//
// An avatar is a family and one integer. Everything else — the palette, every
// coordinate, the texture laid over the top — is derived from that seed, so
// the picture is a couple of bytes rather than an image: identical on every
// device, correct in the server-rendered first paint, and crisp at any size.
//
// The families take their cue from movements rather than canvases. Nothing
// here reproduces a painting and none is named after a painter.

export type ArtPalette = {
  readonly ground: string;
  readonly wash: readonly [string, string, string];
  readonly ink: string;
};

/**
 * Muted, for grown-ups. Loosely sampled from well-known paintings, in the same
 * spirit as the account identicon palettes this sits beside.
 */
export const ADULT_ART_PALETTES: readonly ArtPalette[] = [
  {
    ground: "#dce9e2",
    wash: ["#a9c7b6", "#b7c9e2", "#d9c2d8"],
    ink: "#44605c",
  },
  {
    ground: "#d9e7e4",
    wash: ["#a5cec6", "#f0c9d4", "#f6e7d3"],
    ink: "#3f6059",
  },
  {
    ground: "#dfe4ef",
    wash: ["#9fb3d9", "#c8b6e0", "#f2dfa8"],
    ink: "#3d4a6b",
  },
  {
    ground: "#f0e6d8",
    wash: ["#e2b98f", "#c9a3b8", "#9fbcae"],
    ink: "#6b513a",
  },
  {
    ground: "#e8e4dd",
    wash: ["#c2a58c", "#9aa9a0", "#d4c3a5"],
    ink: "#5c5245",
  },
  {
    ground: "#e6e9ea",
    wash: ["#9ab3bd", "#d5b9a8", "#b6c3a4"],
    ink: "#47585f",
  },
  {
    ground: "#efe4e6",
    wash: ["#d9a9ae", "#b0b8d6", "#e8d3a9"],
    ink: "#6b4750",
  },
  {
    ground: "#e3e8dd",
    wash: ["#a8bd94", "#d8c9a0", "#a9b8cd"],
    ink: "#4d5a42",
  },
];

/**
 * Brighter, for children. A kid's avatar sits beside a dinosaur running
 * through a forest rather than beside a statistics table, and the muted set
 * simply disappears there. The lettered avatars already split on exactly this
 * reasoning (see KID_AVATAR_PRESETS).
 */
export const KID_ART_PALETTES: readonly ArtPalette[] = [
  {
    ground: "#fff1cc",
    wash: ["#ffb03b", "#ff7a5c", "#ffd447"],
    ink: "#8a4b12",
  },
  {
    ground: "#ddf5e3",
    wash: ["#3fce7a", "#7ee08f", "#2bb0a6"],
    ink: "#1c6b45",
  },
  {
    ground: "#dcefff",
    wash: ["#3fa9f5", "#6fd4f0", "#7b8cf0"],
    ink: "#1b4f8a",
  },
  {
    ground: "#ffe4f0",
    wash: ["#ff6fae", "#ff9ecb", "#c86fe0"],
    ink: "#8a2f5e",
  },
  {
    ground: "#eee6ff",
    wash: ["#9a6ff0", "#c07ef0", "#6f8cf0"],
    ink: "#4a2b8a",
  },
  {
    ground: "#fdeede",
    wash: ["#ff8a3d", "#ffc247", "#ff6b6b"],
    ink: "#8a4420",
  },
  {
    ground: "#e2fbf3",
    wash: ["#2fd6b0", "#7ff0d0", "#3fb0e0"],
    ink: "#146b5a",
  },
  {
    ground: "#fff6d6",
    wash: ["#f5c518", "#ffdf5c", "#a8d84a"],
    ink: "#7a5e10",
  },
];

export type ArtKind = "adult" | "kid";

export type ArtFamily = {
  readonly id: string;
  /** English fallback; the UI renders a translated name. */
  readonly name: string;
};

export const ADULT_ART_FAMILIES: readonly ArtFamily[] = [
  { id: "grid", name: "Grid" },
  { id: "flow", name: "Flow" },
  { id: "arc", name: "Arc" },
  { id: "bars", name: "Bars" },
  { id: "coil", name: "Coil" },
  { id: "bloom", name: "Bloom" },
];

export const KID_ART_FAMILIES: readonly ArtFamily[] = [
  { id: "bubbles", name: "Bubbles" },
  { id: "splat", name: "Splat" },
  { id: "zigzag", name: "Zigzag" },
  { id: "swirl", name: "Swirl" },
  { id: "ripple", name: "Ripple" },
  { id: "stars", name: "Stars" },
];

export function artPalettes(kind: ArtKind): readonly ArtPalette[] {
  return kind === "kid" ? KID_ART_PALETTES : ADULT_ART_PALETTES;
}

export function artFamilies(kind: ArtKind): readonly ArtFamily[] {
  return kind === "kid" ? KID_ART_FAMILIES : ADULT_ART_FAMILIES;
}

/** The family a learner falls back to when the stored one is unknown. */
export function defaultArtFamily(kind: ArtKind): string {
  return artFamilies(kind)[0].id;
}

export function isArtFamily(id: string, kind: ArtKind): boolean {
  return artFamilies(kind).some((family) => family.id === id);
}

/**
 * Which set a family belongs to. Every id lives in exactly one list, so an
 * avatar is self-describing: the renderer works out the palette set from the
 * family rather than trusting every call site to pass the learner's kind. A
 * call site that forgot would otherwise draw a different painting — the family
 * would miss the lookup, fall back, and the avatar would change identity
 * between the drawer and the profile page.
 */
export function artKindOf(family: string): ArtKind | null {
  if (KID_ART_FAMILIES.some((item) => item.id === family)) {
    return "kid";
  }
  if (ADULT_ART_FAMILIES.some((item) => item.id === family)) {
    return "adult";
  }
  return null;
}

/**
 * Deterministic PRNG. The same seed always draws the same picture, which is
 * the whole reason a seed can be stored instead of an image — and why nothing
 * in here may reach for Math.random.
 */
/**
 * The palette a given avatar is painted in.
 *
 * The palette is the first value off the seeded stream, before any geometry,
 * so this replays exactly what {@link ProfileArt} drew. Anything that wants to
 * colour itself to agree with somebody's avatar — the share card picks its
 * headline colour this way — asks here rather than guessing.
 */
export function artPaletteOf(family: string, seed: number): ArtPalette {
  const palettes = artPalettes(artKindOf(family) ?? "adult");
  return palettes[(artRandom(seed)() * palettes.length) | 0];
}

export function artRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh seed for a new learner, or for the shuffle button. */
export function newArtSeed(): number {
  return (Math.random() * 0x7fffffff) | 0;
}

/**
 * A stable seed for a learner who has no avatar yet. Deriving it from the name
 * means the first painting they are shown is already theirs rather than a
 * flicker of something random, and it is the same one on every device until
 * somebody presses shuffle.
 */
export function artSeedFromName(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 0x7fffffff;
}
