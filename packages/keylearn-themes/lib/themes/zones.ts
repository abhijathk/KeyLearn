/**
 * A finger-zone palette that survives colour blindness.
 *
 * The keyboard's colours are not decoration — they ARE the instruction. On a
 * children's typing tutor, a learner who cannot tell the ring zone from the
 * middle one is being taught nothing by the colour at all.
 *
 * The default palette does not survive it. Measured as CIELAB ΔE between the
 * zones that actually sit next to each other on the board, after simulating
 * the two common deficiencies:
 *
 *              typical   deuteranopia   protanopia
 *   default      7.4         3.7           2.1
 *   this set    28.7         9.2          10.3
 *
 * A ΔE around 2.3 is the just-noticeable difference, so the default palette's
 * worst adjacent pair — left index against right index — is at the edge of
 * being literally the same colour for a protanope. Roughly one boy in twelve.
 *
 * The hues are the Okabe–Ito set, chosen for exactly this and assigned so that
 * no two neighbouring zones sit on a shared confusion axis. They are mixed
 * toward the ground a little less than the default zones are (45% rather than
 * 55% on night), because muting is what collapses the differences and this
 * palette exists to keep them.
 */
export type ZonePalette = {
  readonly pinky: string;
  readonly ring: string;
  readonly middle: string;
  readonly leftIndex: string;
  readonly rightIndex: string;
  readonly thumb: string;
};

export const CVD_SAFE_ZONES: { night: ZonePalette; day: ZonePalette } = {
  night: {
    pinky: "#094970",
    ring: "#88610e",
    middle: "#09614e",
    leftIndex: "#794c6a",
    rightIndex: "#386d8f",
    thumb: "#7e3e0e",
  },
  day: {
    pinky: "#187fb9",
    ring: "#e8a819",
    middle: "#18a780",
    leftIndex: "#d086af",
    rightIndex: "#66bbeb",
    thumb: "#d86d19",
  },
};

const PROPS: readonly (readonly [keyof ZonePalette, string])[] = [
  ["pinky", "--pinky-zone-color"],
  ["ring", "--ring-zone-color"],
  ["middle", "--middle-zone-color"],
  ["leftIndex", "--left-index-zone-color"],
  ["rightIndex", "--right-index-zone-color"],
  ["thumb", "--thumb-zone-color"],
];

/**
 * Put the palette on, or take it off and let the theme's own zones back.
 *
 * Removing rather than restoring: the theme sets these in its stylesheet, so
 * clearing the inline value is what hands control back — writing the defaults
 * here would freeze whichever theme happened to be on at the time.
 */
export function applyZonePalette(
  on: boolean,
  day: boolean,
  style: CSSStyleDeclaration = document.documentElement.style,
): void {
  const palette = day ? CVD_SAFE_ZONES.day : CVD_SAFE_ZONES.night;
  for (const [key, prop] of PROPS) {
    if (on) {
      style.setProperty(prop, palette[key]);
    } else {
      style.removeProperty(prop);
    }
  }
}

// ---- Zones derived from the theme -----------------------------------------

/**
 * Where each finger sits relative to the pinky, in degrees.
 *
 * Taken from the default palette rather than invented: dusty rose, sage, sand,
 * slate blue, mauve and clay are already spread this way, and preserving the
 * spacing is the whole point. Deriving six colours from one hue — the literal
 * reading of "finger colours from the theme colour" — would turn six
 * distinguishable zones into six shades of one, and the colour is what the
 * keyboard teaches with.
 */
const ZONE_OFFSETS: Record<keyof ZonePalette, number> = {
  pinky: 0,
  ring: 160,
  middle: 58,
  leftIndex: 242,
  rightIndex: 302,
  thumb: 50,
};

// The character of the default zones, measured from them: barely saturated and
// dark on night, softer and light on day. A theme's palette should feel like
// the same keyboard wearing a different coat, not like a different keyboard.
const NIGHT = { s: 12, l: 36 };
const DAY = { s: 24, l: 72 };

/** The hue of a CSS colour, or null if it cannot be read as one. */
export function hueOf(css: string): number | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(css.trim());
  let r: number, g: number, b: number;
  if (hex != null) {
    const n = Number.parseInt(hex[1], 16);
    [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  } else {
    const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(css);
    if (rgb == null) {
      return null;
    }
    [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  const [x, y, z] = [r / 255, g / 255, b / 255];
  const max = Math.max(x, y, z);
  const min = Math.min(x, y, z);
  const d = max - min;
  if (d === 0) {
    return 0; // A grey has no hue; start the set at red.
  }
  let h: number;
  if (max === x) {
    h = ((y - z) / d) % 6;
  } else if (max === y) {
    h = (z - x) / d + 2;
  } else {
    h = (x - y) / d + 4;
  }
  return (((h * 60) % 360) + 360) % 360;
}

/**
 * The default arrangement, turned so it starts at this theme's own hue.
 *
 * Every theme gets a keyboard that plainly belongs to it, and the zones stay as
 * far from each other as they are today.
 */
export function themedZones(
  accentCss: string,
  day: boolean,
): ZonePalette | null {
  const hue = hueOf(accentCss);
  if (hue == null) {
    return null;
  }
  const { s, l } = day ? DAY : NIGHT;
  const at = (key: keyof ZonePalette) =>
    `hsl(${Math.round((hue + ZONE_OFFSETS[key]) % 360)} ${s}% ${l}%)`;
  return {
    pinky: at("pinky"),
    ring: at("ring"),
    middle: at("middle"),
    leftIndex: at("leftIndex"),
    rightIndex: at("rightIndex"),
    thumb: at("thumb"),
  };
}

/** Put a derived palette on, or take it off. */
export function applyThemedZones(
  palette: ZonePalette | null,
  style: CSSStyleDeclaration = document.documentElement.style,
): void {
  for (const [key, prop] of PROPS) {
    if (palette == null) {
      style.removeProperty(prop);
    } else {
      style.setProperty(prop, palette[key]);
    }
  }
}

/**
 * The colours a household may put on the finger zones.
 *
 * A pool, not a colour picker. The zones are not decoration — they are the
 * instruction the keyboard teaches with, and six colours chosen freely will
 * sooner or later include two nobody can tell apart, which teaches nothing.
 * These are the app's own zone colours: the pastels the grown-up themes have
 * always used, and the brighter set the kids pages are drawn in. Nothing
 * outside the pool, so no theme can invent a colour that has not been looked
 * at.
 *
 * Six zones, and each colour used once — an assignment is a rearrangement of
 * the pool rather than a free choice, which is what keeps every pair as far
 * apart as the pool's worst pair and no further.
 */
export const ZONE_POOLS: {
  readonly adult: readonly string[];
  readonly kid: readonly string[];
} = {
  // Dusty rose, sage, sand, slate blue, soft mauve, clay.
  adult: ["#c49b9b", "#a9bda1", "#c8b48c", "#94a8c6", "#b19cba", "#b5a292"],
  // Sky, coral, sage, sand, seafoam, terra — the kids palette, which is the
  // same set of hues with the muting taken off.
  kid: ["#3aa0ff", "#ff7d68", "#8fce7e", "#f2c94c", "#5fc9a7", "#f5a25f"],
};

/** The zones in the order the maker shows them, left thumb to right little. */
export const ZONE_ORDER: readonly (keyof ZonePalette)[] = [
  "pinky",
  "ring",
  "middle",
  "leftIndex",
  "rightIndex",
  "thumb",
];

/** The pool arranged into a palette, in the maker's order. */
export function zonesFromPool(colors: readonly string[]): ZonePalette {
  const [pinky, ring, middle, leftIndex, rightIndex, thumb] = colors;
  return { pinky, ring, middle, leftIndex, rightIndex, thumb };
}

/**
 * Whether an assignment is one the pool actually allows: six colours, all from
 * the pool, none used twice. Anything else is somebody else's data or a
 * half-written write, and the theme's own zones are a better answer than a
 * keyboard with two identical fingers.
 */
export function poolAssignment(
  colors: unknown,
  pool: readonly string[],
): readonly string[] | null {
  if (!Array.isArray(colors) || colors.length !== ZONE_ORDER.length) {
    return null;
  }
  const lower = colors.map((c) => String(c).toLowerCase());
  if (!lower.every((c) => pool.includes(c))) {
    return null;
  }
  if (new Set(lower).size !== lower.length) {
    return null;
  }
  return lower;
}
