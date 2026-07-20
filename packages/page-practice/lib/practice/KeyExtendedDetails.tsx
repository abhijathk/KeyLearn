import { LearningRate, type LessonKey, Target } from "@keybr/lesson";
import { useFormatter, useKeyStyles } from "@keybr/lesson-ui";
import { type KeyStats } from "@keybr/result";
import { useSettings } from "@keybr/settings";
import { type CSSProperties, type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./KeyExtendedDetails.module.less";

/**
 * The KeyLearn key-details hover card: a confidence-coloured key tile with a
 * readiness ring, metric tiles for last/top/rate, and the learning curve drawn
 * in the same visual language as the dashboard trend tile.
 */
export function KeyExtendedDetails({
  lessonKey,
  keyStats,
}: {
  readonly lessonKey: LessonKey;
  readonly keyStats: KeyStats;
}): ReactNode {
  const { settings } = useSettings();
  const { formatSpeed } = useFormatter();
  const { confidenceColor } = useKeyStyles();
  const target = new Target(settings);
  const learningRate = LearningRate.from(keyStats.samples, target);
  const {
    letter: { label },
    confidence,
    bestConfidence,
    timeToType,
    bestTimeToType,
  } = lessonKey;
  const conf = Math.max(0, Math.min(1, confidence ?? 0));
  const speeds = keyStats.samples.map(
    ({ filteredTimeToType }) => 60000 / filteredTimeToType,
  );
  const forecast =
    learningRate != null && Number.isFinite(learningRate.remainingLessons)
      ? learningRate.remainingLessons
      : null;
  const rate =
    learningRate != null && Number.isFinite(learningRate.learningRate)
      ? learningRate.learningRate
      : null;
  const tileStyle: CSSProperties | undefined =
    confidence != null
      ? { backgroundColor: String(confidenceColor(conf)) }
      : undefined;
  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <span className={styles.keyTile} style={tileStyle}>
          {label}
        </span>
        <div className={styles.headText}>
          <div className={styles.title}>
            <FormattedMessage
              id="keyDetails.title"
              defaultMessage="Details for {label}"
              values={{ label }}
            />
          </div>
          <div className={styles.subtitle}>
            {forecast != null ? (
              <FormattedMessage
                id="keyDetails.remainingLessons"
                defaultMessage="≈ {count} lessons until target speed"
                values={{ count: forecast }}
              />
            ) : (
              <FormattedMessage
                id="keyDetails.needData"
                defaultMessage="Keep practicing — we need more data before we can forecast this."
              />
            )}
          </div>
        </div>
        <span
          className={styles.ring}
          style={{ "--p": `${Math.round(conf * 100)}%` } as CSSProperties}
        >
          <span className={styles.ringLabel}>{Math.round(conf * 100)}%</span>
        </span>
      </div>
      <div className={styles.stats}>
        <Stat
          label={
            <FormattedMessage id="keyDetails.last" defaultMessage="Recent" />
          }
          value={timeToType != null ? formatSpeed(60000 / timeToType) : "—"}
          pct={confidence}
        />
        <Stat
          label={<FormattedMessage id="keyDetails.top" defaultMessage="Best" />}
          value={
            bestTimeToType != null ? formatSpeed(60000 / bestTimeToType) : "—"
          }
          pct={bestConfidence}
        />
        <Stat
          label={
            <FormattedMessage id="keyDetails.rate" defaultMessage="Trend" />
          }
          value={
            rate != null
              ? `${rate >= 0 ? "▲ +" : "▼ "}${formatSpeed(Math.abs(rate))}`
              : "—"
          }
          pct={null}
        />
      </div>
      {speeds.length > 1 ? (
        <Curve speeds={speeds} target={target.targetSpeed} />
      ) : (
        <div className={styles.empty}>
          <FormattedMessage
            id="keyDetails.noChart"
            defaultMessage="Finish a few more lessons to reveal your learning curve."
          />
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  pct,
}: {
  readonly label: ReactNode;
  readonly value: ReactNode;
  readonly pct: number | null;
}): ReactNode {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statPct}>
        {pct != null ? `${Math.round(Math.min(1, pct) * 100)}%` : " "}
      </div>
    </div>
  );
}

function Curve({
  speeds,
  target,
}: {
  readonly speeds: readonly number[];
  readonly target: number;
}): ReactNode {
  const width = 340;
  const height = 110;
  const pad = 6;
  const lo = Math.min(...speeds, target) * 0.92;
  const hi = Math.max(...speeds, target) * 1.08;
  const span = hi - lo || 1;
  const px = (i: number) =>
    pad + (i * (width - pad * 2)) / Math.max(1, speeds.length - 1);
  const py = (v: number) =>
    height - pad - ((v - lo) * (height - pad * 2)) / span;
  const points = speeds.map((v, i) => `${px(i)},${py(v)}`).join(" ");
  const area = `${pad},${height - pad} ${points} ${px(speeds.length - 1)},${height - pad}`;
  const last = speeds.length - 1;
  return (
    <svg
      className={styles.curve}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden={true}
    >
      <line
        className={styles.curveTarget}
        x1={pad}
        y1={py(target)}
        x2={width - pad}
        y2={py(target)}
      />
      <polygon className={styles.curveArea} points={area} />
      <polyline className={styles.curveLine} points={points} />
      <circle
        className={styles.curveDot}
        cx={px(last)}
        cy={py(speeds[last])}
        r={3}
      />
    </svg>
  );
}
