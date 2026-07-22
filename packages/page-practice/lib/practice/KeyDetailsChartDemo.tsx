import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./KeyDetailsChartDemo.module.less";

// An illustrative learning curve in the road language: solid road of past
// lessons, a glowing you-dot at "now", and a dotted forecast climbing to the
// target-speed goal — the same story the profile charts tell.
const LESSONS = 24;
const NOW = 14;
const START = 24;
const NOW_SPEED = 35;
const GOAL = 45;

export function KeyDetailsChartDemo(): ReactNode {
  const W = 400;
  const H = 150;
  const PAD = 20;
  const x = (lesson: number) => ((lesson - 1) / (LESSONS - 1)) * (W - 12) + 3;
  const y = (speed: number) =>
    H - PAD - ((speed - START + 4) / (GOAL - START + 8)) * (H - PAD * 2);
  const past: (readonly [number, number])[] = [];
  for (let i = 1; i <= NOW; i++) {
    const t = (i - 1) / (NOW - 1);
    // a gently easing climb with a deterministic wobble
    const speed = START + (NOW_SPEED - START) * t + Math.sin(i * 2.1) * 0.6;
    past.push([x(i), y(speed)] as const);
  }
  const pastPath = past
    .map(
      ([px, py], i) =>
        `${i === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`,
    )
    .join(" ");
  const [nx, ny] = past[past.length - 1];
  const gy = y(GOAL);
  return (
    <div className={styles.root}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          y1={gy}
          x2={W}
          y2={gy}
          stroke="var(--fast-key-color)"
          strokeWidth="1"
          strokeDasharray="3 4"
          opacity="0.7"
        />
        <text
          x={4}
          y={gy - 5}
          fill="var(--fast-key-color)"
          fontSize="9"
          style={{ fontFamily: "inherit" }}
        >
          {`goal ${GOAL}wpm`}
        </text>
        <path
          d={pastPath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {past.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r="2.6" fill="var(--accent)" />
        ))}
        <path
          d={`M ${nx.toFixed(1)} ${ny.toFixed(1)} L ${x(LESSONS)} ${gy}`}
          fill="none"
          stroke="var(--text-color-f2)"
          strokeWidth="1.6"
          strokeDasharray="1.5 5"
          strokeLinecap="round"
        />
        <circle
          cx={x(LESSONS)}
          cy={gy}
          r="4"
          fill="none"
          stroke="var(--fast-key-color)"
          strokeWidth="1.5"
        />
        <circle cx={nx} cy={ny} r="4.5" fill="var(--accent)">
          <animate
            attributeName="opacity"
            values="1;0.55;1"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
        <text
          x={nx}
          y={ny - 9}
          fill="var(--accent)"
          fontSize="9.5"
          textAnchor="middle"
          style={{ fontFamily: "inherit" }}
        >
          now
        </text>
        <text
          x="2"
          y={H - 2}
          fill="var(--text-color-f2)"
          fontSize="9"
          style={{ fontFamily: "inherit" }}
        >
          lesson 1
        </text>
        <text
          x={W - 2}
          y={H - 2}
          fill="var(--text-color-f2)"
          fontSize="9"
          textAnchor="end"
          style={{ fontFamily: "inherit" }}
        >
          {LESSONS}
        </text>
      </svg>
      <div className={styles.legend}>
        <FormattedMessage
          id="practice.tour.chartLegend"
          defaultMessage="past lessons — the dotted road ahead is the forecast to the goal"
        />
      </div>
    </div>
  );
}
