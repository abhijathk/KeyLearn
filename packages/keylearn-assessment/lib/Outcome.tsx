import {
  type AssessmentVerdict,
  type CertificateAudience,
  MIN_SITTINGS,
  outcomeMessage,
} from "@keylearn/certificate";
import { type IssuedCertificate } from "@keylearn/pages-shared";
import { clsx } from "clsx";
import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FormattedMessage } from "react-intl";
import * as styles from "./assessment.module.less";

export type Outcome =
  /** The sitting is on its way to the server. */
  | { readonly state: "sending" }
  | { readonly state: "won"; readonly certificate: IssuedCertificate }
  | {
      readonly state: "judged";
      readonly verdict: AssessmentVerdict;
    }
  /** Eligibility went away between opening the page and finishing — rare. */
  | { readonly state: "not-eligible" }
  /**
   * The clock ran out without a single line being finished.
   *
   * Kept apart from `error` because they are different things and the fix is
   * different. Reporting a network failure when nothing was ever sent sends
   * somebody to check their connection over a run they simply did not
   * complete.
   */
  | { readonly state: "empty" }
  | { readonly state: "error" };

/**
 * What happened, said once.
 *
 * A child is never told they failed. There is no cross, no red, and no figure
 * they fell short of — only that it is not yet, and where the rest of it comes
 * from. Which sentence appears is decided in `outcomeMessage`, next to the
 * rules, so it cannot drift away from what was actually judged.
 */
export function OutcomeDialog({
  outcome,
  audience,
  name,
  onAgain,
  onLeave,
  onShow,
}: {
  readonly outcome: Outcome;
  readonly audience: CertificateAudience;
  readonly name: string;
  readonly onAgain: () => void;
  readonly onLeave: () => void;
  /** Open the certificate. Only offered when there is one. */
  readonly onShow: () => void;
}): ReactNode {
  const kid = audience === "kid";
  const message =
    outcome.state === "judged"
      ? outcomeMessage(outcome.verdict, audience)
      : null;

  return createPortal(
    <div className={styles.overlay} role="presentation">
      <div
        className={clsx(styles.dialog, kid && styles.dialogKid)}
        role="dialog"
        aria-modal={true}
      >
        <div className={styles.dialogHead}>
          <span>{title(outcome, kid, name)}</span>
        </div>

        <div className={styles.dialogBody}>
          {outcome.state === "sending" && (
            <p className={styles.between}>
              <FormattedMessage
                id="assess.out.sending"
                defaultMessage="Recording the sitting…"
              />
            </p>
          )}

          {outcome.state === "won" && (
            <p className={styles.between}>
              {kid ? (
                <FormattedMessage
                  id="assess.out.won.kid"
                  defaultMessage="You did it. Your certificate has your name on it."
                />
              ) : (
                <FormattedMessage
                  id="assess.out.won"
                  defaultMessage="Earned. The certificate carries a number anyone can check."
                />
              )}
            </p>
          )}

          {message != null && (
            <>
              <p className={styles.between}>{message.text}</p>
              {/* The figures, but only for a grown-up. A child who has just
                  been told "not yet, and kindly" does not then need the
                  number they missed by. */}
              {!kid && outcome.state === "judged" && (
                <Figures verdict={outcome.verdict} />
              )}
            </>
          )}

          {outcome.state === "not-eligible" && (
            <p className={styles.between}>
              <FormattedMessage
                id="assess.out.notEligible"
                defaultMessage="The practice record no longer meets the entry conditions, so this sitting cannot be judged. It has been kept."
              />
            </p>
          )}

          {outcome.state === "empty" && (
            <p className={styles.between}>
              {kid ? (
                <FormattedMessage
                  id="assess.out.empty.kid"
                  defaultMessage="The time ran out before you finished a line, so there was nothing to measure. Nothing is lost — have another go whenever you like."
                />
              ) : (
                <FormattedMessage
                  id="assess.out.empty"
                  defaultMessage="The time ran out before a single line was finished, so there is nothing to score. This sitting was not recorded."
                />
              )}
            </p>
          )}

          {outcome.state === "error" && (
            <p className={styles.between}>
              <FormattedMessage
                id="assess.out.error"
                defaultMessage="The sitting could not be sent — this needs a connection, because the number comes from the server. Nothing else is lost."
              />
            </p>
          )}
        </div>

        <div className={styles.dialogFoot}>
          <button type="button" className={styles.btn} onClick={onLeave}>
            <FormattedMessage id="assess.out.leave" defaultMessage="Done" />
          </button>
          <span className={styles.dialogSpacer} />
          {outcome.state === "won" ? (
            <button
              type="button"
              className={clsx(styles.btn, styles.btnGo)}
              onClick={onShow}
            >
              {kid ? (
                <FormattedMessage
                  id="assess.out.show.kid"
                  defaultMessage="See it!"
                />
              ) : (
                <FormattedMessage
                  id="assess.out.show"
                  defaultMessage="Open the certificate"
                />
              )}
            </button>
          ) : (
            outcome.state !== "sending" && (
              <button
                type="button"
                className={clsx(styles.btn, styles.btnGo)}
                onClick={onAgain}
              >
                {kid ? (
                  <FormattedMessage
                    id="assess.out.again.kid"
                    defaultMessage="Go again"
                  />
                ) : (
                  <FormattedMessage
                    id="assess.out.again"
                    defaultMessage="Sit it again"
                  />
                )}
              </button>
            )
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function title(outcome: Outcome, kid: boolean, name: string): ReactNode {
  switch (outcome.state) {
    case "won":
      return kid ? (
        <FormattedMessage
          id="assess.out.title.won.kid"
          defaultMessage="{name}, you did it!"
          values={{ name }}
        />
      ) : (
        <FormattedMessage
          id="assess.out.title.won"
          defaultMessage="Certificate earned"
        />
      );
    case "sending":
      return (
        <FormattedMessage
          id="assess.out.title.sending"
          defaultMessage="That’s the sitting"
        />
      );
    default:
      return kid ? (
        <FormattedMessage
          id="assess.out.title.kid"
          defaultMessage="Good going"
        />
      ) : (
        <FormattedMessage
          id="assess.out.title"
          defaultMessage="Sitting recorded"
        />
      );
  }
}

/** Where this sitting left the learner, against what the certificate asks. */
function Figures({
  verdict,
}: {
  readonly verdict: AssessmentVerdict;
}): ReactNode {
  // Written out rather than built from a list: the labels have to be literal
  // for the message extractor, and before the third sitting the median rows
  // genuinely do not exist yet.
  return (
    <div className={styles.figs}>
      {verdict.speed != null && (
        <Fig
          value={`${verdict.speed.toFixed(1)} / ${verdict.required.speed}`}
          met={verdict.speed >= verdict.required.speed}
        >
          <FormattedMessage id="assess.fig.speed" defaultMessage="Speed" />
        </Fig>
      )}
      {verdict.accuracy != null && (
        <Fig
          value={`${(verdict.accuracy * 100).toFixed(1)}% / ${Math.round(
            verdict.required.accuracy * 100,
          )}%`}
          met={verdict.accuracy >= verdict.required.accuracy}
        >
          <FormattedMessage id="assess.fig.acc" defaultMessage="Accuracy" />
        </Fig>
      )}
      {verdict.retained != null && (
        <Fig
          value={`${Math.round(verdict.retained * 100)}% / ${Math.round(
            verdict.retentionRequired * 100,
          )}%`}
          met={verdict.retained >= verdict.retentionRequired}
        >
          <FormattedMessage
            id="assess.fig.retained"
            defaultMessage="Held of your practice pace"
          />
        </Fig>
      )}
      <Fig
        value={`${verdict.sittings} / ${MIN_SITTINGS}`}
        met={verdict.sittings >= MIN_SITTINGS}
      >
        <FormattedMessage id="assess.fig.sittings" defaultMessage="Sittings" />
      </Fig>
    </div>
  );
}

function Fig({
  value,
  met,
  children,
}: {
  readonly value: string;
  readonly met: boolean;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <span className={clsx(styles.fig, met && styles.figMet)}>
      <i>{children}</i>
      <b>{value}</b>
    </span>
  );
}
