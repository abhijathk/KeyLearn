import { useFormatter } from "@keybr/lesson-ui";
import { type Result } from "@keybr/result";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./UnlockCeremony.module.less";

/**
 * The unlock ceremony: shown when the engine introduces a new key. The
 * emotional peak of the practice loop — a glowing key tile, the lesson's
 * numbers, and a nudge to keep going while the momentum is there.
 */
export function UnlockCeremony({
  label,
  result,
  prev,
  onContinue,
  onClose,
}: {
  readonly label: string;
  readonly result: Result;
  readonly prev: Result | null;
  readonly onContinue: () => void;
  readonly onClose: () => void;
}): ReactNode {
  const { formatSpeed } = useFormatter();
  const accuracy = (v: Result) => v.accuracy * 100;
  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>
          <FormattedMessage
            id="ceremony.lessonComplete"
            defaultMessage="Lesson done"
          />
        </div>
        <div className={styles.keyTile}>{label}</div>
        <div className={styles.title}>
          <FormattedMessage
            id="ceremony.title"
            defaultMessage="You’ve unlocked a new key!"
          />
        </div>
        <div className={styles.subtitle}>
          <FormattedMessage
            id="ceremony.subtitle"
            defaultMessage="{label} is now part of your set — everything you had reached the target speed"
            values={{ label: <b>{label}</b> }}
          />
        </div>
        <div className={styles.stats}>
          <Stat
            label={<FormattedMessage id="t_Speed" defaultMessage="Speed" />}
            value={formatSpeed(result.speed)}
            delta={prev != null ? result.speed - prev.speed : null}
            format={(v) => formatSpeed(Math.abs(v))}
          />
          <Stat
            label={
              <FormattedMessage id="t_Accuracy" defaultMessage="Accuracy" />
            }
            value={`${accuracy(result).toFixed(1)}%`}
            delta={prev != null ? accuracy(result) - accuracy(prev) : null}
            format={(v) => `${Math.abs(v).toFixed(1)}%`}
          />
          <Stat
            label={<FormattedMessage id="t_Score" defaultMessage="Score" />}
            value={String(Math.round(result.score))}
            delta={prev != null ? result.score - prev.score : null}
            format={(v) => String(Math.round(Math.abs(v)))}
          />
        </div>
        <button className={styles.cta} onClick={onContinue}>
          <FormattedMessage
            id="ceremony.keepGoing"
            defaultMessage="Onward — {label} is up next"
            values={{ label: <b>{label}</b> }}
          />
          <svg className={styles.arrow} viewBox="0 0 24 24">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        <button className={styles.ghost} onClick={onClose}>
          <FormattedMessage
            id="ceremony.takeBreak"
            defaultMessage="Pause for now"
          />
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  delta,
  format,
}: {
  readonly label: ReactNode;
  readonly value: string;
  readonly delta: number | null;
  readonly format: (v: number) => string;
}): ReactNode {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statRow}>
        <span className={styles.statValue}>{value}</span>
        {delta != null && delta !== 0 && (
          <span className={delta > 0 ? styles.deltaUp : styles.deltaDown}>
            {delta > 0 ? "▲ " : "▼ "}
            {format(delta)}
          </span>
        )}
      </div>
    </div>
  );
}
