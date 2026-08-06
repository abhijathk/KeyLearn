import {
  type CertificateEvidence,
  certificateTemplate,
  planFor,
  RETENTION,
} from "@keylearn/certificate";
import { clsx } from "clsx";
import { type ReactNode, useState } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./CoursePane.module.less";
import { GuideDialog } from "./GuideDialog.tsx";
import { Medal, type MedalKind } from "./Medal.tsx";

/**
 * The window a learner sees once the practice has proved everything it can.
 *
 * Three documents rather than one with three skins. A grown-up is deciding
 * whether to spend nine minutes and wants to know what is measured; a braille
 * learner needs the shape of it before the detail, because audio cannot be
 * skimmed; a seven-year-old mostly needs to know it will not hurt.
 */
export function ReadyDialog({
  name,
  evidence,
  medal,
  onClose,
  onStart,
}: {
  readonly name: string;
  readonly evidence: CertificateEvidence;
  readonly medal: MedalKind;
  readonly onClose: () => void;
  readonly onStart: () => void;
}): ReactNode {
  const [guide, setGuide] = useState(false);
  const sheet = certificateTemplate(evidence.age, evidence.audience);
  const plan = planFor(evidence.audience, evidence.age);
  const braille = evidence.kind === "braille";
  const unit = braille ? "cells/min" : "wpm";
  const child = sheet === "child";

  if (guide) {
    return <GuideDialog evidence={evidence} onClose={() => setGuide(false)} />;
  }

  const figures: readonly (readonly [string, string])[] = [
    [`${Math.round(evidence.speed * 10) / 10}`, unit],
    [`${(evidence.accuracy * 100).toFixed(1)}%`, "accuracy"],
    [`${evidence.learned}/${evidence.total}`, braille ? "cells" : "letters"],
    [`${evidence.daysPractised}`, "days"],
  ];

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
                id="ready.title.kid"
                defaultMessage="You’re ready!"
              />
            ) : (
              <FormattedMessage
                id="ready.title"
                defaultMessage="Ready to sit"
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
          <div className={clsx(styles.readyHero, child && styles.readyHeroKid)}>
            <Medal kind={medal} size="hero" />
            <div>
              <h3 className={styles.readyName}>
                {child ? (
                  <FormattedMessage
                    id="ready.hero.kid"
                    defaultMessage="{name}, you learned every letter!"
                    values={{ name }}
                  />
                ) : (
                  <FormattedMessage
                    id="ready.hero"
                    defaultMessage="{name}, the practice is done."
                    values={{ name }}
                  />
                )}
              </h3>
              <p className={styles.readySub}>
                {child ? (
                  <FormattedMessage
                    id="ready.sub.kid"
                    defaultMessage="Now there’s one big go to finish the trail."
                  />
                ) : (
                  <FormattedMessage
                    id="ready.sub"
                    defaultMessage="Everything the practice has to prove is proved. What is left is the assessment."
                  />
                )}
              </p>
            </div>
          </div>

          {!child && (
            <>
              <div className={styles.label}>
                <FormattedMessage
                  id="ready.where"
                  defaultMessage="Where this learner is"
                />
              </div>
              <div className={styles.readyFigs}>
                {figures.map(([value, label]) => (
                  <span key={label} className={styles.readyFig}>
                    <b>{value}</b>
                    <i>{label}</i>
                  </span>
                ))}
              </div>
            </>
          )}

          <div className={styles.label}>
            {child ? (
              <FormattedMessage
                id="ready.plan.kid"
                defaultMessage="The big go"
              />
            ) : (
              <FormattedMessage
                id="ready.plan"
                defaultMessage="What the assessment is"
              />
            )}
          </div>
          <div className={styles.readyPlan}>
            {child ? (
              <FormattedMessage
                id="ready.plan.kid.body"
                defaultMessage="One run, {seconds} seconds, on the trail you know. Skelty comes too. You can try again whenever you like — as many times as you want."
                values={{ seconds: plan.seconds }}
              />
            ) : (
              <ul>
                <li>
                  <FormattedMessage
                    id="ready.plan.runs"
                    defaultMessage="{runs} runs of {seconds} seconds, on {what} you have not seen."
                    values={{
                      runs: plan.runs,
                      seconds: plan.seconds,
                      what: braille ? "dictation" : "text",
                    }}
                  />
                </li>
                <li>
                  <b>
                    {braille ? (
                      <FormattedMessage
                        id="ready.plan.hintsBrl"
                        defaultMessage="Hints and spell-out are off"
                      />
                    ) : (
                      <FormattedMessage
                        id="ready.plan.hints"
                        defaultMessage="The keyboard picture and the hand guide are off"
                      />
                    )}
                  </b>{" "}
                  <FormattedMessage
                    id="ready.plan.hints2"
                    defaultMessage="and cannot be turned back on."
                  />
                </li>
                <li>
                  <FormattedMessage
                    id="ready.plan.median"
                    defaultMessage="Sit it as often as you like. The result is the middle of your last three sittings, and you need to hold {pc}% of the pace you practise at."
                    values={{
                      pc: Math.round(
                        (evidence.audience === "kid"
                          ? RETENTION.kid
                          : RETENTION.adult) * 100,
                      ),
                    }}
                  />
                </li>
              </ul>
            )}
          </div>
        </div>

        <div className={styles.dialogFoot}>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => setGuide(true)}
          >
            {child ? (
              <FormattedMessage
                id="ready.guide.kid"
                defaultMessage="What happens?"
              />
            ) : (
              <FormattedMessage
                id="ready.guide"
                defaultMessage="About the assessment"
              />
            )}
          </button>
          <span className={styles.dialogSpacer} />
          <button type="button" className={styles.btn} onClick={onClose}>
            {child ? (
              <FormattedMessage id="ready.later.kid" defaultMessage="Later" />
            ) : (
              <FormattedMessage id="ready.later" defaultMessage="Not now" />
            )}
          </button>
          <button
            type="button"
            className={clsx(styles.btn, styles.btnGo)}
            onClick={onStart}
          >
            {child ? (
              <FormattedMessage
                id="ready.start.kid"
                defaultMessage="Let’s go!"
              />
            ) : (
              <FormattedMessage
                id="ready.start"
                defaultMessage="Start the first run"
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
