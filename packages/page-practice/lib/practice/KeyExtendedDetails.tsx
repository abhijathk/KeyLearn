import { LearningRate, type LessonKey, Target } from "@keylearn/lesson";
import { useFormatter, useKeyStyles } from "@keylearn/lesson-ui";
import { type KeyStats } from "@keylearn/result";
import { useSettings } from "@keylearn/settings";
import { type CSSProperties, type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./KeyExtendedDetails.module.less";
import { useKidsPractice } from "./kids-flavour.ts";

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
  const kids = useKidsPractice();
  const { settings } = useSettings();
  const { formatSpeed, speedUnit } = useFormatter();
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
  if (kids) {
    const speedOf = (time: number | null) =>
      time != null ? formatSpeed(60000 / time, { unit: false }) : "—";
    return (
      <div className={styles.kidsRoot}>
        <div className={styles.kidsHead}>
          <span className={styles.kidsKeycap}>{label}</span>
          <span className={styles.kidsHeadText}>
            <span className={styles.kidsKicker}>
              <FormattedMessage
                id="kids.keyDetails.kicker"
                defaultMessage="Key stats"
              />
            </span>
            <span className={styles.kidsTitle}>
              <FormattedMessage
                id="kids.keyDetails.title"
                defaultMessage="Your {label} stats"
                values={{ label }}
              />
            </span>
          </span>
        </div>
        <div className={styles.kidsBody}>
          <div className={styles.kidsCards}>
            <KidsStat
              tone={styles.kidsToneRecent}
              glyph={<path d="M13 2L4 14h7l-1 8 9-12h-7z" />}
              label={
                <FormattedMessage
                  id="keyDetails.last"
                  defaultMessage="Recent"
                />
              }
              value={speedOf(timeToType)}
              unit={timeToType != null ? speedUnit.id : null}
              fill={confidence}
              note={<OfTarget pct={confidence} />}
            />
            <KidsStat
              tone={styles.kidsToneBest}
              glyph={
                <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
              }
              label={
                <FormattedMessage id="keyDetails.top" defaultMessage="Best" />
              }
              value={speedOf(bestTimeToType)}
              unit={bestTimeToType != null ? speedUnit.id : null}
              fill={bestConfidence}
              note={<OfTarget pct={bestConfidence} />}
            />
            <KidsStat
              tone={styles.kidsToneTrend}
              glyph={<TrendGlyph />}
              label={
                <FormattedMessage id="keyDetails.rate" defaultMessage="Trend" />
              }
              value={
                rate != null
                  ? `${rate >= 0 ? "+" : "−"}${formatSpeed(Math.abs(rate), { unit: false })}`
                  : "—"
              }
              unit={rate != null ? speedUnit.id : null}
              // A lesson that adds a tenth of the target speed is as steep
              // as a learning curve gets; the bar fills against that.
              fill={
                rate != null && rate > 0 ? rate / (target.targetSpeed * 0.1) : 0
              }
              note={
                rate != null ? (
                  <FormattedMessage
                    id="kids.keyDetails.perLesson"
                    defaultMessage="per lesson"
                  />
                ) : (
                  <FormattedMessage
                    id="kids.keyDetails.noTrend"
                    defaultMessage="not enough data yet"
                  />
                )
              }
            />
          </div>
          <div className={styles.kidsRow}>
            <svg
              className={styles.kidsRowGlyph}
              viewBox="0 0 24 24"
              aria-hidden={true}
            >
              <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
            </svg>
            <span>
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
            </span>
          </div>
          {speeds.length > 1 ? (
            <div className={styles.kidsCurveBox}>
              <Curve speeds={speeds} target={target.targetSpeed} />
            </div>
          ) : (
            <div className={styles.kidsRow}>
              <svg
                className={styles.kidsRowGlyph}
                viewBox="0 0 24 24"
                aria-hidden={true}
              >
                <TrendGlyph />
              </svg>
              <span>
                <FormattedMessage
                  id="keyDetails.noChart"
                  defaultMessage="Finish a few more lessons to reveal your learning curve."
                />
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
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

function KidsStat({
  tone,
  glyph,
  label,
  value,
  unit,
  fill,
  note,
}: {
  readonly tone: string;
  readonly glyph: ReactNode;
  readonly label: ReactNode;
  readonly value: ReactNode;
  readonly unit: string | null;
  readonly fill: number | null;
  readonly note: ReactNode;
}): ReactNode {
  const width = `${Math.round(Math.max(0, Math.min(1, fill ?? 0)) * 100)}%`;
  return (
    <div className={`${styles.kidsStat} ${tone}`}>
      <div className={styles.kidsStatLabel}>
        <svg viewBox="0 0 24 24" aria-hidden={true}>
          {glyph}
        </svg>
        <span>{label}</span>
      </div>
      <span className={styles.kidsStatValue}>
        {value}
        {unit != null && <span className={styles.kidsStatUnit}>{unit}</span>}
      </span>
      <div className={styles.kidsBar}>
        <div className={styles.kidsBarFill} style={{ inlineSize: width }} />
      </div>
      <span className={styles.kidsStatNote}>{note}</span>
    </div>
  );
}

function OfTarget({ pct }: { readonly pct: number | null }): ReactNode {
  return pct != null ? (
    <FormattedMessage
      id="kids.keyDetails.ofTarget"
      defaultMessage="{pct}% of target"
      values={{ pct: Math.round(Math.min(1, pct) * 100) }}
    />
  ) : (
    <FormattedMessage id="t_Uncertain" defaultMessage="Not sure yet" />
  );
}

function TrendGlyph(): ReactNode {
  return (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
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
  // Matches the card's new height so the curve is drawn at its own
  // proportions rather than stretched into the box.
  const width = 260;
  const height = 68;
  const pad = 5;
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
