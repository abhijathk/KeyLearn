import { useIntlNumbers } from "@keybr/intl";
import { useFormatter } from "@keybr/lesson-ui";
import { Pages } from "@keybr/pages-shared";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { useNavigate } from "react-router";
import * as styles from "./GoalCeremony.module.less";

/**
 * The daily-goal ceremony: shown the moment today's practice time crosses the
 * goal — an animated ring that fills itself, today's numbers, and the choice
 * to see the details or ride the momentum.
 */
export function GoalCeremony({
  goalMinutes,
  minutes,
  lessons,
  topSpeed,
  onContinue,
}: {
  readonly goalMinutes: number;
  readonly minutes: number;
  readonly lessons: number;
  readonly topSpeed: number;
  readonly onContinue: () => void;
}): ReactNode {
  const navigate = useNavigate();
  const { formatNumber } = useIntlNumbers();
  const { formatSpeed } = useFormatter();
  // The ring animates from empty to full on entry.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setProgress(100);
    });
    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>
          <FormattedMessage
            id="goalCeremony.eyebrow"
            defaultMessage="Today's goal"
          />
        </div>
        <div
          className={styles.ring}
          style={
            {
              "--p": progress,
              "transition": "background 1s ease-out",
            } as CSSProperties
          }
        >
          <span className={styles.ringHole}>
            <svg className={styles.ringCheck} viewBox="0 0 24 24">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
        </div>
        <div className={styles.title}>
          <FormattedMessage
            id="goalCeremony.title"
            defaultMessage="Daily goal complete!"
          />
        </div>
        <div className={styles.subtitle}>
          <FormattedMessage
            id="goalCeremony.subtitle"
            defaultMessage="You put in your {minutes} minutes of practice today — the streak lives on."
            values={{ minutes: <b>{formatNumber(goalMinutes)}</b> }}
          />
        </div>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statLabel}>
              <FormattedMessage
                id="goalCeremony.timeToday"
                defaultMessage="Practiced"
              />
            </div>
            <div className={styles.statValue}>
              {formatNumber(minutes)}
              min
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>
              <FormattedMessage
                id="goalCeremony.lessonsToday"
                defaultMessage="Lessons"
              />
            </div>
            <div className={styles.statValue}>{formatNumber(lessons)}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>
              <FormattedMessage
                id="goalCeremony.topSpeed"
                defaultMessage="Top speed"
              />
            </div>
            <div className={styles.statValue}>{formatSpeed(topSpeed)}</div>
          </div>
        </div>
        <button
          type="button"
          className={styles.cta}
          onClick={() => {
            navigate(Pages.profile.path);
          }}
        >
          <FormattedMessage
            id="goalCeremony.showDetails"
            defaultMessage="Show the details"
          />
          <svg className={styles.arrow} viewBox="0 0 24 24">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        <button type="button" className={styles.ghost} onClick={onContinue}>
          <FormattedMessage
            id="goalCeremony.continue"
            defaultMessage="Keep practicing"
          />
        </button>
      </div>
    </div>
  );
}
