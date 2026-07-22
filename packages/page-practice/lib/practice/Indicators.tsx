import { Tasks } from "@keybr/lang";
import { type LessonKey } from "@keybr/lesson";
import { LetterJourney, names } from "@keybr/lesson-ui";
import { LocalDate, type Result } from "@keybr/result";
import { Popup, Portal } from "@keybr/widget";
import { memo, type ReactNode, useEffect, useState } from "react";
import * as styles from "./Indicators.module.less";
import { KeyExtendedDetails } from "./KeyExtendedDetails.tsx";
import { Pulse } from "./Pulse.tsx";
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
        id={names.keySet}
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
        <Pulse summaryStats={summaryStats} speeds={speeds} names={names} />
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
