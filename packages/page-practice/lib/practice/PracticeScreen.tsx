import { catchError } from "@keybr/debug";
import { KeyboardProvider } from "@keybr/keyboard";
import { schedule } from "@keybr/lang";
import { type Lesson, lessonProps } from "@keybr/lesson";
import { LessonLoader } from "@keybr/lesson-loader";
import { LoadingProgress } from "@keybr/pages-shared";
import { DailyStatsMap, type Result, useResults } from "@keybr/result";
import { useSettings } from "@keybr/settings";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller } from "./Controller.tsx";
import { GoalCeremony } from "./GoalCeremony.tsx";
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
};

// The goal ceremony fires once per calendar day, even across page reloads.
const goalCelebratedKey = "keylearn.goalCelebrated";

function goalAlreadyCelebrated(): boolean {
  try {
    return (
      localStorage.getItem(goalCelebratedKey) === new Date().toDateString()
    );
  } catch {
    return false;
  }
}

function rememberGoalCelebrated(): void {
  try {
    localStorage.setItem(goalCelebratedKey, new Date().toDateString());
  } catch {
    // Storage may be unavailable; celebrating twice is harmless.
  }
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
              progress.append(result, (event) => {
                if (event.type === "new-letter") {
                  // The unlock ceremony replaces the plain toast for new keys.
                  setCeremony({
                    label: event.lessonKey.letter.label,
                    result,
                    prev,
                  });
                } else if (event.type === "daily-goal") {
                  // Crossing the daily goal earns the full ceremony window.
                  if (!goalAlreadyCelebrated()) {
                    rememberGoalCelebrated();
                    const today = new DailyStatsMap([...results, result]).today
                      .results;
                    setGoal({
                      goalMinutes: settings.get(lessonProps.dailyGoal),
                      minutes: Math.round(
                        today.reduce((sum, { time }) => sum + time, 0) / 60000,
                      ),
                      lessons: today.length,
                      topSpeed: Math.max(...today.map(({ speed }) => speed)),
                    });
                  }
                } else {
                  // Records celebrate at eye level, above the text.
                  showAward(event);
                }
              });
              appendResults([result]);
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
            onContinue={() => {
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
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState({ total: 0, current: 0 });
  const progress = useMemo(
    () => new Progress(settings, lesson),
    [settings, lesson],
  );
  useEffect(() => {
    // Populating the progress object can take a long time, so we do this
    // asynchronously, interleaved with the browser event loop to avoid
    // freezing of the UI.
    const controller = new AbortController();
    const { signal } = controller;
    schedule(progress.seedAsync(lesson.filter(results), setLoading), { signal })
      .then(() => setDone(true))
      .catch(catchError);
    return () => {
      controller.abort();
    };
  }, [progress, lesson, results]);
  return [done ? progress : null, loading] as const;
}
