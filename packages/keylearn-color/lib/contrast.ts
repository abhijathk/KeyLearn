import { type Color } from "./color.ts";

/**
 * Relative luminance as WCAG defines it.
 *
 * Not the same as `Color.luminance()`, which weights the sRGB values as they
 * come. WCAG wants them linearised first — undoing the display gamma — and the
 * difference is large enough to move a colour across a pass/fail line, so the
 * two must not be confused.
 */
export function relativeLuminance(color: Color): number {
  const { r, g, b } = color.toRgb();
  const channel = (v: number) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * The contrast between two colours, from 1 (identical) to 21 (black on white).
 *
 * WCAG 2.2 asks for 4.5 for body text and 3 for large text or for the parts of
 * a control that carry its meaning. WCAG 3 will likely replace this with APCA,
 * which accounts for font size and weight rather than applying one ratio to
 * everything — but APCA is still moving, and this is the number that can
 * actually be cited today.
 *
 * Alpha is ignored: a translucent colour's contrast depends on whatever is
 * behind it, which is not knowable here. Callers should pass the composited
 * colour if they have it.
 */
export function contrastRatio(a: Color, b: Color): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** What a pairing is good for, in the terms WCAG 2.2 uses. */
export type ContrastVerdict = "body" | "large" | "fail";

/**
 * Judge a pairing.
 *
 * "large" means 18.66px bold or 24px regular and up — the size at which WCAG
 * relaxes the requirement to 3:1. Anything below 3:1 fails for text at any
 * size, and is only permissible for decoration.
 */
export function contrastVerdict(a: Color, b: Color): ContrastVerdict {
  const ratio = contrastRatio(a, b);
  if (ratio >= 4.5) {
    return "body";
  }
  if (ratio >= 3) {
    return "large";
  }
  return "fail";
}
