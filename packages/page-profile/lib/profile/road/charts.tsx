import { useFormatter, useKeyStyles } from "@keybr/lesson-ui";
import { type Distribution } from "@keybr/math";
import { type KeyStatsMap, type Result, timeToSpeed } from "@keybr/result";
import { type ReactNode } from "react";
import * as styles from "./road.module.less";

/** A simple moving average; window derives from the smoothness slider. */
export function smoothed(values: readonly number[], smoothness: number) {
  const window = 1 + Math.round(smoothness * 14);
  if (window <= 1) {
    return [...values];
  }
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const from = Math.max(0, i - window + 1);
    let sum = 0;
    for (let j = from; j <= i; j++) {
      sum += values[j];
    }
    out.push(sum / (i - from + 1));
  }
  return out;
}

function pathOf(points: readonly (readonly [number, number])[]): string {
  return points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
}

const FONT = "font-family: inherit";

/**
 * The speed story: your speed as an accent area, accuracy and keys-in-play as
 * quiet companion lines, the target speed as the dotted road with a flag, a
 * peak annotation, and a live value badge on the glowing end dot.
 */
export function SpeedStoryChart({
  results,
  smoothness,
  target,
}: {
  readonly results: readonly Result[];
  readonly smoothness: number;
  readonly target: number;
}): ReactNode {
  const { formatSpeed } = useFormatter();
  const W = 1000;
  const H = 200;
  const X0 = 36;
  const speeds = smoothed(
    results.map(({ speed }) => speed),
    smoothness,
  );
  const accs = smoothed(
    results.map(({ accuracy }) => accuracy),
    smoothness,
  );
  const keys = results.map(({ histogram }) => histogram.complexity);
  const maxSpeed = Math.max(...speeds, target) * 1.08;
  const minSpeed = Math.min(...speeds) * 0.85;
  const px = (i: number) =>
    X0 + (i * (W - X0)) / Math.max(1, speeds.length - 1);
  const py = (v: number) =>
    20 + ((maxSpeed - v) * (H - 30)) / (maxSpeed - minSpeed || 1);
  const pts = speeds.map((v, i) => [px(i), py(v)] as const);
  const accPts = accs.map(
    (a, i) => [px(i), 24 + (1 - a) * 900] as const, // accuracy hugs the top
  );
  const maxKeys = Math.max(...keys, 1);
  const keyPts = keys.map(
    (k, i) => [px(i), H - 8 - (k / maxKeys) * 52] as const,
  );
  const [ex, ey] = pts[pts.length - 1];
  let peak = pts[0];
  let peakV = speeds[0];
  pts.forEach(([x, y], i) => {
    if (i < pts.length - 5 && y < peak[1]) {
      peak = [x, y];
      peakV = speeds[i];
    }
  });
  const gy = py(target);
  // grid lines at quarters
  const gridVals = [0.25, 0.5, 0.75].map(
    (f) => minSpeed + (maxSpeed - minSpeed) * f,
  );
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ blockSize: "13rem" }}
    >
      <defs>
        <linearGradient id="lr-speed-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridVals.map((v) => (
        <line
          key={v}
          x1={X0}
          y1={py(v)}
          x2={W}
          y2={py(v)}
          stroke="var(--primary-d2)"
          strokeWidth="1"
        />
      ))}
      {gridVals.map((v) => (
        <text
          key={`t${v}`}
          x={2}
          y={py(v) + 3}
          fill="var(--text-color-f2)"
          fontSize="10"
          style={{ fontFamily: "inherit" }}
        >
          {formatSpeed(v, { unit: false })}
        </text>
      ))}
      <line
        x1={X0}
        y1={gy}
        x2={W}
        y2={gy}
        stroke="var(--secondary-f2)"
        strokeWidth="1.5"
        strokeDasharray="2 7"
      />
      <text
        x={W - 180}
        y={gy - 7}
        fill="var(--text-color-f2)"
        fontSize="10"
        style={{ fontFamily: "inherit" }}
      >
        GOAL {formatSpeed(target)}
      </text>
      <path
        d={`M${W - 32} ${gy - 2} v-14 h9 l-3 3.5 3 3.5 h-9`}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.6"
      />
      <path
        d={`${pathOf(pts)} L ${W} ${H} L ${X0} ${H} Z`}
        fill="url(#lr-speed-g)"
      />
      <path
        d={pathOf(pts)}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d={pathOf(accPts)}
        fill="none"
        stroke="var(--fast-key-color)"
        strokeWidth="1.3"
        opacity="0.55"
      />
      <path
        d={pathOf(keyPts)}
        fill="none"
        stroke="var(--textinput--special__color, #b58ee0)"
        strokeWidth="1.3"
        opacity="0.55"
      />
      {peak[0] < ex - 60 && (
        <>
          <circle
            cx={peak[0]}
            cy={peak[1]}
            r="3.5"
            fill="none"
            stroke="var(--fast-key-color)"
            strokeWidth="1.6"
          />
          <text
            x={peak[0]}
            y={peak[1] - 9}
            fill="var(--fast-key-color)"
            fontSize="10"
            textAnchor="middle"
            style={{ fontFamily: "inherit" }}
          >
            peak {formatSpeed(peakV, { unit: false })}
          </text>
        </>
      )}
      <circle cx={ex} cy={ey} r="4" fill="var(--accent)" />
      <circle
        cx={ex}
        cy={ey}
        r="9"
        fill="none"
        stroke="var(--accent)"
        strokeOpacity="0.35"
        strokeWidth="3"
      />
      <rect
        x={ex - 82}
        y={ey + 8}
        width="64"
        height="18"
        rx="9"
        fill="var(--primary-l2)"
      />
      <text
        x={ex - 50}
        y={ey + 21}
        fill="var(--accent)"
        fontSize="10.5"
        fontWeight="700"
        textAnchor="middle"
        style={{ fontFamily: "inherit" }}
      >
        {formatSpeed(speeds[speeds.length - 1])}
      </text>
    </svg>
  );
}

/** One key's own line, with the aim line and a value badge. */
export function OneKeyChart({
  speeds,
  smoothness,
  target,
}: {
  readonly speeds: readonly number[];
  readonly smoothness: number;
  readonly target: number;
}): ReactNode {
  const { formatSpeed } = useFormatter();
  const W = 1000;
  const H = 150;
  const X0 = 36;
  const vals = smoothed(speeds, smoothness);
  if (vals.length < 2) {
    return (
      <div className={styles.axisRow}>
        <span className={styles.axis}>—</span>
      </div>
    );
  }
  const hi = Math.max(...vals, target) * 1.1;
  const lo = Math.min(...vals) * 0.8;
  const px = (i: number) => X0 + (i * (W - X0)) / Math.max(1, vals.length - 1);
  const py = (v: number) => 14 + ((hi - v) * (H - 24)) / (hi - lo || 1);
  const pts = vals.map((v, i) => [px(i), py(v)] as const);
  const [ex, ey] = pts[pts.length - 1];
  const gy = py(target);
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ blockSize: "8.5rem" }}
    >
      {[0.3, 0.7].map((f) => (
        <line
          key={f}
          x1={X0}
          y1={14 + (H - 24) * f}
          x2={W}
          y2={14 + (H - 24) * f}
          stroke="var(--primary-d2)"
          strokeWidth="1"
        />
      ))}
      <line
        x1={X0}
        y1={gy}
        x2={W}
        y2={gy}
        stroke="var(--secondary-f2)"
        strokeWidth="1.5"
        strokeDasharray="2 7"
      />
      <text
        x={W - 130}
        y={gy - 6}
        fill="var(--text-color-f2)"
        fontSize="10"
        style={{ fontFamily: "inherit" }}
      >
        AIM {formatSpeed(target)}
      </text>
      <path
        d={pathOf(pts)}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx={ex} cy={ey} r="3.5" fill="var(--accent)" />
      <rect
        x={ex - 80}
        y={ey + 7}
        width="62"
        height="17"
        rx="8"
        fill="var(--primary-l2)"
      />
      <text
        x={ex - 49}
        y={ey + 19}
        fill="var(--accent)"
        fontSize="10"
        fontWeight="700"
        textAnchor="middle"
        style={{ fontFamily: "inherit" }}
      >
        {formatSpeed(vals[vals.length - 1])}
      </text>
    </svg>
  );
}

/** Every key's own line, coloured by its confidence, labelled at the end. */
export function AllKeysChart({
  keyStatsMap,
  confidenceOf,
}: {
  readonly keyStatsMap: KeyStatsMap;
  readonly confidenceOf: (timeToType: number | null) => number | null;
}): ReactNode {
  const { confidenceColor } = useKeyStyles();
  const { formatSpeed } = useFormatter();
  const W = 1000;
  const H = 230;
  const X0 = 36;
  const series = keyStatsMap.letters
    .map((letter) => {
      const stats = keyStatsMap.get(letter);
      const speeds = stats.samples.map(({ filteredTimeToType }) =>
        timeToSpeed(filteredTimeToType),
      );
      const conf = confidenceOf(stats.timeToType);
      return { letter, speeds, conf };
    })
    .filter(({ speeds }) => speeds.length > 1);
  if (series.length === 0) {
    return null;
  }
  const all = series.flatMap(({ speeds }) => speeds);
  const hi = Math.max(...all) * 1.08;
  const lo = Math.min(...all) * 0.85;
  const maxLen = Math.max(...series.map(({ speeds }) => speeds.length));
  const py = (v: number) => 10 + ((hi - v) * (H - 20)) / (hi - lo || 1);
  // spread the end-of-line letter labels apart so close lines stay readable
  const ends = series
    .map(({ letter, speeds, conf }) => {
      const vals = smoothed(speeds, 0.6);
      return { letter, conf, vals, y: py(vals[vals.length - 1]) };
    })
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) {
    if (ends[i].y - ends[i - 1].y < 13) {
      ends[i] = { ...ends[i], y: ends[i - 1].y + 13 };
    }
  }
  const labelY = new Map(ends.map(({ letter, y }) => [letter, y]));
  const gridVals = [0.2, 0.5, 0.8].map((f) => lo + (hi - lo) * (1 - f));
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ blockSize: "11.5rem" }}
    >
      {gridVals.map((v) => (
        <g key={v}>
          <line
            x1={X0}
            y1={py(v)}
            x2={W - 28}
            y2={py(v)}
            stroke="var(--primary-d2)"
            strokeWidth="1"
          />
          <text
            x={2}
            y={py(v) + 3}
            fill="var(--text-color-f2)"
            fontSize="10"
            style={{ fontFamily: "inherit" }}
          >
            {formatSpeed(v, { unit: false })}
          </text>
        </g>
      ))}
      {ends.map(({ letter, vals, conf, y }) => {
        const px = (i: number) =>
          X0 + (i * (W - X0 - 28)) / Math.max(1, maxLen - 1);
        const pts = vals.map((v, i) => [px(i), py(v)] as const);
        const color = String(
          confidenceColor(Math.max(0, Math.min(1, conf ?? 0))),
        );
        const [lx, ly] = pts[pts.length - 1];
        return (
          <g key={String(letter)}>
            <path
              d={pathOf(pts)}
              fill="none"
              stroke={color}
              strokeWidth="2"
              opacity="0.9"
              strokeLinejoin="round"
            />
            <circle cx={lx} cy={ly} r="2.5" fill={color} />
            <text
              x={lx + 9}
              y={y + 3.5}
              fill={color}
              fontSize="11"
              fontWeight="700"
              style={{ fontFamily: "inherit" }}
            >
              {String.fromCodePoint(letter.codePoint).toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** The all-users distribution with your typical and best markers. */
export function PopulationChart({
  distribution,
  typical,
  best,
  typicalLabel,
  bestLabel,
  loLabel,
  hiLabel,
}: {
  readonly distribution: Distribution;
  readonly typical: number;
  readonly best: number;
  readonly typicalLabel: string;
  readonly bestLabel: string;
  readonly loLabel: string;
  readonly hiLabel: string;
}): ReactNode {
  const W = 400;
  const H = 104;
  const n = distribution.length;
  let maxPmf = 0;
  for (let i = 0; i < n; i++) {
    maxPmf = Math.max(maxPmf, distribution.pmf(i));
  }
  const pts: (readonly [number, number])[] = [];
  for (let i = 0; i < n; i++) {
    pts.push([
      (i / (n - 1)) * W,
      100 - (distribution.pmf(i) / (maxPmf || 1)) * 78,
    ]);
  }
  const tx = (typical / (n - 1)) * W;
  const bx = (best / (n - 1)) * W;
  const bNearEdge = bx > W - 70;
  const tNearStart = tx < 70;
  // when the two markers sit close, their labels take separate rows
  const crowded = Math.abs(bx - tx) < 95;
  const tLabelY = 11;
  const bLabelY = crowded ? 24 : 11;
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ blockSize: "7rem" }}
    >
      <path
        d={`${pathOf(pts)} L ${W} ${H} L 0 ${H} Z`}
        fill="var(--secondary-f2)"
        opacity="0.18"
      />
      <path
        d={pathOf(pts)}
        fill="none"
        stroke="var(--secondary-f1)"
        strokeWidth="1.4"
      />
      <line
        x1={tx}
        y1="16"
        x2={tx}
        y2="102"
        stroke="var(--accent)"
        strokeWidth="2"
      />
      <text
        x={tNearStart ? tx + 6 : tx - 6}
        y={tLabelY}
        fill="var(--accent)"
        fontSize="9.5"
        textAnchor={tNearStart ? "start" : "end"}
        style={{ fontFamily: "inherit" }}
      >
        {typicalLabel}
      </text>
      <line
        x1={bx}
        y1="16"
        x2={bx}
        y2="102"
        stroke="var(--fast-key-color)"
        strokeWidth="2"
        strokeDasharray="3 3"
      />
      <text
        x={bNearEdge ? bx - 6 : bx + 6}
        y={bLabelY}
        fill="var(--fast-key-color)"
        fontSize="9.5"
        textAnchor={bNearEdge ? "end" : "start"}
        style={{ fontFamily: "inherit" }}
      >
        {bestLabel}
      </text>
      <text
        x="2"
        y="100"
        fill="var(--text-color-f2)"
        fontSize="9"
        style={{ fontFamily: "inherit" }}
      >
        {loLabel}
      </text>
      <text
        x={W - 2}
        y="100"
        fill="var(--text-color-f2)"
        fontSize="9"
        textAnchor="end"
        style={{ fontFamily: "inherit" }}
      >
        {hiLabel}
      </text>
    </svg>
  );
}

/** The distribution of your own lessons' accuracy, with a peak annotation. */
export function OwnAccuracyChart({
  results,
}: {
  readonly results: readonly Result[];
}): ReactNode {
  const { formatMessage } = { formatMessage: (s: string) => s };
  void formatMessage;
  const BINS = 40;
  const bins = new Array<number>(BINS).fill(0);
  for (const { accuracy } of results) {
    const bin = Math.max(
      0,
      Math.min(BINS - 1, Math.floor(((accuracy - 0.9) / 0.1) * BINS)),
    );
    bins[bin] += 1;
  }
  const maxBin = Math.max(...bins, 1);
  const peakIndex = bins.indexOf(maxBin);
  const peakAcc = 90 + (peakIndex / BINS) * 10;
  const W = 400;
  const H = 116;
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ blockSize: "7rem" }}
    >
      {bins.map((count, i) => {
        const h = Math.max(3, (count / maxBin) * 90);
        return (
          <rect
            key={i}
            x={i * 10}
            y={H - h}
            width="7"
            height={h}
            rx="1.5"
            fill="var(--accent)"
            opacity={0.35 + 0.65 * (i / BINS)}
          />
        );
      })}
      {maxBin > 1 && (
        <text
          x={Math.min(peakIndex * 10 + 3, W - 70)}
          y={Math.max(10, H - (bins[peakIndex] / maxBin) * 90 - 6)}
          fill="var(--accent)"
          fontSize="9.5"
          textAnchor="middle"
          style={{ fontFamily: "inherit" }}
        >
          most: {peakAcc.toFixed(1)}% · {maxBin} lessons
        </text>
      )}
    </svg>
  );
}
