import { type ReactNode } from "react";
import { useIntl } from "react-intl";
import * as styles from "./BrailleBadge.module.less";
import { ProfileAvatar } from "./ProfileAvatar.tsx";
import { type Avatar } from "./store.ts";

/**
 * Marks a learner who is on braille and audio.
 *
 * Kid and grown-up are told apart by the ordering and the colour chips in the
 * profile list, so they carry no letter anywhere. Braille does: it is the one
 * difference that changes what the app *does* rather than how it looks — that
 * learner gets a different page, a different lesson engine and a voice — and
 * whoever is setting the household up needs to see, at a glance and in every
 * place a profile appears, which one that is.
 */
export function BrailleBadge({
  size = "small",
}: {
  /** `large` for the picker tiles, where the avatar is 72px. */
  readonly size?: "small" | "large";
}): ReactNode {
  const { formatMessage } = useIntl();
  const label = formatMessage({
    id: "profiles.visionSupportShort",
    defaultMessage: "Braille and audio",
  });
  return (
    <span
      className={size === "large" ? styles.large : styles.small}
      title={label}
      aria-label={label}
      role="img"
    >
      B
    </span>
  );
}

/**
 * A learner's avatar with the braille badge pinned to its corner.
 *
 * Everywhere a learner is offered as a thing to pick — the header, the drawer
 * switcher, the who's-practising tiles — the badge belongs on the face, so it
 * travels with the identity and is read as part of it. The account list is the
 * exception: that is a table of rows with a column of category chips, and a
 * marker sitting in that column is easier to compare down the list than one
 * pinned to each avatar.
 */
export function BrailleAvatar({
  avatar,
  name,
  size = 64,
  braille,
  kind = "adult",
  accessible,
}: {
  readonly avatar: Avatar | null;
  readonly name: string;
  readonly size?: number;
  readonly braille: boolean;
  readonly kind?: "adult" | "kid";
  /**
   * This learner has an accessibility setting on.
   *
   * Marked on the face for the same reason braille is: it changes what the app
   * does for them rather than how it looks, and whoever is setting the
   * household up should be able to see which learner it applies to without
   * opening each one in turn.
   */
  readonly accessible?: boolean;
}): ReactNode {
  if (!braille && accessible !== true) {
    return (
      <ProfileAvatar avatar={avatar} name={name} size={size} kind={kind} />
    );
  }
  return (
    <span className={styles.pin} style={{ inlineSize: size, blockSize: size }}>
      <ProfileAvatar avatar={avatar} name={name} size={size} kind={kind} />
      {braille && <BrailleBadge size={size >= 56 ? "large" : "small"} />}
      {accessible === true && <AccessDot />}
    </span>
  );
}

/**
 * The opposite corner to the braille badge, so a learner who has both is not
 * wearing two marks in one place.
 */
function AccessDot(): ReactNode {
  const { formatMessage } = useIntl();
  const label = formatMessage({
    id: "profiles.accessibilityOn",
    defaultMessage: "Accessibility settings on",
  });
  return (
    <span
      className={styles.accessDot}
      title={label}
      aria-label={label}
      role="img"
    />
  );
}
