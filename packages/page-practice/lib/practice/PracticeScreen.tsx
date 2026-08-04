import { catchError } from "@keylearn/debug";
import { KeyboardProvider } from "@keylearn/keyboard";
import { schedule } from "@keylearn/lang";
import { type Lesson, lessonProps } from "@keylearn/lesson";
import { LessonLoader } from "@keylearn/lesson-loader";
import { LoadingProgress, profileStorageKey } from "@keylearn/pages-shared";
import { DailyStatsMap, type Result, useResults } from "@keylearn/result";
import { useSettings } from "@keylearn/settings";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller } from "./Controller.tsx";
import { GoalCeremony, type GoalMode } from "./GoalCeremony.tsx";
import { SessionAward } from "./SessionAward.tsx";
import { type LessonEvent, Progress } from "./state/index.ts";
import { UnlockCeremony } from "./UnlockCeremony.tsx";

export function PracticeScreen() {
  return (
    <KeyboardProvider>
      <LessonLoader>
        {(lesson) => <ProgressUpdater lesson={lesson} />}
      </LessonLoader>
    </KeyboardProvider>
  );
}

type Ceremony = {
  readonly label: string;
  readonly result: Result;
  readonly prev: Result | null;
};

type GoalStats = {
  readonly goalMinutes: number;
  readonly minutes: number;
  readonly lessons: number;
  readonly topSpeed: number;
  readonly accuracy: number;
  readonly weeklySpeeds: readonly number[];
  readonly slowestKeys: readonly string[];
  readonly isPersonalBest: boolean;
  readonly mode: GoalMode;
};

// Research-backed healthy ceiling: past ~45 minutes of focused practice in a
// day, extra typing buys little skill (micro-offline gains favour rest, and
// fine-motor accuracy fatigues), so the window flips from "keep going" to
// "time to rest". Kept as a single constant so it's easy to tune.
const REST_CEILING_MINUTES = 45;

// The goal ceremony fires once per calendar day, even across page reloads.
const goalCelebratedKey = () => profileStorageKey("keylearn.goalCelebrated");
// The rest nudge (crossing the healthy ceiling) also fires at most once a day.
const restNudgedKey = () => profileStorageKey("keylearn.goalRestNudged");

function markedToday(key: string): boolean {
  try {
    return localStorage.getItem(key) === new Date().toDateString();
  } catch {
    return false;
  }
}

function markToday(key: string): void {
  try {
    localStorage.setItem(key, new Date().toDateString());
  } catch {
    // Storage may be unavailable; showing twice is harmless.
  }
}

function todayMinutes(results: readonly Result[]): number {
  const today = new DailyStatsMap(results).today.results;
  return Math.round(today.reduce((sum, { time }) => sum + time, 0) / 60000);
}

// Assemble everything the goal-report window shows from the full result set.
function buildGoalStats(
  allResults: readonly Result[],
  progress: Progress,
  goalMinutes: number,
  mode: GoalMode,
): GoalStats {
  const map = new DailyStatsMap(allResults);
  const today = map.today.results;
  const minutes = Math.round(
    today.reduce((sum, { time }) => sum + time, 0) / 60000,
  );
  let topSpeed = 0;
  for (const { speed } of today) {
    if (speed > topSpeed) {
      topSpeed = speed;
    }
  }
  const accuracy =
    today.length > 0
      ? today.reduce((sum, { accuracy }) => sum + accuracy, 0) / today.length
      : 0;
  // Top speed for each of the last practice days (skipped days don't count).
  const weeklySpeeds = [...map]
    .sort((a, b) => (String(a.date) < String(b.date) ? -1 : 1))
    .slice(-7)
    .map((d) => d.results.reduce((m, r) => Math.max(m, r.speed), 0));
  // The slowest keys practised so far — highest filtered time-to-type.
  const slowestKeys = [...progress.keyStatsMap]
    .filter((k) => k.timeToType != null)
    .sort((a, b) => (b.timeToType ?? 0) - (a.timeToType ?? 0))
    .slice(0, 3)
    .map((k) => k.letter.label.toUpperCase());
  // Looped rather than spread. `Math.max(...results)` puts every result on the
  // call stack as an argument, which is fine at a few hundred lessons and
  // overflows at tens of thousands — a limit a committed learner reaches, and
  // reaches by doing exactly what the app asked of them.
  let allTimeMax = 0;
  for (const { speed } of allResults) {
    if (speed > allTimeMax) {
      allTimeMax = speed;
    }
  }
  const isPersonalBest = today.length > 0 && topSpeed >= allTimeMax;
  return {
    goalMinutes,
    minutes,
    lessons: today.length,
    topSpeed,
    accuracy,
    weeklySpeeds,
    slowestKeys,
    isPersonalBest,
    mode,
  };
}

function ProgressUpdater({ lesson }: { readonly lesson: Lesson }) {
  const { settings } = useSettings();
  const { results, appendResults } = useResults();
  const [progress, { total, current }] = useProgress(lesson, results);
  const [ceremony, setCeremony] = useState<Ceremony | null>(null);
  const [goal, setGoal] = useState<GoalStats | null>(null);
  const [award, setAward] = useState<LessonEvent | null>(null);
  const awardTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const showAward = (event: LessonEvent) => {
    setAward(event);
    clearTimeout(awardTimer.current);
    awardTimer.current = setTimeout(() => setAward(null), 3500);
  };
  useEffect(() => () => clearTimeout(awardTimer.current), []);
  if (progress == null) {
    return <LoadingProgress total={total} current={current} />;
  } else {
    return (
      <>
        <Controller
          progress={progress}
          onResult={(result) => {
            if (result.validate()) {
              const prev =
                results.length > 0 ? results[results.length - 1] : null;
              const all = [...results, result];
              const goalMinutes = settings.get(lessonProps.dailyGoal);
              progress.append(result, (event) => {
                if (event.type === "new-letter") {
                  // The unlock ceremony replaces the plain toast for new keys.
                  setCeremony({
                    label: event.lessonKey.letter.label,
                    result,
                    prev,
                  });
                } else if (event.type === "daily-goal") {
                  // Crossing the daily goal earns the full report window.
                  if (!markedToday(goalCelebratedKey())) {
                    markToday(goalCelebratedKey());
                    const rest = todayMinutes(all) >= REST_CEILING_MINUTES;
                    if (rest) {
                      markToday(restNudgedKey());
                    }
                    setGoal(
                      buildGoalStats(
                        all,
                        progress,
                        goalMinutes,
                        rest ? "rest" : "roll",
                      ),
                    );
                  }
                } else {
                  // Records celebrate at eye level, above the text.
                  showAward(event);
                }
              });
              appendResults([result]);
              // If they keep going past the healthy ceiling later in the day,
              // resurface the report in "rest" mode (once) to steer toward a break.
              if (
                markedToday(goalCelebratedKey()) &&
                !markedToday(restNudgedKey()) &&
                todayMinutes(all) >= REST_CEILING_MINUTES
              ) {
                markToday(restNudgedKey());
                setGoal(buildGoalStats(all, progress, goalMinutes, "rest"));
              }
            }
          }}
        />
        {award != null && (
          <SessionAward
            event={award}
            onClose={() => {
              clearTimeout(awardTimer.current);
              setAward(null);
            }}
          />
        )}
        {ceremony != null && (
          <UnlockCeremony
            label={ceremony.label}
            result={ceremony.result}
            prev={ceremony.prev}
            onContinue={() => {
              setCeremony(null);
            }}
            onClose={() => {
              setCeremony(null);
            }}
          />
        )}
        {goal != null && (
          <GoalCeremony
            goalMinutes={goal.goalMinutes}
            minutes={goal.minutes}
            lessons={goal.lessons}
            topSpeed={goal.topSpeed}
            accuracy={goal.accuracy}
            weeklySpeeds={goal.weeklySpeeds}
            slowestKeys={goal.slowestKeys}
            isPersonalBest={goal.isPersonalBest}
            mode={goal.mode}
            onContinue={() => {
              setGoal(null);
            }}
            onDone={() => {
              setGoal(null);
            }}
          />
        )}
      </>
    );
  }
}

function useProgress(lesson: Lesson, results: readonly Result[]) {
  const { settings } = useSettings();
  const [seeded, setSeeded] = useState<Progress | null>(null);
  const [loading, setLoading] = useState({ total: 0, current: 0 });
  const progress = useMemo(
    () => new Progress(settings, lesson),
    [settings, lesson],
  );
  useEffect(() => {
    // Populating the progress object can take a long time, so we do this
    // asynchronously, interleaved with the browser event loop to avoid
    // freezing of the UI. We track which progress *object* has been seeded, so
    // that when a settings change (e.g. nudging the target speed) swaps in a
    // fresh, empty progress, we report null until it is seeded — otherwise the
    // empty object renders as blank stats and never re-populates (the seed
    // completing wouldn't change any state to trigger a re-render).
    const controller = new AbortController();
    const { signal } = controller;
    schedule(progress.seedAsync(lesson.filter(results), setLoading), { signal })
      .then(() => setSeeded(progress))
      .catch(catchError);
    return () => {
      controller.abort();
    };
  }, [progress, lesson, results]);
  return [seeded === progress ? progress : null, loading] as const;
}
