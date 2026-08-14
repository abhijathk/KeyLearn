import { supportUrl } from "@keylearn/thirdparties";
import { FloatingShell } from "@keylearn/widget";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import supportBanner from "../assets/support-banner.png";
import * as styles from "./SupportDialog.module.less";

/**
 * Shown before the coffee link hands off to Buy Me a Coffee — a brief,
 * dismissible "why support" moment rather than a silent new tab.
 */
export function SupportDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}): ReactNode {
  if (!open) {
    return null;
  }
  return (
    <FloatingShell compact={true} hideClose={true} onClose={onClose}>
      <img className={styles.banner} src={supportBanner} alt="" />
      <div className={styles.content}>
        <p className={styles.body}>
          <FormattedMessage
            id="supportDialog.body"
            defaultMessage="KeyLearn is free for every learner — no ads, no subscriptions. If it's helped you or your kids, a coffee helps keep it that way."
          />
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            <FormattedMessage
              id="supportDialog.cancel"
              defaultMessage="Cancel"
            />
          </button>
          <a
            className={styles.support}
            href={supportUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={onClose}
          >
            <FormattedMessage
              id="supportDialog.support"
              defaultMessage="Support KeyLearn"
            />
          </a>
        </div>
      </div>
    </FloatingShell>
  );
}
