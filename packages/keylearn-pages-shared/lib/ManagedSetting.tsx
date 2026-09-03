import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./ManagedSetting.module.less";
import { useLearnerOverride } from "./site-config.ts";

/**
 * Wraps one learner control so the control centre's override (phase 3.4)
 * reaches the screen: "hidden" removes the control, "forced" shows it
 * inert with a line saying the site decides. The value itself is forced
 * one layer down (Settings.setForced or the storage module), so a control
 * that is not wrapped still applies the site's value; wrapping only stops
 * it looking editable.
 */
export function ManagedSetting({
  prop,
  children,
}: {
  /** The settings prop key, as PageData.learnerOverrides spells it. */
  readonly prop: string;
  readonly children: ReactNode;
}): ReactNode {
  const mode = useLearnerOverride(prop);
  if (mode === "hidden") {
    return null;
  }
  if (mode === "forced") {
    return (
      <div className={styles.forced}>
        <div className={styles.inert} inert={true} aria-disabled={true}>
          {children}
        </div>
        <p className={styles.note}>
          <FormattedMessage
            id="settings.managed"
            defaultMessage="Set by the site for every learner."
          />
        </p>
      </div>
    );
  }
  return children;
}
