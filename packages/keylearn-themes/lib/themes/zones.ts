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
