import { clsx } from "clsx";
import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FormattedMessage } from "react-intl";
import * as styles from "./assessment.module.less";
import { useAssessment } from "./session.tsx";

/**
 * The clock, the run counter, and a way out.
 *
 * A strip across the top rather than a panel beside the text: during a run the
 * learner is reading one line in the middle of the screen, and anything placed
 * near it competes with the thing being measured. Portalled to the body so it
 * sits above the practice page's own chrome whichever surface is underneath.
 */
export function Hud(): ReactNode {
  const session = useAssessment();
  if (session == null || session.phase === "finished") {
    return null;
  }
  const { plan, phase, run, secondsLeft, audience } = session;
  const handleQuit = session.quit;
  const kid = audience === "kid";
  // Only in the last ten seconds. A clock that is red the whole way through
  // says nothing, and to a child it says something worse.
  const low = phase === "running" && secondsLeft <= 10;

  return createPortal(
    <div
      className={clsx(styles.hud, kid && styles.hudKid, low && styles.hudLow)}
      role="status"
      aria-live="polite"
    >
      <span className={styles.hudTitle}>
        {kid ? (
          <FormattedMessage id="assess.hud.kid" defaultMessage="The big go" />
        ) : (
          <FormattedMessage id="assess.hud" defaultMessage="Assessment" />
        )}
      </span>

      {plan.runs > 1 && (
        <span className={styles.hudRuns}>
          <FormattedMessage
            id="assess.hud.run"
            defaultMessage="Run {run} of {runs}"
            values={{ run, runs: plan.runs }}
          />
        </span>
      )}

      <span className={styles.hudSpacer} />

      {phase === "armed" ? (
        <span className={styles.hudArmed}>
          {kid ? (
            <FormattedMessage
              id="assess.hud.armed.kid"
              defaultMessage="Press a key when you’re ready"
            />
          ) : (
            <FormattedMessage
              id="assess.hud.armed"
              defaultMessage="The clock starts on your first keystroke"
            />
          )}
        </span>
      ) : (
        <span className={styles.hudClock}>{clock(secondsLeft)}</span>
      )}

      <button type="button" className={styles.hudQuit} onClick={handleQuit}>
        {kid ? (
          <FormattedMessage id="assess.hud.quit.kid" defaultMessage="Stop" />
        ) : (
          <FormattedMessage id="assess.hud.quit" defaultMessage="Leave" />
        )}
      </button>
    </div>,
    document.body,
  );
}

/**
 * The pause between runs.
 *
 * Deliberately a beat rather than a rolling clock. Three minutes of typing
 * with no gap is a stamina test, which is not what is being measured.
 */
export function BetweenRuns(): ReactNode {
  const session = useAssessment();
  if (session == null || session.phase !== "between") {
    return null;
  }
  const kid = session.audience === "kid";
  const done = session.run - 1;
  const handleQuit = session.quit;
  const handleNext = session.next;
  return createPortal(
    <div className={styles.overlay} role="presentation">
      <div className={clsx(styles.dialog, kid && styles.dialogKid)}>
        <div className={styles.dialogHead}>
          <span>
            <FormattedMessage
              id="assess.between.title"
              defaultMessage="Run {done} of {runs} done"
              values={{ done, runs: session.plan.runs }}
            />
          </span>
        </div>
        <div className={styles.dialogBody}>
          <p className={styles.between}>
            <FormattedMessage
              id="assess.between.body"
              defaultMessage="Take a moment. Nothing is decided by one run — the sitting is scored on the middle of all {runs}."
              values={{ runs: session.plan.runs }}
            />
          </p>
        </div>
        <div className={styles.dialogFoot}>
          <button type="button" className={styles.btn} onClick={handleQuit}>
            <FormattedMessage
              id="assess.between.leave"
              defaultMessage="Leave"
            />
          </button>
          <span className={styles.dialogSpacer} />
          <button
            type="button"
            className={clsx(styles.btn, styles.btnGo)}
            onClick={handleNext}
          >
            <FormattedMessage
              id="assess.between.next"
              defaultMessage="Start run {next}"
              values={{ next: session.run }}
            />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
