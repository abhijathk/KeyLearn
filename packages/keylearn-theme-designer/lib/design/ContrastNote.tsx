import { type Color, contrastRatio, contrastVerdict } from "@keylearn/color";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import { useCustomTheme } from "./context.ts";
import * as styles from "./ContrastNote.module.less";

/**
 * Says whether a pairing can actually be read.
 *
 * A household can mix its own theme here, and nothing checked the result — so
 * it was possible to save a theme whose practice text was almost invisible
 * against its own background and never be told. That matters more here than on
 * most screens: this is text somebody stares at, letter by letter, for an hour.
 *
 * The number is the WCAG 2.2 ratio. WCAG 3 will likely replace it with APCA,
 * which weighs font size and weight instead of applying one figure to
 * everything, and would suit a custom-theme app better — but APCA is still
 * moving, and this is the number that can be cited today.
 */
export function ContrastNote({
  text,
  ground,
  label,
}: {
  readonly text: (theme: ReturnType<typeof useCustomTheme>["theme"]) => Color;
  readonly ground: (theme: ReturnType<typeof useCustomTheme>["theme"]) => Color;
  readonly label: ReactNode;
}): ReactNode {
  const { theme } = useCustomTheme();
  const a = text(theme);
  const b = ground(theme);
  const ratio = contrastRatio(a, b);
  const verdict = contrastVerdict(a, b);
  return (
    <p
      className={styles.note}
      data-verdict={verdict}
      // Advice, not an error: the theme still saves. Announced politely so a
      // screen-reader user mixing a theme hears the verdict change.
      role="status"
    >
      <span className={styles.dot} aria-hidden={true} />
      {label} <b>{ratio.toFixed(1)}:1</b>{" "}
      {verdict === "body" && (
        <FormattedMessage
          id="designer.contrast.body"
          defaultMessage="— comfortable to read."
        />
      )}
      {verdict === "large" && (
        <FormattedMessage
          id="designer.contrast.large"
          defaultMessage="— readable at large sizes, hard work as body text. 4.5:1 is the mark to beat."
        />
      )}
      {verdict === "fail" && (
        <FormattedMessage
          id="designer.contrast.fail"
          defaultMessage="— too close to tell apart. Somebody will not be able to read this."
        />
      )}
    </p>
  );
}
