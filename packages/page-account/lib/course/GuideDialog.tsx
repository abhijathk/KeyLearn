import {
  ADULT_BRAILLE,
  ADULT_TYPING,
  type CertificateEvidence,
  certificateTemplate,
  planFor,
  RETENTION,
} from "@keylearn/certificate";
import { hush, say } from "@keylearn/speech";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FormattedMessage } from "react-intl";
import * as styles from "./CoursePane.module.less";
import { GuideIcon, type GuideIconName } from "./GuideIcons.tsx";

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
  // Read-aloud speaks this element rather than a second copy of the words.
  // A hand-written script beside the prose is one more thing to drift, and it
  // would drift silently — nobody proof-listens a help page.
  const bodyRef = useRef<HTMLDivElement>(null);

  // Portalled to the body. The account window sits inside a shell that
  // establishes its own containing block, and a position:fixed child of that
  // is clipped to the shell rather than to the viewport — which is why this
  // window was being cut off at the account window's edge however tall it was
  // allowed to be.
  return createPortal(
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
                id="assess.guide.title.kid"
                defaultMessage="About the big go"
              />
            ) : (
              <FormattedMessage
                id="assess.guide.title"
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

        <div className={styles.dialogBody} ref={bodyRef}>
          {child ? (
            <KidGuide seconds={plan.seconds} />
          ) : (
            <>
              {braille && (
                <>
                  {/* The listening controls come first, and then the shape of
                      the page, because a listener cannot skim ahead to find
                      out how long this is going to be. */}
                  <ListenBar bodyRef={bodyRef} />
                  <div className={styles.shape}>
                    <FormattedMessage
                      id="assess.guide.shape"
                      defaultMessage="Four things, in this order: what happens, what is judged, how people fall short, and two questions."
                    />
                  </div>
                </>
              )}

              <div className={styles.label}>
                <FormattedMessage
                  id="assess.guide.what"
                  defaultMessage="What happens"
                />
              </div>
              <p className={styles.guideP}>
                {braille ? (
                  <FormattedMessage
                    id="assess.guide.what.brl"
                    defaultMessage="{runs} runs of {seconds} seconds, dictated text you have not heard before, using every cell you have learned. Hints and spell-out are off and cannot be turned back on."
                    values={{ runs: plan.runs, seconds: plan.seconds }}
                  />
                ) : (
                  <FormattedMessage
                    id="assess.guide.what.body"
                    defaultMessage="{runs} runs of {seconds} seconds, on text you have not seen. The on-screen keyboard and the hand guide are off and cannot be turned back on. Sit it as often as you like."
                    values={{ runs: plan.runs, seconds: plan.seconds }}
                  />
                )}
              </p>

              <div className={styles.label}>
                <FormattedMessage
                  id="assess.guide.judged"
                  defaultMessage="What is judged"
                />
              </div>
              <p className={styles.guideP}>
                {braille ? (
                  // Shorter than the grown-up sentence on purpose. The clause
                  // about lucky and unlucky runs is worth reading and tiring to
                  // listen to; the numbers are the part that has to land.
                  <FormattedMessage
                    id="assess.guide.judged.brl"
                    defaultMessage="The middle of your last three sittings. You need {speed} cells a minute, {acc}% accuracy, and {ret}% of the pace you practise at."
                    values={{
                      speed: bar.speed,
                      acc: Math.round(bar.accuracy * 100),
                      ret: retention,
                    }}
                  />
                ) : (
                  <FormattedMessage
                    id="assess.guide.judged.body"
                    defaultMessage="The middle of your last three sittings — never your best, so one lucky run cannot carry you and one bad one cannot sink you. You need {speed} wpm, {acc}% accuracy, and to hold {ret}% of the pace you practise at."
                    values={{
                      speed: bar.speed,
                      acc: Math.round(bar.accuracy * 100),
                      ret: retention,
                    }}
                  />
                )}
              </p>

              <div className={styles.label}>
                <FormattedMessage
                  id="assess.guide.fail"
                  defaultMessage="How people fall short"
                />
              </div>
              <div className={styles.guideFlag}>
                <i />
                <span>
                  {braille ? (
                    <FormattedMessage
                      id="assess.guide.fail.brl"
                      defaultMessage="The cell is still being assembled from the prompt. With hints off there is nothing to assemble from, and the pace drops. Practising with them faded is what closes it."
                    />
                  ) : (
                    <FormattedMessage
                      id="assess.guide.fail.keys"
                      defaultMessage="Speed collapses without the keyboard picture. This is much the commonest, and it is the whole reason the picture goes away. If you drop a third, you have been reading the keys. Practise with the hint off and it closes."
                    />
                  )}
                </span>
              </div>
              {/* The grown-up sheet carries both; a listener gets the one that
                  is actually theirs. Two ways to fall short is a list; one is
                  a warning. */}
              {!braille && (
                <div className={styles.guideFlag}>
                  <i />
                  <span>
                    <FormattedMessage
                      id="assess.guide.fail.acc"
                      defaultMessage="Accuracy falls under the clock. Slowing down is the fix — accuracy is worth more than speed here, and the median forgives one nervous run."
                    />
                  </span>
                </div>
              )}

              <div className={styles.label}>
                <FormattedMessage
                  id="assess.guide.questions"
                  defaultMessage="Questions"
                />
              </div>
              {braille ? (
                <>
                  <Question
                    q="What if I stop halfway?"
                    a="The run is discarded. Not a failure, not a free retry."
                  />
                  <Question
                    q="Is the text read at my usual rate?"
                    a="Yes — whatever you have set stays set."
                  />
                </>
              ) : (
                <>
                  <Question
                    q="What if I stop halfway?"
                    a="The run is discarded. It is not a failure and not a free retry — the next three sittings still have to agree."
                  />
                  <Question
                    q="Can I lose a certificate I already have?"
                    a="No. Sitting again can only add a higher one."
                  />
                  <Question
                    q="Why is my own practice pace part of it?"
                    a="Because no single number tells touch typing from fast hunting. Somebody typing by touch barely slows when the picture goes."
                  />
                </>
              )}
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
              <FormattedMessage
                id="assess.guide.close.kid"
                defaultMessage="Got it!"
              />
            ) : (
              <FormattedMessage
                id="assess.guide.close"
                defaultMessage="Close"
              />
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
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
  const rows: readonly (readonly [GuideIconName, string, string, string])[] = [
    [
      "again",
      "#8fd9b6",
      "You can try as many times as you like",
      "Really. There is no last chance.",
    ],
    [
      "clock",
      "#f2c93f",
      "It is shorter than a song",
      `${seconds} seconds, then it is done.`,
    ],
    [
      "tent",
      "#f28a66",
      "It is the trail you already know",
      "Same run, same letters. Nothing new to learn.",
    ],
    [
      "friend",
      "#b28ef0",
      "Skelty comes with you",
      "Right beside you the whole way.",
    ],
    [
      "bookmark",
      "#64b0e2",
      "If you stop, nothing is lost",
      "Your letters and days stay exactly as they are.",
    ],
  ];
  return (
    <>
      {rows.map(([icon, colour, title, sub]) => (
        <div key={title} className={styles.kidRow}>
          <GuideIcon name={icon} colour={colour} />
          <div>
            <div className={styles.kidTitle}>{title}</div>
            <div className={styles.kidSub}>{sub}</div>
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Read this page aloud, and change how fast.
 *
 * It speaks the rendered window rather than a script written beside it: a
 * second copy of the prose drifts the first time a sentence is edited, and it
 * drifts silently, because nobody proof-listens a help page.
 *
 * The rate is this window's own and is not written to the learner's braille
 * preferences — reading a help page faster is not a decision about how the
 * drill should sound tomorrow.
 */
function ListenBar({
  bodyRef,
}: {
  readonly bodyRef: React.RefObject<HTMLDivElement | null>;
}): ReactNode {
  const [rate, setRate] = useState(1);
  const [reading, setReading] = useState(false);

  // Silence on the way out. A window that keeps talking after it is closed is
  // the worst thing this control could do to somebody who cannot see that it
  // has gone.
  useEffect(
    () => () => {
      hush();
    },
    [],
  );

  const read = (at: number) => {
    hush();
    const text = bodyRef.current?.innerText?.trim() ?? "";
    if (text === "") {
      return;
    }
    setReading(true);
    say(text, { rate: at, enabled: true }, () => {
      setReading(false);
    });
  };

  const nudge = (by: number) => {
    // Between half speed and double: past either end the engine mangles the
    // words rather than pacing them.
    const next = Math.min(2, Math.max(0.5, Math.round((rate + by) * 10) / 10));
    setRate(next);
    if (reading) {
      read(next);
    }
  };

  return (
    <div className={styles.listen}>
      <button
        type="button"
        className={clsx(styles.btn, styles.btnGo)}
        onClick={() => {
          if (reading) {
            hush();
            setReading(false);
          } else {
            read(rate);
          }
        }}
      >
        {reading ? (
          <FormattedMessage
            id="assess.guide.stopReading"
            defaultMessage="■ Stop reading"
          />
        ) : (
          <FormattedMessage
            id="assess.guide.readAloud"
            defaultMessage="▶ Read this page"
          />
        )}
      </button>
      <button
        type="button"
        className={styles.btn}
        disabled={rate <= 0.5}
        onClick={() => nudge(-0.1)}
      >
        <FormattedMessage id="assess.guide.slower" defaultMessage="Slower" />
      </button>
      <button
        type="button"
        className={styles.btn}
        disabled={rate >= 2}
        onClick={() => nudge(0.1)}
      >
        <FormattedMessage id="assess.guide.faster" defaultMessage="Faster" />
      </button>
      <span className={styles.listenRate} aria-live="polite">
        {rate.toFixed(1)}×
      </span>
    </div>
  );
}
