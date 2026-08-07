import { printedFields } from "@keylearn/certificate";
import {
  certificateFileName,
  certificatePdf,
  certificatePng,
  CertificateSheet,
} from "@keylearn/certificate-ui";
import { type IssuedCertificate } from "@keylearn/pages-shared";
import { clsx } from "clsx";
import { type ReactNode, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FormattedMessage } from "react-intl";
import * as styles from "./assessment.module.less";
import { CertificateShare } from "./CertificateShare.tsx";

/**
 * The certificate itself, and the two ways to keep it.
 *
 * PDF for printing — one page, the sheet centred on A4 at its own proportions,
 * which is what a framer and a school office both expect. PNG for everything
 * else: sending it to a grandparent, or putting it in a school report.
 */
export function CertificateDialog({
  certificate,
  languageLine,
  onClose,
}: {
  readonly certificate: IssuedCertificate;
  /** "English · QWERTY", or the braille code. Resolved by the caller. */
  readonly languageLine: string;
  readonly onClose: () => void;
}): ReactNode {
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);
  const [failed, setFailed] = useState(false);

  const printed = useMemo(
    () =>
      printedFields({
        sheet: certificate.sheet,
        kind: certificate.kind,
        level: certificate.level,
        name: certificate.name,
        languageLine,
        speed: certificate.speed,
        accuracy: certificate.accuracy,
        number: certificate.number,
        issued: new Date(certificate.issued),
      }),
    [certificate, languageLine],
  );

  const download = async (format: "png" | "pdf") => {
    setBusy(format);
    setFailed(false);
    try {
      const blob =
        format === "png"
          ? await certificatePng(printed)
          : await certificatePdf(printed);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = certificateFileName(printed, format);
      link.click();
      // Freed on the next turn rather than immediately: revoking inside the
      // same tick cancels the download in some browsers.
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 0);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  const kid = certificate.audience === "kid";

  return createPortal(
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={clsx(
          styles.dialog,
          styles.dialogWide,
          kid && styles.dialogKid,
        )}
        role="dialog"
        aria-modal={true}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className={styles.dialogHead}>
          <span>
            <FormattedMessage
              id="assess.cert.title"
              defaultMessage="Certificate"
            />
          </span>
          <span className={styles.dialogSpacer} />
          <button
            type="button"
            className={styles.dialogClose}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className={styles.dialogBody}>
          <CertificateSheet printed={printed} className={styles.sheet} />
          <p className={styles.certNote}>
            <FormattedMessage
              id="assess.cert.number"
              defaultMessage="Number {number}. Anyone can check it at keylearn.com/verify — it says the level and the date, and never who holds it unless that was asked for."
              values={{ number: printed.values.at(-1) }}
            />
          </p>
          {/* Grown-ups only. Everything else about a child's record here is
              built so a stranger cannot work out who they are, and a share
              button would undo that in one click — a parent who wants to show
              somebody sends the PDF, which goes to a person rather than to an
              audience. */}
          {!kid && (
            <CertificateShare
              certificate={certificate}
              origin={
                typeof window === "undefined"
                  ? "https://www.keylearn.com"
                  : window.location.origin
              }
            />
          )}
          {failed && (
            <p className={styles.certWarn}>
              <FormattedMessage
                id="assess.cert.failed"
                defaultMessage="The file could not be made. The certificate is safe — it is on the account page whenever you want it."
              />
            </p>
          )}
        </div>

        <div className={styles.dialogFoot}>
          <span className={styles.dialogSpacer} />
          <button
            type="button"
            className={styles.btn}
            disabled={busy != null}
            onClick={() => {
              void download("png");
            }}
          >
            {busy === "png" ? (
              <FormattedMessage
                id="assess.cert.making"
                defaultMessage="Making…"
              />
            ) : (
              <FormattedMessage
                id="assess.cert.png"
                defaultMessage="Download PNG"
              />
            )}
          </button>
          <button
            type="button"
            className={clsx(styles.btn, styles.btnGo)}
            disabled={busy != null}
            onClick={() => {
              void download("pdf");
            }}
          >
            {busy === "pdf" ? (
              <FormattedMessage
                id="assess.cert.making2"
                defaultMessage="Making…"
              />
            ) : (
              <FormattedMessage
                id="assess.cert.pdf"
                defaultMessage="Download PDF"
              />
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
