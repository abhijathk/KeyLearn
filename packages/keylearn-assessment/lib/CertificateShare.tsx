import {
  type IssuedCertificate,
  setCertificateNamed,
} from "@keylearn/pages-shared";
import { ConfirmDialog } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useState } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./assessment.module.less";

/**
 * Sharing a certificate.
 *
 * Grown-ups only, and not as an oversight. Everything else about a child's
 * record in this app is built so that a stranger reading it cannot work out
 * who the child is; a share button that posts their name and their school year
 * to a public timeline would undo all of it in one click. A parent who wants
 * to show somebody can send the PDF, which goes to a person rather than to an
 * audience.
 *
 * What is shared is the *verification link*, never an image of the sheet. The
 * image proves nothing — anybody can make one — and the link is the entire
 * point of a certificate carrying a number.
 */
export function CertificateShare({
  certificate,
  origin,
}: {
  readonly certificate: IssuedCertificate;
  /** Where the verify page lives. Passed in so tests are not tied to a host. */
  readonly origin: string;
}): ReactNode {
  const [named, setNamed] = useState(certificate.nameVisible);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  // What the tick would do, held until it is confirmed. Both directions ask:
  // turning it on publishes a name to anybody holding the number, and turning
  // it off quietly breaks a link somebody may already have given an employer.
  const [asking, setAsking] = useState<boolean | null>(null);

  const url = `${origin}/verify/${certificate.number}`;
  const issued = new Date(certificate.issued);
  const title =
    certificate.kind === "braille"
      ? "Braille Typing — Certificate of Completion"
      : "Touch Typing — Certificate of Completion";

  // LinkedIn's own "add a licence or certification" flow, pre-filled. It is
  // the one link here that puts the certificate somewhere lasting rather than
  // into a feed that scrolls past.
  const linkedIn =
    "https://www.linkedin.com/profile/add?" +
    new URLSearchParams({
      startTask: "CERTIFICATION_NAME",
      name: title,
      organizationName: "KeyLearn",
      issueYear: String(issued.getFullYear()),
      issueMonth: String(issued.getMonth() + 1),
      certUrl: url,
      certId: certificate.number,
    }).toString();

  const wording = `I finished the KeyLearn ${
    certificate.kind === "braille" ? "braille" : "touch typing"
  } course.`;

  const share = (href: string) => {
    // A named window rather than the current tab: leaving the page mid-share
    // would lose an unsaved download.
    window.open(href, "_blank", "noopener,noreferrer");
  };

  // Saved the moment it is confirmed — there is no second button to press,
  // because a confirmation that then needs saving is two decisions dressed as
  // one, and the one people forget is the second.
  const applyNamed = async (next: boolean) => {
    setAsking(null);
    setBusy(true);
    // Optimistic, then corrected. This is a preference rather than a
    // transaction, and a checkbox that lags a round trip feels broken.
    setNamed(next);
    if (!(await setCertificateNamed(certificate.number, next))) {
      setNamed(!next);
    }
    setBusy(false);
  };

  return (
    <div className={styles.share}>
      <div className={styles.shareLabel}>
        <FormattedMessage id="assess.share.title" defaultMessage="Share it" />
      </div>

      <div className={styles.shareRow}>
        <button
          type="button"
          className={clsx(styles.btn, styles.btnGo)}
          onClick={() => share(linkedIn)}
        >
          <FormattedMessage
            id="assess.share.linkedin"
            defaultMessage="Add to LinkedIn profile"
          />
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() =>
            share(
              "https://www.linkedin.com/sharing/share-offsite/?" +
                new URLSearchParams({ url }).toString(),
            )
          }
        >
          <FormattedMessage
            id="assess.share.linkedinPost"
            defaultMessage="Post on LinkedIn"
          />
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() =>
            share(
              "https://x.com/intent/tweet?" +
                new URLSearchParams({ text: wording, url }).toString(),
            )
          }
        >
          <FormattedMessage id="assess.share.x" defaultMessage="Post on X" />
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() =>
            share(
              "https://www.facebook.com/sharer/sharer.php?" +
                new URLSearchParams({ u: url }).toString(),
            )
          }
        >
          <FormattedMessage
            id="assess.share.facebook"
            defaultMessage="Share on Facebook"
          />
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => {
                setCopied(false);
              }, 2000);
            });
          }}
        >
          {copied ? (
            <FormattedMessage
              id="assess.share.copied"
              defaultMessage="Link copied"
            />
          ) : (
            <FormattedMessage
              id="assess.share.copy"
              defaultMessage="Copy the link"
            />
          )}
        </button>
      </div>

      {/* The one thing worth deciding before sharing. Off by default, because
          a number that says only "this was earned, on this date" is the more
          private answer and most people never need more than that. */}
      <label className={styles.shareNamed}>
        <input
          type="checkbox"
          checked={named}
          disabled={busy}
          onChange={() => {
            setAsking(!named);
          }}
        />
        <span>
          <FormattedMessage
            id="assess.share.named"
            defaultMessage="Show my name when someone checks this number"
          />
        </span>
      </label>
      <p className={styles.shareNote}>
        {named ? (
          <FormattedMessage
            id="assess.share.named.on"
            defaultMessage="Anyone with the number sees {name}, the level and the date."
            values={{ name: certificate.name }}
          />
        ) : (
          <FormattedMessage
            id="assess.share.named.off"
            defaultMessage="Anyone with the number sees the level and the date, and no name. You can change this at any time."
          />
        )}
      </p>

      {asking != null && (
        <ConfirmDialog
          title={asking ? "Show your name?" : "Stop showing your name?"}
          message={
            asking
              ? `Anyone who types ${certificate.number} into the check page will see ${certificate.name}, along with the level and the date. Use this when you are sharing the certificate with somebody who needs to confirm it is yours.`
              : `The check page will stop naming you. The number stays valid, but anybody you have already given it to — an employer checking a CV — will no longer see who it belongs to.`
          }
          confirmLabel={asking ? "Show my name" : "Hide my name"}
          onConfirm={() => {
            void applyNamed(asking);
          }}
          onCancel={() => {
            setAsking(null);
          }}
        />
      )}
    </div>
  );
}
