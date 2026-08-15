import { FormattedMessage } from "react-intl";
import * as styles from "./SmallScreenGate.module.less";

// Pure-CSS gated: the markup is always in the DOM and a media query in
// SmallScreenGate.module.less shows or hides it, so it tracks window resizes
// and orientation changes with no JS state and no layout flash on load.
export function SmallScreenGate() {
  return (
    <div className={styles.screen} role="alert">
      <div className={styles.card}>
        <div className={styles.iconBox} aria-hidden={true}>
          <svg viewBox="0 0 24 24">
            <rect x="3" y="4.5" width="18" height="11" rx="1.6" />
            <path d="M9 19.5h6M12 15.5v4" />
          </svg>
        </div>
        <h1 className={styles.title}>
          <FormattedMessage
            id="template.smallScreen.title"
            defaultMessage="Made for a bigger screen"
          />
        </h1>
        <p className={styles.body}>
          <FormattedMessage
            id="template.smallScreen.body"
            defaultMessage="KeyLearn needs room for a full keyboard and your practice text side by side. Please switch to a laptop or desktop to continue."
          />
        </p>
      </div>
    </div>
  );
}
