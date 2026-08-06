import {
  ADULT_BRAILLE,
  ADULT_TYPING,
  type CertificateEvidence,
  certificateTemplate,
  planFor,
  RETENTION,
} from "@keylearn/certificate";
import { clsx } from "clsx";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./CoursePane.module.less";

/**
 * The assessment guide.
 *
 * Every figure here is read from the criteria rather than written into the
 * prose. A help page with hand-typed numbers starts lying the first time a
 * threshold is tuned, and a help page that lies is worse than none.
 *
 * Three documents, not one translated three ways. A grown-up is told how
 * people fail, which is the most useful thing you can say before a test. A
 * braille learner gets the shape before the detail, because audio cannot be
 * skimmed. A child gets no questions and answers at all — a list of worries
 * they have not had yet only teaches them there are some.
 */
export function GuideDialog({
  evidence,
  onClose,
}: {
  readonly evidence: CertificateEvidence;
  readonly onClose: () => void;
}): ReactNode {
  const sheet = certificateTemplate(evidence.age, evidence.audience);
  const child = sheet === "child";
  const braille = evidence.kind === "braille";
  const plan = planFor(evidence.audience, evidence.age);
  const bar = braille ? ADULT_BRAILLE : ADULT_TYPING;
  const retention = Math.round(
    (evidence.audience === "kid" ? RETENTION.kid : RETENTION.adult) * 100,
  );

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={clsx(styles.dialog, child && styles.dialogKid)}
        role="dialog"
        aria-modal={true}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className={styles.dialogHead}>
          <span>
            {child ? (
              <FormattedMessage
                id="guide.title.kid"
                defaultMessage="About the big go"
              />
            ) : (
              <FormattedMessage
                id="guide.title"
                defaultMessage="About the assessment"
              />
            )}
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
          {child ? (
            <KidGuide seconds={plan.seconds} />
          ) : (
            <>
              {braille && (
                <>
                  {/* The listening controls come first, and then the shape of
                      the page, because a listener cannot skim ahead to find
                      out how long this is going to be. */}
                  <div className={styles.listen}>
                    <button type="button" className={styles.btn}>
                      <FormattedMessage
                        id="guide.readAloud"
                        defaultMessage="▶ Read this page"
                      />
                    </button>
                  </div>
                  <div className={styles.shape}>
                    <FormattedMessage
                      id="guide.shape"
                      defaultMessage="Four things, in this order: what happens, what is judged, how people fall short, and two questions."
                    />
                  </div>
                </>
              )}

              <div className={styles.label}>
                <FormattedMessage
                  id="guide.what"
                  defaultMessage="What happens"
                />
              </div>
              <p className={styles.guideP}>
                <FormattedMessage
                  id="guide.what.body"
                  defaultMessage="{runs} runs of {seconds} seconds, on {what} you have not met before. {hint} and cannot be turned back on. Sit it as often as you like."
                  values={{
                    runs: plan.runs,
                    seconds: plan.seconds,
                    what: braille ? "dictation" : "text",
                    hint: braille
                      ? "Hints and spell-out are off"
                      : "The on-screen keyboard and the hand guide are off",
                  }}
                />
              </p>

              <div className={styles.label}>
                <FormattedMessage
                  id="guide.judged"
                  defaultMessage="What is judged"
                />
              </div>
              <p className={styles.guideP}>
                <FormattedMessage
                  id="guide.judged.body"
                  defaultMessage="The middle of your last three sittings — never your best, so one lucky run cannot carry you and one bad one cannot sink you. You need {speed} {unit}, {acc}% accuracy, and to hold {ret}% of the pace you practise at."
                  values={{
                    speed: bar.speed,
                    unit: braille ? "cells a minute" : "wpm",
                    acc: Math.round(bar.accuracy * 100),
                    ret: retention,
                  }}
                />
              </p>

              <div className={styles.label}>
                <FormattedMessage
                  id="guide.fail"
                  defaultMessage="How people fall short"
                />
              </div>
              <div className={styles.guideFlag}>
                <i />
                <span>
                  {braille ? (
                    <FormattedMessage
                      id="guide.fail.brl"
                      defaultMessage="The cell is still being assembled from the prompt. With hints off there is nothing to assemble from, and the pace drops. Practising with them faded is what closes it."
                    />
                  ) : (
                    <FormattedMessage
                      id="guide.fail.keys"
                      defaultMessage="Speed collapses without the keyboard picture. This is much the commonest, and it is the whole reason the picture goes away. If you drop a third, you have been reading the keys — practise with the hint off and it closes."
                    />
                  )}
                </span>
              </div>
              <div className={styles.guideFlag}>
                <i />
                <span>
                  <FormattedMessage
                    id="guide.fail.acc"
                    defaultMessage="Accuracy falls under the clock. Slowing down is the fix: accuracy is worth more than speed here, and the median forgives one nervous run."
                  />
                </span>
              </div>

              <div className={styles.label}>
                <FormattedMessage
                  id="guide.questions"
                  defaultMessage="Questions"
                />
              </div>
              <Question
                q="What if I stop halfway?"
                a="The run is discarded. It is not a failure and not a free retry — the next three sittings still have to agree."
              />
              <Question
                q="Can I lose a certificate I already have?"
                a="No. Sitting again can only add a higher one."
              />
            </>
          )}
        </div>

        <div className={styles.dialogFoot}>
          <span className={styles.dialogSpacer} />
          <button
            type="button"
            className={clsx(styles.btn, styles.btnGo)}
            onClick={onClose}
          >
            {child ? (
              <FormattedMessage id="guide.close.kid" defaultMessage="Got it!" />
            ) : (
              <FormattedMessage id="guide.close" defaultMessage="Close" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Question({
  q,
  a,
}: {
  readonly q: string;
  readonly a: string;
}): ReactNode {
  return (
    <div className={styles.qa}>
      <p className={styles.q}>{q}</p>
      <p className={styles.a}>{a}</p>
    </div>
  );
}

/**
 * Five reassurances, and nothing shaped like a question.
 *
 * A list of things a seven-year-old has not asked yet mostly teaches them
 * there are things to worry about.
 */
function KidGuide({ seconds }: { readonly seconds: number }): ReactNode {
  const rows: readonly (readonly [string, string, string])[] = [
    [
      "#8fd9b6",
      "You can try as many times as you like",
      "Really. There is no last chance.",
    ],
    [
      "#f2c93f",
      "It is shorter than a song",
      `${seconds} seconds, then it is done.`,
    ],
    [
      "#f28a66",
      "It is the trail you already know",
      "Same run, same letters. Nothing new to learn.",
    ],
    ["#b28ef0", "Skelty comes with you", "Right beside you the whole way."],
    [
      "#64b0e2",
      "If you stop, nothing is lost",
      "Your letters and days stay exactly as they are.",
    ],
  ];
  return (
    <>
      {rows.map(([colour, title, sub]) => (
        <div key={title} className={styles.kidRow}>
          <span className={styles.kidIcon} style={{ background: colour }} />
          <div>
            <div className={styles.kidTitle}>{title}</div>
            <div className={styles.kidSub}>{sub}</div>
          </div>
        </div>
      ))}
    </>
  );
}
