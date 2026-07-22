import { type Distribution } from "@keybr/math";
import { type Step } from "@keybr/textinput";
import { type ReactNode } from "react";
import * as styles from "./road.module.less";

function pathOf(points: readonly (readonly [number, number])[]): string {
  let d = "";
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    d += `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d;
}

/**
 * The population curve with a single glowing "you" marker — the same shape
 * as the profile page's comparison charts.
 */
export function PopulationChart({
  distribution,
  value,
  valueLabel,
  loLabel,
  hiLabel,
}: {
  readonly distribution: Distribution;
  readonly value: number;
  readonly valueLabel: string;
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
  const vx = (Math.max(0, Math.min(n - 1, value)) / (n - 1)) * W;
  const nearEnd = vx > W - 70;
  const nearStart = vx < 70;
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
        x1={vx}
        y1="16"
        x2={vx}
        y2="102"
        stroke="var(--accent)"
        strokeWidth="2"
      />
      <text
        x={nearEnd ? vx - 6 : vx + 6}
        y="11"
        fill="var(--accent)"
        fontSize="9.5"
        textAnchor={nearEnd ? "end" : nearStart ? "start" : "start"}
        style={{ fontFamily: "inherit" }}
      >
        {valueLabel}
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

/**
 * Your speed as the test went on — an area road with the average as a
 * dashed line, in the speed-story language of the profile page.
 */
export function RollingSpeedChart({
  steps,
  averageSpeed,
  formatSpeed,
}: {
  readonly steps: readonly Step[];
  readonly averageSpeed: number;
  readonly formatSpeed: (value: number) => string;
}): ReactNode {
  const W = 400;
  const H = 130;
  const PAD = 16;
  const window = 10;
  const samples: (readonly [number, number])[] = [];
  if (steps.length > window) {
    const t0 = steps[0].timeStamp;
    const span = steps[steps.length - 1].timeStamp - t0 || 1;
    for (let i = window; i < steps.length; i++) {
      const dt = steps[i].timeStamp - steps[i - window].timeStamp;
      if (dt > 0) {
        samples.push([
          (steps[i].timeStamp - t0) / span,
          (window / dt) * 60000, // chars per minute
        ]);
      }
    }
  }
  if (samples.length < 2) {
    return null;
  }
  const hi = Math.max(averageSpeed, ...samples.map(([, v]) => v)) * 1.1;
  const pts = samples.map(
    ([t, v]) => [t * W, H - PAD - (v / hi) * (H - PAD * 2)] as const,
  );
  const avgY = H - PAD - (averageSpeed / hi) * (H - PAD * 2);
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ blockSize: "8rem" }}
    >
      <defs>
        <linearGradient id="ttRollFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path
        d={`${pathOf(pts)} L ${pts[pts.length - 1][0]} ${H} L ${pts[0][0]} ${H} Z`}
        fill="url(#ttRollFill)"
      />
      <path
        d={pathOf(pts)}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <line
        x1="0"
        y1={avgY}
        x2={W}
        y2={avgY}
        stroke="var(--text-color-f2)"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <text
        x={W - 4}
        y={avgY - 5}
        fill="var(--text-color-f2)"
        fontSize="9"
        textAnchor="end"
        style={{ fontFamily: "inherit" }}
      >
        {`avg ${formatSpeed(averageSpeed)}`}
      </text>
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="3.5"
        fill="var(--accent)"
      />
    </svg>
  );
}

/**
 * How long each character took — an accent histogram with the busiest bin
 * called out, like the profile page's accuracy histogram.
 */
export function TimeToTypeChart({
  steps,
}: {
  readonly steps: readonly Step[];
}): ReactNode {
  const BIN = 25; // milliseconds
  const BINS = 20; // 0..500ms, the last bin collects the overflow
  const counts = new Array(BINS).fill(0);
  for (const { timeToType } of steps) {
    if (timeToType > 0) {
      counts[Math.min(BINS - 1, Math.floor(timeToType / BIN))] += 1;
    }
  }
  const max = Math.max(1, ...counts);
  const peak = counts.indexOf(Math.max(...counts));
  const W = 400;
  const H = 120;
  const bw = W / BINS;
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ blockSize: "7.5rem" }}
    >
      {counts.map((count, i) => {
        const h = (count / max) * (H - 34);
        if (count === 0) {
          return null;
        }
        return (
          <rect
            key={i}
            x={i * bw + 1.5}
            y={H - 14 - h}
            width={bw - 3}
            height={Math.max(2, h)}
            rx="2"
            fill={
              i === peak
                ? "var(--accent)"
                : "color-mix(in oklab, var(--accent) 45%, var(--primary-l1))"
            }
          />
        );
      })}
      <text
        x={Math.min(W - 4, Math.max(30, peak * bw + bw / 2))}
        y={H - 20 - (counts[peak] / max) * (H - 34)}
        fill="var(--text-color-f1)"
        fontSize="9"
        textAnchor="middle"
        style={{ fontFamily: "inherit" }}
      >
        {`most ${peak * BIN}–${(peak + 1) * BIN}ms`}
      </text>
      <text
        x="2"
        y={H - 2}
        fill="var(--text-color-f2)"
        fontSize="9"
        style={{ fontFamily: "inherit" }}
      >
        0ms
      </text>
      <text
        x={W - 2}
        y={H - 2}
        fill="var(--text-color-f2)"
        fontSize="9"
        textAnchor="end"
        style={{ fontFamily: "inherit" }}
      >
        {`${BIN * BINS}ms+`}
      </text>
    </svg>
  );
}
