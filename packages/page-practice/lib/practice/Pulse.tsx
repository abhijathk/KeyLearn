import { useIntlNumbers } from "@keybr/intl";
import { lessonProps } from "@keybr/lesson";
import { type Names, useFormatter, useKeyStyles } from "@keybr/lesson-ui";
import { type SummaryStats } from "@keybr/result";
import { useSettings } from "@keybr/settings";
import { clsx } from "clsx";
import { memo, type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./Pulse.module.less";

/**
 * The Pulse: the whole metrics section drawn as one slim thread. The line
 * begins as the recent-lessons trend curve, flows into the speed numeral,
 * continues as a dotted road (the Letter Journey's grammar for "still to
 * come") to a flag at the target speed — a glowing dot marks how far along
 * you are — and accuracy and score ride along as quiet stations. One row,
 * so the practice text and keyboard keep the stage.
 */
export const Pulse = memo(function Pulse({
  summaryStats,
  speeds,
  names,
}: {
  readonly summaryStats: SummaryStats;
  readonly speeds: readonly number[];
  readonly names?: Names;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { formatNumber, formatPercents } = useIntlNumbers();
  const { formatSpeed, speedUnit } = useFormatter();
  const { confidenceColor } = useKeyStyles();
  const { settings } = useSettings();
  const target = settings.get(lessonProps.targetSpeed);
  const { count, speed, accuracy, score } = summaryStats;
  const hasData = count > 0;
  const frac =
    hasData && target > 0 ? Math.min(1, Math.max(0, speed.last / target)) : 0;
  const reached = hasData && speed.last >= target;
  // A metric dot's tint: the algorithm red-to-green scale centred on your
  // average — half a `scale` above reads fully green, half below fully red.
  const tintOf = (delta: number, scale: number) =>
    hasData
      ? String(
          confidenceColor(Math.min(1, Math.max(0, 0.5 + delta / (scale || 1)))),
        )
      : undefined;
  return (
    <div className={styles.root}>
      {speeds.length > 1 && (
        <div
          className={styles.sparkWrap}
          title={formatMessage(
            {
              id: "practice.trend.label",
              defaultMessage: "Past {count} lessons",
            },
            { count: speeds.length },
          )}
        >
          <Spark speeds={speeds} />
        </div>
      )}
      <div
        id={names?.speed}
        className={styles.speed}
        title={formatMessage({
          id: "metric.speed.description",
          defaultMessage: "Your typing speed in the most recent lesson.",
        })}
      >
        <span className={styles.speedValue}>
          {hasData ? formatSpeed(speed.last, { unit: false }) : "—"}
          <i className={styles.speedUnit}>{speedUnit.id}</i>
        </span>
        {hasData && <Chip delta={speed.delta} text={formatSpeed} />}
      </div>
      <div className={styles.road}>
        <span
          className={styles.roadDone}
          style={{ flexBasis: `${frac * 100}%` }}
        />
        <span
          className={clsx(styles.you, reached && styles.youReached)}
          title={formatMessage({
            id: "practice.pulse.you.description",
            defaultMessage:
              "You are here — your latest speed on the way to the goal.",
          })}
        />
        <span className={styles.roadAhead} />
        <span className={styles.goal}>
          <svg className={styles.flag} viewBox="0 0 14 16" aria-hidden={true}>
            <path d="M3 15V2m0 0h8l-2.5 3L11 8H3" />
          </svg>
          {formatSpeed(target)}
        </span>
        <span className={styles.caption}>
          {hasData &&
            (reached ? (
              <FormattedMessage
                id="practice.pulse.goalReached"
                defaultMessage="Goal reached — raise it in settings"
              />
            ) : (
              <FormattedMessage
                id="practice.pulse.progress"
                defaultMessage="{percent}% of the way"
                values={{ percent: Math.round(frac * 100) }}
              />
            ))}
        </span>
      </div>
      <Station
        id={names?.accuracy}
        label={<FormattedMessage id="t_Accuracy" defaultMessage="Accuracy" />}
        value={hasData ? formatPercents(accuracy.last) : "—"}
        chip={
          hasData ? (
            <Chip delta={accuracy.delta} text={(v) => formatPercents(v)} />
          ) : null
        }
        tint={tintOf(accuracy.delta, 0.04)}
        title={formatMessage({
          id: "metric.accuracy.description",
          defaultMessage:
            "The share of characters you typed correctly in the last lesson.",
        })}
      />
      <Station
        id={names?.score}
        label={<FormattedMessage id="t_Score" defaultMessage="Score" />}
        value={hasData ? formatNumber(score.last, 0) : "—"}
        chip={
          hasData ? (
            <Chip delta={score.delta} text={(v) => formatNumber(v, 0)} />
          ) : null
        }
        tint={tintOf(score.delta, Math.max(1, score.avg * 0.4))}
        title={formatMessage({
          id: "metric.score.description",
          defaultMessage:
            "Your last lesson's score, in points. " +
            "You earn more by typing faster and cleaner.",
        })}
      />
    </div>
  );
});

function Chip({
  delta,
  text,
}: {
  readonly delta: number;
  readonly text: (value: number) => string;
}): ReactNode {
  const { formatMessage } = useIntl();
  const title = formatMessage({
    id: "metric.difference.description",
    defaultMessage: "How this compares to your average.",
  });
  const cls = clsx(
    styles.chip,
    delta > 0 ? styles.chipUp : delta < 0 ? styles.chipDown : styles.chipFlat,
  );
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return (
    <span className={cls} title={title}>
      {sign}
      {text(Math.abs(delta))}
    </span>
  );
}

function Station({
  id,
  label,
  value,
  chip,
  tint,
  title,
}: {
  readonly id?: string;
  readonly label: ReactNode;
  readonly value: string;
  readonly chip: ReactNode;
  readonly tint?: string;
  readonly title: string;
}): ReactNode {
  return (
    <div id={id} className={styles.station} title={title}>
      <span className={styles.stationTop}>
        <span
          className={styles.stationDot}
          style={tint ? { backgroundColor: tint } : undefined}
        />
        <span className={styles.stationValue}>{value}</span>
        {chip}
      </span>
      <span className={styles.microLabel}>{label}</span>
    </div>
  );
}

function Spark({ speeds }: { readonly speeds: readonly number[] }): ReactNode {
  const width = 96;
  const height = 26;
  const pad = 3;
  const lo = Math.min(...speeds);
  const hi = Math.max(...speeds);
  const span = hi - lo || 1;
  const px = (i: number) =>
    pad + (i * (width - pad * 2)) / Math.max(1, speeds.length - 1);
  const py = (v: number) =>
    height - pad - ((v - lo) * (height - pad * 2)) / span;
  const points = speeds.map((v, i) => `${px(i)},${py(v)}`).join(" ");
  const last = speeds.length - 1;
  return (
    <svg
      className={styles.spark}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden={true}
    >
      <polyline className={styles.sparkLine} points={points} />
      <circle
        className={styles.sparkDot}
        cx={px(last)}
        cy={py(speeds[last])}
        r={2.5}
      />
    </svg>
  );
}
