import { clsx } from "clsx";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import { BrailleAvatar } from "./profiles/BrailleBadge.tsx";
import * as styles from "./theme/ThemePicker.module.less";

type Chooseable = {
  readonly id: string;
  readonly firstName: string;
  readonly kind: "adult" | "kid";
  readonly avatar?: unknown;
  readonly visionSupport?: boolean;
};

/**
 * "Who are you setting this for?"
 *
 * The same row of learner chips the theme picker uses, lifted out so any panel
 * holding a per-learner setting asks the question the same way. A household
 * shares one login, so a panel that silently applied to whoever happened to be
 * signed in would be setting it for the wrong person half the time.
 */
export function ProfileChooser({
  profiles,
  chosenId,
  onChoose,
  marked,
}: {
  readonly profiles: readonly Chooseable[];
  readonly chosenId: string | null;
  readonly onChoose: (id: string) => void;
  /** Learners to flag with a dot — those who already have this setting on. */
  readonly marked?: (id: string) => boolean;
}): ReactNode {
  return (
    <div className={styles.who} role="group">
      {profiles.map((profile) => (
        <button
          key={profile.id}
          type="button"
          className={clsx(
            styles.whoBtn,
            profile.id === chosenId && styles.whoOn,
          )}
          aria-pressed={profile.id === chosenId}
          onClick={() => onChoose(profile.id)}
        >
          <BrailleAvatar
            avatar={profile.avatar as never}
            name={profile.firstName}
            size={28}
            braille={profile.visionSupport ?? false}
            kind={profile.kind}
            accessible={marked?.(profile.id) === true}
          />
          <span className={styles.whoText}>
            <span className={styles.whoName}>{profile.firstName}</span>
            <span className={styles.whoKind}>
              {profile.kind === "kid" ? (
                <FormattedMessage id="profiles.kid" defaultMessage="Kid" />
              ) : (
                <FormattedMessage
                  id="profiles.adult"
                  defaultMessage="Grown-up"
                />
              )}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
