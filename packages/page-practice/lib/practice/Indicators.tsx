import { Tasks } from "@keybr/lang";
import { type LessonKey, lessonProps } from "@keybr/lesson";
import {
  GaugeList,
  LetterJourney,
  names,
  useFormatter,
} from "@keybr/lesson-ui";
import { LocalDate, type Result } from "@keybr/result";
import { useSettings } from "@keybr/settings";
import { Popup, Portal } from "@keybr/widget";
import { memo, type ReactNode, useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./Indicators.module.less";
import { KeyExtendedDetails } from "./KeyExtendedDetails.tsx";
import { type LessonState } from "./state/index.ts";

export const Indicators = memo(function Indicators({
  state: { keyStatsMap, summaryStats, lessonKeys },
}: {
  readonly state: LessonState;
}): ReactNode {
  type HoverState = Readonly<
    | { type: "hidden" }
    | { type: "visible-in"; key: LessonKey; elem: Element }
    | { type: "visible"; key: LessonKey; elem: Element }
    | { type: "visible-out"; key: LessonKey; elem: Element }
  >;
  const [hover, setHover] = useState<HoverState>({ type: "hidden" });
  useEffect(() => {
    const tasks = new Tasks();
    switch (hover.type) {
      case "visible-in":
        tasks.delayed(300, () => {
          setHover({ ...hover, type: "visible" });
        });
        break;
      case "visible-out":
        tasks.delayed(300, () => {
          setHover({ type: "hidden" });
        });
        break;
    }
    return () => {
      tasks.cancelAll();
    };
  }, [hover]);
  const { results } = keyStatsMap;
  const speeds = results.slice(-20).map(({ speed }) => speed);
  const streak = dailyStreak(results);
  useEffect(() => {
    // The header shows the streak chip; it lives outside this page's tree.
    window.dispatchEvent(
      new window.CustomEvent("keylearn:streak", { detail: streak }),
    );
    return () => {
      window.dispatchEvent(
        new window.CustomEvent("keylearn:streak", { detail: 0 }),
      );
    };
  }, [streak]);
  return (
    <div id={names.indicators} className={styles.indicators}>
      <LetterJourney
        lessonKeys={lessonKeys}
        onKeyHoverIn={(key, elem) => {
          setHover({ type: "visible-in", key, elem });
        }}
        onKeyHoverOut={() => {
          switch (hover.type) {
            case "visible-in":
              setHover({ type: "hidden" });
              break;
            case "visible":
              setHover({ ...hover, type: "visible-out" });
              break;
          }
        }}
      />
      <div className={styles.metrics}>
        <GaugeList
          summaryStats={summaryStats}
          speedSpark={speeds}
          names={names}
        />
        {speeds.length > 1 && <TrendTile speeds={speeds} />}
      </div>
      {(hover.type === "visible" || hover.type === "visible-out") && (
        <Portal>
          <Popup
            anchor={hover.elem}
            onMouseEnter={() => {
              setHover({ ...hover, type: "visible" });
            }}
            onMouseLeave={() => {
              setHover({ ...hover, type: "visible-out" });
            }}
          >
            <KeyExtendedDetails
              lessonKey={hover.key}
              keyStats={keyStatsMap.get(hover.key.letter)}
            />
          </Popup>
        </Portal>
      )}
    </div>
  );
});

function TrendTile({
  speeds,
}: {
  readonly speeds: readonly number[];
}): ReactNode {
  const { settings } = useSettings();
  const { formatSpeed } = useFormatter();
  const target = settings.get(lessonProps.targetSpeed);
  const width = 210;
  const height = 56;
  const pad = 4;
  const lo = Math.min(...speeds, target) * 0.95;
  const hi = Math.max(...speeds, target) * 1.05;
  const span = hi - lo || 1;
  const px = (i: number) =>
    pad + (i * (width - pad * 2)) / Math.max(1, speeds.length - 1);
  const py = (v: number) =>
    height - pad - ((v - lo) * (height - pad * 2)) / span;
  const points = speeds.map((v, i) => `${px(i)},${py(v)}`).join(" ");
  const last = speeds.length - 1;
  return (
    <div className={styles.trend}>
      <div className={styles.trendLabel}>
        <FormattedMessage
          id="practice.trend.label"
          defaultMessage="Past {count} lessons"
          values={{ count: speeds.length }}
        />
      </div>
      <svg
        className={styles.trendChart}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden={true}
      >
        <line
          className={styles.trendTarget}
          x1={pad}
          y1={py(target)}
          x2={width - pad}
          y2={py(target)}
        />
        <polyline className={styles.trendLine} points={points} />
        <circle
          className={styles.trendDot}
          cx={px(last)}
          cy={py(speeds[last])}
          r={2.5}
        />
      </svg>
      <div className={styles.trendCaption}>
        <FormattedMessage
          id="practice.trend.target"
          defaultMessage="goal {speed}"
          values={{ speed: formatSpeed(target) }}
        />
      </div>
    </div>
  );
}

function dailyStreak(results: readonly Result[]): number {
  if (results.length === 0) {
    return 0;
  }
  const days = new Set(
    results.map(({ timeStamp }) => new LocalDate(timeStamp).value),
  );
  const dayMs = 24 * 60 * 60 * 1000;
  let now = Date.now();
  if (!days.has(new LocalDate(now).value)) {
    now -= dayMs; // today not practised yet — count up to yesterday
  }
  let streak = 0;
  while (days.has(new LocalDate(now).value)) {
    streak += 1;
    now -= dayMs;
  }
  return streak;
}
