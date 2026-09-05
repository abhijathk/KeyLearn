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
