import { type ClassName } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode } from "react";
import braille from "./assets/medal-braille.png";
import bronze from "./assets/medal-bronze.png";
import completion from "./assets/medal-completion.png";
import gold from "./assets/medal-gold.png";
import silver from "./assets/medal-silver.png";
import * as styles from "./Medal.module.less";

/**
 * A medal for one earned certificate.
 *
 * Struck artwork rather than drawn markup. These were traced out of a single
 * rendered sheet and cut to shape — the disc, the loop and the bar between
 * them — so the loop's hole is genuinely transparent and the medal sits on any
 * background. A vector version would have thrown away the thing that makes
 * them read as metal: the bevel catching light on one edge and shadow on the
 * other.
 *
 * All five together are 45 kB, which is less than one photograph.
 */
export type MedalKind = "completion" | "gold" | "silver" | "bronze" | "braille";

const ART: Readonly<Record<MedalKind, string>> = {
  completion,
  gold,
  silver,
  bronze,
  braille,
};

/** English fallback; the UI renders a translated name. */
const NAME: Readonly<Record<MedalKind, string>> = {
  completion: "Completion",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  braille: "Braille completion",
};

export function Medal({
  kind,
  size = "normal",
  title,
  className,
}: {
  readonly kind: MedalKind;
  /** `pin` is the size it sits at on an avatar; `hero` the ready-to-sit card. */
  readonly size?: "pin" | "small" | "normal" | "hero";
  readonly title?: string;
  readonly className?: ClassName;
}): ReactNode {
  const label = title ?? NAME[kind];
  return (
    <img
      className={clsx(styles.root, styles[size], className)}
      src={ART[kind]}
      alt={label}
      title={label}
      // Decoding off the main thread: several of these can appear at once in
      // the household list, and none of them is worth a frame.
      decoding="async"
      loading="lazy"
    />
  );
}

/**
 * Which medal an issued certificate wears.
 *
 * A braille certificate gets the braille medal whatever its level, because the
 * thing worth saying about it is the code, not the tier — and the tier is
 * already printed on the certificate itself.
 */
export function medalFor(level: string, kind: "typing" | "braille"): MedalKind {
  if (kind === "braille") {
    return "braille";
  }
  switch (level) {
    case "gold":
    case "silver":
    case "bronze":
      return level;
    default:
      return "completion";
  }
}
