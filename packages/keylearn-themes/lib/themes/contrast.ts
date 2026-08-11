import { contrastRatio, parseColor } from "@keylearn/color";

/**
 * How hard the text works to be read.
 *
 * Presets rather than a dial. A slider asks somebody to find a number that
 * suits their eyes by feel, which is a job for research rather than for a
 * person squinting at their own screen — and the numbers that matter are
 * already established. WCAG asks 4.5:1 of body text to pass AA and 7:1 to pass
 * AAA, and AAA is the level written specifically for readers with low vision.
 *
 * So: the theme as designed, the AAA level, and a step beyond it for anyone
 * who needs more than the standard contemplates. Named for what they do, not
 * for a condition — nobody should have to identify themselves with a
 * diagnosis to make an app readable.
 */
export type ContrastLevel = "default" | "clearer" | "strongest";

/** The ratio each level asks of ordinary body text. */
const TARGET: Record<ContrastLevel, number | null> = {
  default: null, // Whatever the theme chose.
  clearer: 7, // WCAG AAA for body text.
  strongest: 11, // Beyond the standard, for those the standard does not reach.
};

// The faded text — captions, sub-labels, the second line of a settings row —
// is where contrast actually fails, so it is raised too, to the AA mark at
// "clearer" and past it at "strongest". Lifting only the main text would leave
// the hardest-to-read words exactly as they were.
const MUTED: Record<ContrastLevel, number | null> = {
  default: null,
  clearer: 4.5,
  strongest: 7,
};

/**
 * Walk a colour toward black or white until it clears the target.
 *
 * Toward whichever end is further from the ground, so light-on-dark stays
 * light and dark-on-light stays dark: a theme should get more legible, not
 * inverted.
 */
function reach(color: string, ground: string, target: number): string {
  const from = parseColor(color);
  const bg = parseColor(ground);
  if (contrastRatio(from, bg) >= target) {
    return color;
  }
  const toWhite =
    contrastRatio(parseColor("#ffffff"), bg) >
    contrastRatio(parseColor("#000000"), bg);
  const rgb = from.toRgb();
  const end = toWhite ? 1 : 0;
  let lo = 0;
  let hi = 1;
  let best = toWhite ? "#ffffff" : "#000000";
  // Twelve steps lands within a thousandth of the smallest step a colour
  // channel can take, which is far finer than anybody can see.
  for (let i = 0; i < 12; i++) {
    const t = (lo + hi) / 2;
    const mixed = {
      r: rgb.r + (end - rgb.r) * t,
      g: rgb.g + (end - rgb.g) * t,
      b: rgb.b + (end - rgb.b) * t,
    };
    const hex = `#${[mixed.r, mixed.g, mixed.b]
      .map((v) =>
        Math.round(v * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;
    if (contrastRatio(parseColor(hex), bg) >= target) {
      best = hex;
      hi = t;
    } else {
      lo = t;
    }
  }
  return best;
}

const PROPS = [
  ["--text-color", "main"],
  ["--text-color-f1", "muted"],
  ["--text-color-f2", "muted"],
] as const;

/**
 * Raise the text against the page, or hand it back to the theme.
 *
 * Removing rather than restoring, so a later theme change is not overwritten
 * by whatever was on screen when this was switched on.
 */
export function applyContrastLevel(
  level: ContrastLevel,
  style: CSSStyleDeclaration = document.documentElement.style,
  read: () => CSSStyleDeclaration = () =>
    getComputedStyle(document.documentElement),
): void {
  if (level === "default") {
    for (const [prop] of PROPS) {
      style.removeProperty(prop);
    }
    return;
  }
  // Clear first, so the ground and the text are read as the theme paints
  // them rather than as this function last left them.
  for (const [prop] of PROPS) {
    style.removeProperty(prop);
  }
  const computed = read();
  const ground = computed.getPropertyValue("--background-color").trim();
  if (ground === "") {
    return;
  }
  for (const [prop, kind] of PROPS) {
    const target = kind === "main" ? TARGET[level] : MUTED[level];
    const current = computed.getPropertyValue(prop).trim();
    if (target == null || current === "") {
      continue;
    }
    try {
      style.setProperty(prop, reach(current, ground, target));
    } catch {
      // An unreadable colour is left exactly as the theme set it.
    }
  }
}
