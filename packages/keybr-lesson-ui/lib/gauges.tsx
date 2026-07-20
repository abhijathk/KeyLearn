import { useIntlNumbers } from "@keybr/intl";
import { type SummaryStats } from "@keybr/result";
import { type ClassName, Value } from "@keybr/widget";
import { clsx } from "clsx";
import { memo, type ReactNode } from "react";
import { useIntl } from "react-intl";
import { useFormatter } from "./format.ts";
import * as styles from "./gauges.module.less";
import { type Names } from "./names.ts";

export const GaugeList = memo(function GaugeRow({
  summaryStats,
  speedSpark,
  names,
}: {
  summaryStats: SummaryStats;
  speedSpark?: readonly number[];
  names?: Names;
}) {
  return (
    <div className={styles.gaugeList}>
      <SpeedGauge
        summaryStats={summaryStats}
        spark={speedSpark}
        names={names}
      />
      <AccuracyGauge summaryStats={summaryStats} names={names} />
      <ScoreGauge summaryStats={summaryStats} names={names} />
    </div>
  );
});

export const SpeedGauge = memo(function SpeedGauge({
  summaryStats,
  spark,
  names,
}: {
  summaryStats: SummaryStats;
  spark?: readonly number[];
  names?: Names;
}) {
  const { formatMessage } = useIntl();
  const { formatSpeed } = useFormatter();
  const { last, delta } = summaryStats.speed;
  return (
    <Gauge
      id={names?.speed}
      aside={spark && spark.length > 1 ? <Sparkline series={spark} /> : null}
      name={formatMessage({
        id: "t_Speed",
        defaultMessage: "Speed",
      })}
      value={<Value value={formatSpeed(last)} />}
      delta={
        <Value
          value={signed(formatSpeed(delta), delta)}
          delta={delta}
          title={formatMessage({
            id: "metric.difference.description",
            defaultMessage: "How this compares to your average.",
          })}
        />
      }
      title={formatMessage({
        id: "metric.speed.description",
        defaultMessage: "Your typing speed in the most recent lesson.",
      })}
    />
  );
});

export const AccuracyGauge = memo(function AccuracyGauge({
  summaryStats,
  names,
}: {
  summaryStats: SummaryStats;
  names?: Names;
}) {
  const { formatMessage } = useIntl();
  const { formatPercents } = useIntlNumbers();
  const { last, delta } = summaryStats.accuracy;
  return (
    <Gauge
      id={names?.accuracy}
      name={formatMessage({
        id: "t_Accuracy",
        defaultMessage: "Accuracy",
      })}
      value={<Value value={formatPercents(last)} />}
      delta={
        <Value
          value={signed(formatPercents(delta), delta)}
          delta={delta}
          title={formatMessage({
            id: "metric.difference.description",
            defaultMessage: "How this compares to your average.",
          })}
        />
      }
      title={formatMessage({
        id: "metric.accuracy.description",
        defaultMessage:
          "The share of characters you typed correctly in the last lesson.",
      })}
    />
  );
});

export const ScoreGauge = memo(function ScoreGauge({
  summaryStats,
  names,
}: {
  summaryStats: SummaryStats;
  names?: Names;
}) {
  const { formatMessage } = useIntl();
  const { formatNumber } = useIntlNumbers();
  const { last, delta } = summaryStats.score;
  return (
    <Gauge
      id={names?.score}
      name={formatMessage({
        id: "t_Score",
        defaultMessage: "Score",
      })}
      value={<Value value={formatNumber(last, 0)} />}
      delta={
        <Value
          value={signed(formatNumber(delta, 0), delta)}
          delta={delta}
          title={formatMessage({
            id: "metric.difference.description",
            defaultMessage: "How this compares to your average.",
          })}
        />
      }
      title={formatMessage({
        id: "metric.score.description",
        defaultMessage:
          "Your last lesson's score, in points. " +
          "You earn more by typing faster and cleaner.",
      })}
    />
  );
});

export const Gauge = memo(function Gauge({
  id,
  className,
  name,
  value,
  delta,
  title,
  aside = null,
}: {
  id?: string;
  className?: ClassName;
  name: ReactNode;
  value: ReactNode;
  delta: ReactNode;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div id={id} className={clsx(styles.gauge, className)} title={title}>
      <div className={styles.label}>{name}</div>
      <div className={styles.row}>
        {aside}
        <span className={styles.value}>{value}</span>
        <span className={styles.delta}>{delta}</span>
      </div>
    </div>
  );
});

export function Sparkline({
  series,
  width = 64,
  height = 20,
}: {
  readonly series: readonly number[];
  readonly width?: number;
  readonly height?: number;
}): ReactNode {
  const lo = Math.min(...series);
  const hi = Math.max(...series);
  const span = hi - lo || 1;
  const px = (i: number) =>
    (i * (width - 6)) / Math.max(1, series.length - 1) + 3;
  const py = (v: number) => height - 3 - ((v - lo) * (height - 6)) / span;
  const points = series.map((v, i) => `${px(i)},${py(v)}`).join(" ");
  const lastIndex = series.length - 1;
  return (
    <svg
      className={styles.spark}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden={true}
    >
      <polyline className={styles.sparkLine} points={points} />
      <circle
        className={styles.sparkDot}
        cx={px(lastIndex)}
        cy={py(series[lastIndex])}
        r={2}
      />
    </svg>
  );
}

function signed(value: any, delta: number): string {
  const s = String(value);
  if (delta > 0) {
    return `\u25b2 +${s}`;
  }
  if (delta < 0) {
    return `\u25bc ${s}`;
  }
  return s;
}
