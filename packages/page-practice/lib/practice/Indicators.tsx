import { Tasks } from "@keylearn/lang";
import { type LessonKey } from "@keylearn/lesson";
import { LetterJourney, names } from "@keylearn/lesson-ui";
import { dailyStreak } from "@keylearn/result";
import { Popup, Portal } from "@keylearn/widget";
import { memo, type ReactNode, useEffect, useState } from "react";
import * as styles from "./Indicators.module.less";
import { KeyExtendedDetails } from "./KeyExtendedDetails.tsx";
import { Pulse } from "./Pulse.tsx";
import { type LessonState } from "./state/index.ts";

export const Indicators = memo(function Indicators({
  state: {
    keyStatsMap,
    summaryStats,
    lessonKeys,
    streakList,
    dailyGoal,
    bottleneck,
  },
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
      <div className={styles.metrics}>
        <Pulse
          summaryStats={summaryStats}
          speeds={speeds}
          results={results}
          lessonKeys={lessonKeys}
          streakList={streakList}
          dailyGoal={dailyGoal}
          bottleneck={bottleneck}
          names={names}
        />
      </div>
    </div>
  );
});

/**
 * The letter journey as its own strip, parked at the bottom of the screen
 * below the keyboard and the resting hands.
 */
export const JourneyStrip = memo(function JourneyStrip({
  state: { keyStatsMap, lessonKeys },
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
  // Code and number lessons put every key in play from the start, so the strip
  // draws a full bar and "32/32" under every lesson and never changes again.
  // Something that always says the same thing is not an indicator.
  if (lessonKeys.findIncludedKeys().length >= lessonKeys.letters.length) {
    return null;
  }
  return (
    <div className={styles.journeyStrip}>
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
