import { LoadingProgress } from "@keylearn/pages-shared";
import { supportUrl } from "@keylearn/thirdparties";
import { FloatingShell } from "@keylearn/widget";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import supportBanner from "../assets/support-banner.png";
import * as styles from "./SupportDialog.module.less";

/**
 * Shown before the coffee link hands off to Buy Me a Coffee — a brief,
 * dismissible "why support" moment rather than a silent new tab.
 *
 * **Why it waits for its own artwork.** The banner is a PNG of some size and
 * the dialog is small, so in production the panel arrived first and the
 * picture dropped in a second or two later — the text reflowing under it as
 * it did. An ask for money that assembles itself while you read it reads as
 * broken, which is the worst possible framing for this particular dialog.
 *
 * So the shell opens immediately (the click must feel answered) and holds the
 * KeyLearn loader until the image is decoded, then shows everything at once.
 * `LoadingProgress` holds itself back for 200ms before painting, so a cached
 * banner — which is every time after the first — shows no loader at all
 * rather than a flash of one.
 */
export function SupportDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}): ReactNode {
  const ready = useBannerReady(open);
  if (!open) {
    return null;
  }
  if (!ready) {
    return (
      <FloatingShell compact={true} hideClose={true} onClose={onClose}>
        <div className={styles.loading}>
          <LoadingProgress />
        </div>
      </FloatingShell>
    );
  }
  return (
    <FloatingShell compact={true} hideClose={true} onClose={onClose}>
      <img className={styles.banner} src={supportBanner} alt="" />
      <div className={styles.content}>
        <p className={styles.body}>
          <FormattedMessage
            id="supportDialog.body"
            defaultMessage="KeyLearn is free for every learner — no advertising network, no subscriptions. If it’s helped you or your kids, a coffee helps keep it that way."
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

/**
 * Whether the banner has finished decoding.
 *
 * `decode()` rather than an `onLoad` handler, because `load` fires when the
 * bytes have arrived and not when the browser can actually paint them — the
 * gap is small but it is exactly the pop this exists to remove. It also
 * settles the cached case without a special path: a decoded image resolves
 * immediately.
 *
 * Any failure resolves to ready rather than sticking. A dialog that never
 * opens because a decorative image 404d would be a worse bug than the one
 * being fixed, and the `alt=""` banner is decorative by declaration.
 */
function useBannerReady(open: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!open || ready) {
      return;
    }
    let live = true;
    const img = new Image();
    img.src = supportBanner;
    void img
      .decode()
      .catch(() => {})
      .then(() => {
        if (live) {
          setReady(true);
        }
      });
    return () => {
      live = false;
    };
  }, [open, ready]);
  return ready;
}
