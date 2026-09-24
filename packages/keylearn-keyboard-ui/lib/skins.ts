/**
 * The two alternative keysets, ported verbatim from the approved mock.
 *
 * Every number here — lip depth, inset, radius, foreshortening, each gradient
 * stop — is the value the mock was signed off with. They are data, not
 * suggestions: if the rendered board disagrees with the mock, this file or the
 * renderer beside it is wrong, not the mock.
 *
 * Deliberately NOT re-derived in terms of the existing KeyLearn key styles.
 * That is what produced a board which was approximately right and never
 * exactly right.
 */

export type Geom = {
  /** Visible wall below the cap face. */
  readonly lip: number;
  /** Horizontal inset of the face inside the cap body. */
  readonly faceInX: number;
  readonly rxBase: number;
  readonly rxFace: number;
  /** Vertical squash applied to legends, per row, far to near. */
  readonly rowSquash: readonly number[];
  /** Cap shadow. */
  readonly shDy: number;
  readonly shOp: number;
  /** How far the face travels on a press, as a fraction of the lip. */
  readonly travel: number;
  readonly dish: boolean;
  /** Legends sit high on the cap and pairs go side by side. */
  readonly topLegends: boolean;
  /** Fallback squash for a row the table does not cover. */
  readonly foreshorten: number;

  /* ── round-cap fields ─────────────────────────────────────────────
     Only ROUND sets these; MECH and FLAT leave them undefined and the
     renderer skips the whole branch. Every number is in MOCK_CAP units —
     see the constant below. */

  /** Caps are circles (1u) and stadiums (wider): rx is half the height. */
  readonly round?: boolean;
  /** How far the cap sinks, in MOCK_CAP units. Absolute, not a fraction of
      the lip: 62% of a 3-unit wall is under 2px and reads as no press. */
  readonly travelAbs?: number;
  /** The tight contact shadow: offset, blur, opacity. */
  readonly shTightDy?: number;
  readonly shTightBlur?: number;
  readonly shTightOp?: number;
  /** The wide ambient shadow around it. One offset blur reads as a sticker. */
  readonly shWideDy?: number;
  readonly shWideBlur?: number;
  readonly shWideOp?: number;
  /** The specular: one soft light overhead, high and a little left. */
  readonly specCx?: number;
  readonly specCy?: number;
  readonly specRx?: number;
  readonly specRy?: number;
  readonly specOp?: number;
  /** Bounce off the desk, along the bottom inside edge. */
  readonly bounceOp?: number;
  /** Legend sizes and offsets, in MOCK_CAP units. */
  readonly legPair?: number;
  readonly legSingle?: number;
  readonly legWord?: number;
  readonly legPairUp?: number;
  readonly legPairDown?: number;
  /** Homing bar: width as a fraction of the cap, offset below the legend. */
  readonly homingW?: number;
  readonly homingDy?: number;
};

/**
 * The cap height the mock was drawn on.
 *
 * Mock 11 is drawn at 62 units per key with a 7-unit gap, so its caps are 55
 * across; the app draws 40 with a 6-unit gap, so its caps are 34. Every round
 * number below is written in the MOCK's units and scaled by `h / MOCK_CAP` at
 * draw time, so this file stays readable against the mock rather than being a
 * table of values nobody can check.
 */
export const MOCK_CAP = 55;

export const MECH: Geom = {
  lip: 5,
  faceInX: 1.5,
  rxBase: 5.5,
  rxFace: 5,
  rowSquash: [0.87, 0.9, 0.93, 0.96, 0.99],
  shDy: 1.6,
  shOp: 0.5,
  travel: 0.62,
  dish: true,
  topLegends: true,
  foreshorten: 0.93,
};

export const FLAT: Geom = {
  lip: 2,
  faceInX: 0.7,
  rxBase: 5.5,
  rxFace: 5,
  rowSquash: [0.93, 0.95, 0.96, 0.98, 0.99],
  shDy: 1.0,
  shOp: 0.28,
  travel: 0.62,
  dish: false,
  topLegends: false,
  foreshorten: 0.97,
};

/**
 * The round board: low profile, no chassis, caps on the page.
 *
 * The wall is 3 units on a 55-unit cap — barely any. That is the single
 * number that decides whether a drawn cap reads as this board or as a chunky
 * mechanical one, so it is not a knob to turn.
 */
export const ROUND: Geom = {
  lip: 3,
  faceInX: 1,
  rxBase: 0, // unused: round caps take rx from their own height
  rxFace: 0,
  rowSquash: [1, 1, 1, 1, 1], // flat-on, no foreshortening
  shDy: 2,
  shOp: 0.45,
  travel: 0.62, // unused; travelAbs wins
  dish: true,
  topLegends: false,
  foreshorten: 1,

  round: true,
  travelAbs: 4.5,
  shTightDy: 2,
  shTightBlur: 1.6,
  shTightOp: 0.45,
  shWideDy: 4,
  shWideBlur: 5.5,
  shWideOp: 0.3,
  specCx: 0.42,
  specCy: 0.3,
  specRx: 0.36,
  specRy: 0.26,
  specOp: 0.34,
  bounceOp: 0.08,
  legPair: 13,
  legSingle: 17,
  legWord: 12,
  legPairUp: 3,
  legPairDown: 13,
  homingW: 0.3,
  homingDy: 13,
};

/**
 * What a per-key painter is told about one cap.
 *
 * Just enough to decide a colour, and all of it known when the cap is built,
 * so the painter runs once per key per board rather than on every keystroke.
 */
export type CapFacts = {
  readonly id: string;
  /** The finger zone the shape names — `pinky`, `leftIndex`… — if any. */
  readonly finger: string | null;
  /** The primary legend as printed (usually a capital), or null. */
  readonly legend: string | null;
  /**
   * A key of the board's frame rather than one that types a character: the
   * modifiers, the space bar, and anything without a legend of its own.
   */
  readonly frame: boolean;
};

/**
 * One cap's own colours, for a skin that paints per key.
 *
 * Every value is a CSS colour — a hex, a `var(--token, fallback)` or a
 * `color-mix()` — and is applied as a style rather than as a presentation
 * attribute, which is what lets it resolve a custom property (see the note on
 * `grad` in SkinDefs).
 */
export type CapPaint = {
  readonly top: string;
  /** The wall, which on a skin with no face inset shows only as the lip. */
  readonly skirt: string;
  readonly ink: string;
  /** A ring just inside the face edge, `ringWidth` wide. Absent: no ring. */
  readonly ring?: string;
  /**
   * What changes while the finger colours are on (`keyboard.colors`). A
   * field left out keeps the value above, so a cap that has no finger, or a
   * skin that shows the finger in only one place, says so by omission.
   */
  readonly zone?: {
    readonly skirt?: string;
    readonly ink?: string;
    readonly ring?: string;
  };
};

export type Skin = {
  readonly id: string;
  /** The accent this keyset cues the next key in. */
  readonly cue: string;
  readonly geom: Geom;
  readonly grain: boolean;
  readonly matte: boolean;
  readonly gloss: number;
  /** Pale keycaps need the dark set of finger inks. */
  readonly lightCaps: boolean;
  readonly alphaTop: readonly string[];
  readonly alphaSkirt: readonly string[];
  readonly modTop: readonly string[];
  readonly modSkirt: readonly string[];
  readonly accentTop: readonly string[] | null;
  readonly accentSkirt: readonly string[] | null;
  readonly accentIds: readonly string[];
  readonly ink: string;
  readonly modInk: string;
  readonly accentInk: string;
  /**
   * The accent legend on a light page, where one is needed.
   *
   * The round board wears one face on both themes — the theme changes the
   * light, not the plastic — and that holds for every cap here. But the
   * accent caps are lit by the backlight, which is off by default on a light
   * page, so the same lemon that carries a near-black legend under the light
   * sits several shades down without it and the dark legend stops reading.
   *
   * A legend colour is part of the lighting, not part of the keyset, which is
   * why this is a second ink rather than a second skin. Absent, the accent
   * ink is used on both themes, which is right for every skin whose accent
   * cap is pale enough not to move.
   */
  readonly accentInkLight?: string;
  readonly size: number;
  readonly weight: number;

  /* ── per-key finishes ─────────────────────────────────────────────
     Every skin above colours a cap by its CLASS — alpha, modifier, accent —
     which is how a real keyset is moulded. The two kids finishes cannot be
     said that way: Crayon rings every cap in its own finger's colour, and
     Rainbow sorts the caps into four groups by what the key IS. So a skin
     may name a painter instead, and the fields after it are the handful of
     things those finishes print differently. All optional: a skin that sets
     none of them renders exactly as it did before they existed. Only the
     flat-geometry renderer reads them; the round branch has no such skin. */

  /** Colours each cap itself; the class gradients above are then unused. */
  readonly paint?: (cap: CapFacts) => CapPaint;
  /** Width of `CapPaint.ring`, in board units. */
  readonly ringWidth?: number;
  /**
   * The light along the top edge of the face: its opacity and its width.
   * Absent, the flat renderer's own hairline. Zero draws none.
   */
  readonly hairline?: { readonly opacity: number; readonly width: number };
  /**
   * The next key FILLS with the cue colour and prints its legend in this ink,
   * rather than only ringing the cap and tinting the legend. How the kids
   * boards have always shown it — and on a board that is already every colour
   * of the finger chart, a cue ring is one more coloured outline among many.
   */
  readonly cueInk?: string;
  /**
   * Modifier words replaced by signs, keyed by the printed word (`back`,
   * `enter`…). For readers who cannot yet read the word.
   */
  readonly modSigns?: Readonly<Record<string, string>>;
  /**
   * The shifted legend small in the top-right corner, the primary one large
   * and centred — rather than the two stacked. The reference board prints
   * them this way, and stacked on a cap this size both come out too small.
   */
  readonly cornerShift?: boolean;
};

/** The mechanical board at night: charcoal alphas. */
export const MECHANICAL_SKIN: Skin = {
  id: "mech",
  cue: "#8fd9b6",
  geom: MECH,
  grain: true,
  matte: true,
  gloss: 0.05,
  lightCaps: false,
  alphaTop: ["#4a505a", "#4f555f"],
  alphaSkirt: ["#2b2f35", "#1e2126"],
  modTop: ["#71869c", "#788da3"],
  modSkirt: ["#4a5b6b", "#3a4956"],
  accentTop: ["#e64d1a", "#ef5522"],
  accentSkirt: ["#962b08", "#7a2206"],
  accentIds: ["Backquote", "Enter"],
  ink: "#eef1f4",
  modInk: "#f4f7fa",
  accentInk: "#ffffff",
  size: 13,
  weight: 500,
};

/** The flat board by day: pale anodising, one even tone, texture from grain. */
export const SILVER_SKIN: Skin = {
  id: "silver",
  cue: "#2f8f66",
  geom: FLAT,
  grain: true,
  matte: true,
  gloss: 0,
  lightCaps: true,
  alphaTop: ["#dfe3e8", "#dfe3e8"],
  alphaSkirt: ["#adb2ba", "#9aa0a8"],
  modTop: ["#d3d8de", "#d3d8de"],
  modSkirt: ["#a3a8b0", "#8f949c"],
  accentTop: null,
  accentSkirt: null,
  accentIds: [],
  ink: "#2b2d33",
  modInk: "#4d5058",
  accentInk: "#ffffff",
  size: 12,
  weight: 500,
};

/** The same finish at night, in the dark anodising. */
export const MIDNIGHT_SKIN: Skin = {
  id: "midnight",
  cue: "#8fd9b6",
  geom: FLAT,
  grain: true,
  matte: true,
  gloss: 0,
  lightCaps: false,
  alphaTop: ["#3e434b", "#343941", "#383d45"],
  alphaSkirt: ["#23262c", "#191b20"],
  modTop: ["#34383f", "#2b2f35", "#2f333a"],
  modSkirt: ["#1e2126", "#16181c"],
  accentTop: null,
  accentSkirt: null,
  accentIds: [],
  ink: "#e8eaef",
  modInk: "#b6bac4",
  accentInk: "#ffffff",
  size: 12,
  weight: 500,
};

/**
 * The finger hues as LEGEND colours rather than cap tints, so the keycaps stay
 * the colour the keyset actually is. Same six hues as palettes.less, lifted for
 * dark caps and deepened for pale ones — one set cannot be legible on both.
 */
export const ZONE_ON_DARK: Record<string, string> = {
  pinky: "#e8a3a3",
  ring: "#addb9f",
  middle: "#e6c890",
  leftIndex: "#96bdef",
  rightIndex: "#c9a0e0",
  thumb: "#dcb69a",
};

export const ZONE_ON_LIGHT: Record<string, string> = {
  pinky: "#9c5152",
  ring: "#4a7440",
  middle: "#836026",
  leftIndex: "#345c88",
  rightIndex: "#68437e",
  thumb: "#7f5f47",
};

/**
 * The mechanical board by day.
 *
 * The same board, in a lighter room. An earlier pass swapped its charcoal
 * alphas for ivory, which read as a different keyboard rather than the same
 * one on a brighter page. Going back to the night charcoal was no better: on
 * a white page it is a black slab.
 *
 * So the alphas sit in the middle — a medium neutral grey, still obviously
 * the dark keyset, no longer a hole in the page. The modifiers lift with them
 * so the two-tone survives: leaving them where they were put the two within a
 * step of each other and the keyset stopped reading as two-tone at all. The
 * accent, the geometry and the light legends are untouched.
 *
 * The cue changes too — the night cue is a pale mint that disappears against
 * a bright page, and the day one is the deeper green that does not.
 */
export const MECHANICAL_DAY_SKIN: Skin = {
  ...MECHANICAL_SKIN,
  id: "mechday",
  cue: "#2f8f66",
  alphaTop: ["#6a6f78", "#6f747d"],
  alphaSkirt: ["#474c54", "#3a3f46"],
  modTop: ["#8093a8", "#8798ac"],
  modSkirt: ["#5a6b7c", "#4a5966"],
};

/**
 * The six colourways (mock 11b), one face each.
 *
 * `alphaTop` is the face gradient — a keycap photographed from above is lit
 * from its top edge and falls away, and a single flat fill is most of why a
 * drawn board reads as drawn. `alphaSkirt` is the wall below the face.
 *
 * All six are dark-capped on purpose. Off-White used to be the pale member
 * carrying near-black legends and it read badly on both themes — too little
 * contrast to be crisp, and too dark to sit with the rest. It is a warm grey
 * now, so the whole family carries the same light legends including the
 * finger colours, which are the lifted hues and need a dark cap under them.
 *
 * The accent is the colourway's own, as the reference boards do it: lemon on
 * Graphite, a quiet tonal grey on Off-White, a deeper tone of itself on the
 * rest. It lands on Backquote and Enter — the reference board accents three
 * Bluetooth channel keys in a function row KeyLearn does not draw, so the
 * accent moves to the pair Mechanical already uses.
 */
const roundSkin = (
  id: string,
  cap: readonly [string, string],
  wall: string,
  ink: string,
  mod: readonly [string, string],
  modWall: string,
  acc: readonly [string, string],
  accWall: string,
  accInk: string,
  accInkLight?: string,
): Skin => ({
  id: `round-${id}`,
  cue: "#8fd9b6",
  geom: ROUND,
  grain: true,
  matte: true,
  gloss: 0,
  lightCaps: false,
  alphaTop: [...cap],
  alphaSkirt: [wall, wall],
  modTop: [...mod],
  modSkirt: [modWall, modWall],
  accentTop: [...acc],
  accentSkirt: [accWall, accWall],
  accentIds: ["Backquote", "Enter"],
  ink,
  modInk: ink,
  accentInk: accInk,
  ...(accInkLight != null ? { accentInkLight: accInkLight } : {}),
  size: 17,
  weight: 300,
});

export const ROUND_SKINS: Record<string, Skin> = {
  /**
   * Graphite, with the learner's accent on the two accent keys.
   *
   * The accent is `var(--accent)` rather than a hex, and that works because
   * every colour in a skin ends up as an SVG gradient `stop-color`, which
   * resolves CSS custom properties like any other declaration. So this one
   * keyset follows the theme while the other five stay the fixed colours a
   * real keyset has. The wall and the legend ink are mixed FROM the accent
   * for the same reason — a hand-picked pair would be wrong for five of the
   * six accents a learner can choose.
   */
  theme: roundSkin(
    "theme",
    ["#4b4f56", "#3b3f45"],
    "#26292e",
    "#dfe2e6",
    ["#41454b", "#33373c"],
    "#212428",
    ["var(--accent)", "color-mix(in oklab, var(--accent) 86%, #000)"],
    "color-mix(in oklab, var(--accent) 55%, #000)",
    "color-mix(in oklab, var(--accent) 22%, #000)",
    // Unlit, the accent cap sits well below the near-black legend it carries
    // under the backlight. Mixed towards white from the same accent, so it
    // still belongs to the key rather than being a flat grey pasted on it.
    "color-mix(in oklab, var(--accent) 18%, #fff)",
  ),
  graphite: roundSkin(
    "graphite",
    ["#4b4f56", "#3b3f45"],
    "#26292e",
    "#dfe2e6",
    ["#41454b", "#33373c"],
    "#212428",
    ["#e8db35", "#cbbe1e"],
    "#847c0e",
    "#2b290f",
    // The lemon reads as a deep olive with the backlight off, and #2b290f on
    // it is very nearly unreadable — the reported bug, on Backquote and
    // Enter. The board's own legend colour carries there instead.
    "#f2eecf",
  ),

  offwhite: roundSkin(
    "offwhite",
    ["#75726b", "#63605a"],
    "#454340",
    "#eeece7",
    ["#6a6761", "#585551"],
    "#3e3c39",
    ["#c3bfb4", "#aba79c"],
    "#7d7a71",
    "#26251f",
  ),

  rose: roundSkin(
    "rose",
    ["#86615c", "#72524e"],
    "#4b3532",
    "#f4e5e3",
    ["#785652", "#654845"],
    "#422f2c",
    ["#c79189", "#ac776f"],
    "#7d534d",
    "#2b1a17",
  ),

  sand: roundSkin(
    "sand",
    ["#847b68", "#6f6757"],
    "#4a4437",
    "#f0eade",
    ["#786f5d", "#635b4c"],
    "#413b30",
    ["#c0af86", "#a5946c"],
    "#77694a",
    "#2b2519",
  ),

  lavender: roundSkin(
    "lavender",
    ["#726a89", "#5f5875"],
    "#3d3849",
    "#ece8f5",
    ["#665f7c", "#544e68"],
    "#363142",
    ["#a89bca", "#8b7dae"],
    "#655a83",
    "#221d2e",
  ),

  blueberry: roundSkin(
    "blueberry",
    ["#566a80", "#46576b"],
    "#2d3844",
    "#e4ecf4",
    ["#4c5e72", "#3d4c5d"],
    "#28313c",
    ["#89aacb", "#6c8dae"],
    "#4d6780",
    "#16202b",
  ),
};

/**
 * The round board's backlight, one warm white for every colourway.
 *
 * A backlight is an LED under the cap — it is the same light whatever colour
 * the plastic above it is. Tinting it per keyset gave six boards that each
 * glowed a different colour, which is Mechanical's per-key RGB trick wearing
 * a different hat.
 */
export const ROUND_GLOW = "#ffe3ad";

/* ── the kids finishes ───────────────────────────────────────────────
   The two boards the kids trail draws in HTML (KidsPage.tsx, `Key`, and the
   `.key` / `.kbRainbow` rules in kids.module.less), ported to the grown-up
   SVG keyboard so the kids Classic mode can keep the grown-up keyboard and
   its hands while wearing the board a child already knows.

   Every hex here is copied from kids.module.less, and every mix is the one
   that file writes as `color-mix(in srgb, …)`, computed here so the values
   read against that file line for line. Measurements are the kids board's
   `--ku` units carried over by proportion: a kids cap is 3.2ku tall and a
   board cap is 34 units, so one ku is 34 / 3.2 ≈ 10.6 units. */

/** `color-mix(in srgb, a p%, b)`, for two hexes. */
function mixSrgb(a: string, p: number, b: string): string {
  const ch = (hex: string, i: number) =>
    Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  let out = "#";
  for (let i = 0; i < 3; i++) {
    const v = Math.round(ch(a, i) * p + ch(b, i) * (1 - p));
    out += v.toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * The kids finger zones, by the grown-up shape's finger names.
 *
 * The trail calls them rose, sage, sand, seafoam, terra and clay; the board
 * names the finger. The mapping is the trail's own (keyboard-data.ts,
 * ZONE_OF): little finger rose, ring sage, middle sand, left index seafoam,
 * right index terra, and the thumb on clay like its space bar. These hues are
 * "the one thing no theme may move" in the kids stylesheet, and they do not
 * move at night either.
 */
export const KIDS_ZONE: Readonly<Record<string, string>> = {
  pinky: "#f5a8b8",
  ring: "#8fce7e",
  middle: "#f2c94c",
  leftIndex: "#5fc9a7",
  rightIndex: "#f5a25f",
  thumb: "#c9b8a8",
};

/** The kids neutral: frame keys, and every cap with the finger colours off. */
const CLAY = "#c9b8a8";

/**
 * The kids board's flat cap: no inset face, no foreshortening, no dish — a
 * rounded tile standing on a lip of solid colour, which is the kids `.key`'s
 * `box-shadow: 0 3.5px 0 …` drawn as geometry.
 */
const KIDS_FLAT: Omit<Geom, "lip" | "rxBase" | "rxFace" | "travel"> = {
  faceInX: 0,
  rowSquash: [1, 1, 1, 1, 1],
  shDy: 0,
  shOp: 0, // the lip is the only shadow the kids caps cast
  dish: false,
  topLegends: false,
  foreshorten: 1,
};

/**
 * Crayon: a white cap ringed in its finger's colour, on a lip of the same
 * colour darkened towards grey (`color-mix(in srgb, var(--kz) 78%, #6a6a5a)`).
 * The frame keys — tab, caps, shift, enter, back and the space bar — are
 * ringed in clay, never a finger: they are what the letters sit in. With the
 * finger colours off, every cap is clay, as on the trail.
 *
 * The cap and its legends take the page's own tokens rather than fixed hexes,
 * and that is deliberate: the kids Classic frame re-points `--primary-l2` and
 * `--secondary` to exactly the kids key ground and key ink — #ffffff and
 * #3a3a4e by day, #333a5e and #f2f2fc at night, the trail's `--key-bg` and
 * `--kink` — so the one skin is right on both without asking what time it is.
 * The fallbacks are the day values, for a page that sets neither token.
 *
 * The legend stays ink, not a finger colour: the ring already says the finger,
 * and the trail prints its crayon legends plain.
 */
export const KIDS_CRAYON_SKIN: Skin = {
  id: "kids-crayon",
  cue: "var(--accent, #2f8f66)",
  cueInk: "var(--accent-ink, #ffffff)",
  geom: {
    ...KIDS_FLAT,
    lip: 2.3, // 3.5px under a 3.2ku cap
    rxBase: 9.6, // 0.9ku
    rxFace: 9.6,
    travel: 0.86, // the trail's press leaves 0.5px of its 3.5px lip showing
  },
  grain: false,
  matte: true,
  gloss: 0,
  lightCaps: true,
  // Unused while `paint` is set, but SkinDefs defines them unconditionally.
  alphaTop: ["#ffffff"],
  alphaSkirt: [mixSrgb(CLAY, 0.78, "#6a6a5a")],
  modTop: ["#ffffff"],
  modSkirt: [mixSrgb(CLAY, 0.78, "#6a6a5a")],
  accentTop: null,
  accentSkirt: null,
  accentIds: [],
  ink: "var(--secondary, #3a3a4e)",
  modInk: "var(--secondary-l2, #7a7a90)",
  accentInk: "var(--secondary, #3a3a4e)",
  size: 14,
  weight: 700,
  ringWidth: 1.7, // 2.5px
  hairline: { opacity: 0, width: 0 },
  paint: ({ finger, frame }) => {
    const zone = frame || finger == null ? null : (KIDS_ZONE[finger] ?? null);
    return {
      top: "var(--primary-l2, #ffffff)",
      skirt: mixSrgb(CLAY, 0.78, "#6a6a5a"),
      ring: CLAY,
      ink: frame ? "var(--secondary-l2, #7a7a90)" : "var(--secondary, #3a3a4e)",
      ...(zone != null
        ? { zone: { ring: zone, skirt: mixSrgb(zone, 0.78, "#6a6a5a") } }
        : {}),
    };
  },
};

/**
 * Rainbow's four groups, as the kids stylesheet names them: g for the frame,
 * r for the numbers and punctuation, b for the alphabet, v for the vowels.
 * Held a tenth back from poster primaries there, for the reason given there.
 */
const RAINBOW = {
  g: ["#4ab86a", "#2f9a4e"],
  r: ["#e35d51", "#c13e33"],
  b: ["#4a5fb8", "#33448f"],
  v: ["#6fb8e4", "#4b95c4"],
} as const;

/**
 * The vowels Rainbow sets apart. The trail's board is English-only and says
 * `aeiou`; the grown-up board carries every Latin layout, so the accented
 * vowels those layouts print on their own caps come too — a French learner's
 * é is as much a vowel as their e. Not y: the trail leaves it out, and a
 * board for five-year-olds is not the place to argue it.
 */
const VOWEL = /^[aeiouàáâãäåæèéêëìíîïòóôõöøœùúûü]$/iu;

/**
 * Rainbow: the primary-colour learning board.
 *
 * The cap says what KIND of key this is — green frame, red numbers and
 * punctuation, blue letters, lighter blue vowels — and the legend says which
 * finger owns it, carried most of the way to white
 * (`color-mix(in srgb, var(--kl, #fff) 68%, #fff)`) so it still reads on a
 * saturated cap. The frame keys have no finger on the trail, so their legends
 * are plain white; so is every legend with the finger colours off.
 *
 * One face on both themes, as on the trail: the plastic is the plastic.
 */
export const KIDS_RAINBOW_SKIN: Skin = {
  id: "kids-rainbow",
  cue: "var(--accent, #2f8f66)",
  cueInk: "var(--accent-ink, #ffffff)",
  geom: {
    ...KIDS_FLAT,
    lip: 3.6, // 0.34ku
    rxBase: 6.6, // 0.62ku
    rxFace: 6.6,
    travel: 1, // the trail's rainbow cap goes all the way down
  },
  grain: false,
  matte: true,
  gloss: 0,
  lightCaps: false,
  alphaTop: [RAINBOW.b[0]],
  alphaSkirt: [RAINBOW.b[1]],
  modTop: [RAINBOW.g[0]],
  modSkirt: [RAINBOW.g[1]],
  accentTop: null,
  accentSkirt: null,
  accentIds: [],
  // Also the resting hands' ink over the board (VirtualKeyboard publishes it
  // as --hand-ink): white is the one colour that reads on all four groups.
  ink: "#ffffff",
  modInk: "#ffffff",
  accentInk: "#ffffff",
  size: 15,
  weight: 700,
  // `inset 0 0.12ku 0 rgb(255 255 255 / 28%)`: the moulded top edge.
  hairline: { opacity: 0.28, width: 1.3 },
  modSigns: {
    back: "←",
    tab: "⇥",
    caps: "⇪",
    enter: "↵",
    shift: "↑",
  },
  cornerShift: true,
  paint: ({ finger, legend, frame }) => {
    const group = frame
      ? RAINBOW.g
      : legend == null || !/^\p{L}$/u.test(legend)
        ? RAINBOW.r
        : VOWEL.test(legend)
          ? RAINBOW.v
          : RAINBOW.b;
    const zone = frame || finger == null ? null : (KIDS_ZONE[finger] ?? null);
    return {
      top: group[0],
      skirt: group[1],
      ink: "#ffffff",
      ...(zone != null
        ? { zone: { ink: mixSrgb(zone, 0.68, "#ffffff") } }
        : {}),
    };
  },
};

/** One cap's look, as CSS values an HTML element can wear. */
export type CapLook = {
  /** A `background` value: a colour, or the face gradient. */
  readonly face: string;
  /** The wall — what shows as the lip under the cap. */
  readonly edge: string;
  readonly ink: string;
  /** Crayon's finger ring, or null for a skin that draws none. */
  readonly ring: string | null;
  /** Width of that ring as a fraction of the cap's height. */
  readonly ringRatio: number;
  /** Corner radius as a fraction of the cap's height; 0.5 is a stadium. */
  readonly radiusRatio: number;
};

/** The height of a board cap, which every ratio above is measured against. */
const CAP_H = 34;

/**
 * How a skin dresses one key, for something outside the SVG board that wants
 * to look like that key — the "press Enter to start" invitation is the case
 * this exists for.
 *
 * It answers the same questions `makeSkinnedKeyComponent` answers for a
 * cap on the board, from the same fields, so the two cannot disagree: a key
 * the skin names as an accent wears the accent; a painted skin paints it;
 * otherwise a frame key wears the modifier colours and the rest the alpha
 * ones. `cap` says what the key is — for Enter,
 * `{ id: "Enter", finger: "pinky", legend: null, frame: true }` — and
 * `zoneOn` is the `keyboard.colors` setting.
 */
export function capLook(skin: Skin, cap: CapFacts, zoneOn = true): CapLook {
  const G = skin.geom;
  const radiusRatio = G.round === true ? 0.5 : G.rxFace / CAP_H;
  const ringRatio = (skin.ringWidth ?? 1.5) / CAP_H;
  const gradient = (stops: readonly string[]) =>
    `linear-gradient(180deg, ${stops[0]}, ${stops[stops.length - 1]})`;
  if (skin.paint != null) {
    const paint = skin.paint(cap);
    return {
      face: paint.top,
      edge: (zoneOn ? paint.zone?.skirt : undefined) ?? paint.skirt,
      ink: (zoneOn ? paint.zone?.ink : undefined) ?? paint.ink,
      ring: (zoneOn ? paint.zone?.ring : undefined) ?? paint.ring ?? null,
      ringRatio,
      radiusRatio,
    };
  }
  if (
    skin.accentIds.includes(cap.id) &&
    skin.accentTop != null &&
    skin.accentSkirt != null
  ) {
    return {
      face: gradient(skin.accentTop),
      edge: skin.accentSkirt[0],
      ink: skin.accentInk,
      ring: null,
      ringRatio,
      radiusRatio,
    };
  }
  return cap.frame
    ? {
        face: gradient(skin.modTop),
        edge: skin.modSkirt[0],
        ink: skin.modInk,
        ring: null,
        ringRatio,
        radiusRatio,
      }
    : {
        face: gradient(skin.alphaTop),
        edge: skin.alphaSkirt[0],
        ink: skin.ink,
        ring: null,
        ringRatio,
        radiusRatio,
      };
}
