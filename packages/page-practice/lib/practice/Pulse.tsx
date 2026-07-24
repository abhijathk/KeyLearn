import { useIntlNumbers } from "@keybr/intl";
import {
  type DailyGoal as DailyGoalType,
  LearningRate,
  type LessonKeys,
  lessonProps,
  Target,
} from "@keybr/lesson";
import { Key, type Names, useFormatter } from "@keybr/lesson-ui";
import {
  type StreakList as StreakListType,
  type SummaryStats,
  timeToSpeed,
} from "@keybr/result";
import { useSettings } from "@keybr/settings";
import { StrokeIcon } from "@keybr/widget";
import { clsx } from "clsx";
import {
  type CSSProperties,
  memo,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./Pulse.module.less";

/**
 * The one-band telemetry: everything in a single composition with strict
 * visual hierarchy. The hero speed leads; the macro road (you on the way to
 * the target speed) and the focused key's micro road (its way to unlocking)
 * stack in one lane beside it, rhyming dot above dot; and every other number
 * collapses into a whisper line of pure typography underneath.
 */
export const Pulse = memo(function Pulse({
  summaryStats,
  speeds,
  lessonKeys,
  streakList,
  dailyGoal,
  names,
}: {
  readonly summaryStats: SummaryStats;
  readonly speeds: readonly number[];
  readonly lessonKeys: LessonKeys;
  readonly streakList: StreakListType;
  readonly dailyGoal: DailyGoalType;
  readonly names?: Names;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { formatNumber, formatPercents } = useIntlNumbers();
  const { formatSpeed, formatConfidence, speedUnit } = useFormatter();
  const { settings, updateSettings } = useSettings();
  const target = settings.get(lessonProps.targetSpeed);
  const { count, speed, accuracy, score } = summaryStats;
  const hasData = count > 0;
  const live = useLiveSpeed();
  // While the learner is actively typing, the hero shows the live cumulative
  // speed with a pulsing dot; otherwise the recorded last-lesson speed.
  const showLive = live.typing && live.cpm > 0;
  // The goal flag lights up the moment the current speed crosses the target.
  const crossed =
    target > 0 && (showLive ? live.cpm : hasData ? speed.last : 0) >= target;
  const frac =
    hasData && target > 0 ? Math.min(1, Math.max(0, speed.last / target)) : 0;
  const reached = hasData && speed.last >= target;

  const focusedKey = lessonKeys.findFocusedKey();
  const keyCalibrated =
    focusedKey != null &&
    focusedKey.timeToType != null &&
    focusedKey.bestTimeToType != null &&
    focusedKey.confidence != null &&
    focusedKey.bestConfidence != null;
  const conf = keyCalibrated
    ? Math.min(1, Math.max(0, focusedKey.confidence!))
    : 0;
  const best = keyCalibrated
    ? Math.min(1, Math.max(0, focusedKey.bestConfidence!))
    : 0;
  const learningRate =
    focusedKey != null
      ? (LearningRate.from(focusedKey.samples, new Target(settings))
          ?.learningRate ?? null)
      : null;

  return (
    <div className={styles.root}>
      <div className={styles.l1}>
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
            {showLive && (
              <i
                className={styles.liveDot}
                title={formatMessage({
                  id: "practice.live.description",
                  defaultMessage:
                    "Live speed — the running average while you type.",
                })}
              />
            )}
            {showLive
              ? formatSpeed(live.cpm, { unit: false })
              : hasData
                ? formatSpeed(speed.last, { unit: false })
                : "—"}
            <i className={styles.speedUnit}>{speedUnit.id}</i>
          </span>
        </div>
        {hasData && <Chip delta={speed.delta} text={formatSpeed} />}

        <div className={styles.roads}>
          <div
            className={clsx(styles.road, styles.roadMacro)}
            title={formatMessage({
              id: "practice.pulse.you.description",
              defaultMessage:
                "You are here — your latest speed on the way to the goal.",
            })}
          >
            {/* The track splits done:ahead by flex-grow so the fill is always
                exactly proportional; the goal label sits outside it and can't
                collapse the "still to go" dashes. */}
            <span className={styles.track}>
              <span className={styles.roadDone} style={{ flexGrow: frac }} />
              <span
                className={clsx(styles.you, reached && styles.youReached)}
              />
              <span
                className={styles.roadAhead}
                style={{ flexGrow: 1 - frac }}
              />
            </span>
            <span className={clsx(styles.goal, crossed && styles.goalLit)}>
              <svg
                className={styles.flag}
                viewBox="0 0 14 16"
                aria-hidden={true}
              >
                <path d="M3 15V2m0 0h8l-2.5 3L11 8H3" />
              </svg>
              {formatSpeed(target)}
              {/* Before the goal: a quiet "% of the way" hint. After it: the
                  flag pulses and a small −/+ appears to retune the goal. */}
              {hasData && !reached && (
                <em className={styles.pct}>
                  <FormattedMessage
                    id="practice.pulse.progress"
                    defaultMessage="{percent}% of the way"
                    values={{ percent: Math.round(frac * 100) }}
                  />
                </em>
              )}
              <GoalTuner
                target={target}
                reached={reached}
                onChange={(next) =>
                  updateSettings(settings.set(lessonProps.targetSpeed, next))
                }
              />
            </span>
          </div>

          <div
            id={names?.currentKey}
            className={clsx(styles.road, styles.roadMicro)}
            title={formatMessage({
              id: "practice.lane.road.description",
              defaultMessage:
                "This key's road to unlocking: the glowing dot is where you are now, the hollow ring is your best so far, the star is the unlock.",
            })}
          >
            {focusedKey != null ? (
              <>
                <span className={styles.keycap}>
                  <Key lessonKey={focusedKey} />
                </span>
                {keyCalibrated ? (
                  <>
                    <span className={styles.track}>
                      <span
                        className={clsx(styles.roadDone, styles.microDone)}
                        style={{ flexGrow: conf }}
                      />
                      <span className={clsx(styles.you, styles.microYou)} />
                      <span
                        className={styles.roadAhead}
                        style={{ flexGrow: 1 - conf }}
                      />
                      <span
                        className={styles.bestMark}
                        style={{ insetInlineStart: `${best * 100}%` }}
                      />
                    </span>
                    <svg
                      className={styles.star}
                      viewBox="0 0 14 14"
                      aria-hidden={true}
                    >
                      <path d="M7 1.2 8.5 5l3.9.2-3 2.5 1 3.8L7 9.3l-3.4 2.2 1-3.8-3-2.5L5.5 5Z" />
                    </svg>
                    <span className={styles.microVal}>
                      {formatSpeed(timeToSpeed(focusedKey.timeToType!))}
                      <i>
                        <FormattedMessage
                          id="practice.pulse.now"
                          defaultMessage="now"
                        />
                        {" · "}
                        {formatConfidence(focusedKey.confidence)}
                      </i>
                    </span>
                  </>
                ) : (
                  <span className={styles.microNote}>
                    <FormattedMessage
                      id="t_Not_calibrated_"
                      defaultMessage="Not calibrated yet — keep practicing to unlock this."
                    />
                  </span>
                )}
              </>
            ) : (
              <span className={styles.microNote}>
                <StrokeIcon className={styles.trophy} name="trophy" />
                <FormattedMessage
                  id="t_All_keys_are_unlocked"
                  defaultMessage="Every key is unlocked."
                />
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.whisper}>
        <span
          id={names?.accuracy}
          title={formatMessage({
            id: "metric.accuracy.description",
            defaultMessage:
              "The share of characters you typed correctly in the last lesson.",
          })}
        >
          <span className={styles.lab}>
            <FormattedMessage id="t_Accuracy" defaultMessage="Accuracy" />
          </span>
          <b>{hasData ? formatPercents(accuracy.last) : "—"}</b>{" "}
          {hasData && <Delta delta={accuracy.delta} text={formatPercents} />}
        </span>
        <span
          id={names?.score}
          title={formatMessage({
            id: "metric.score.description",
            defaultMessage:
              "Your last lesson's score, in points. " +
              "You earn more by typing faster and cleaner.",
          })}
        >
          <span className={styles.lab}>
            <FormattedMessage id="t_Score" defaultMessage="Score" />
          </span>
          <b>{hasData ? formatNumber(score.last, 0) : "—"}</b>{" "}
          {hasData && (
            <Delta delta={score.delta} text={(v) => formatNumber(v, 0)} />
          )}
        </span>
        <span
          title={formatMessage({
            id: "practice.lane.best.description",
            defaultMessage: "The fastest you have ever typed this key.",
          })}
        >
          <span className={styles.lab}>
            <FormattedMessage id="practice.pulse.best" defaultMessage="Best" />
          </span>
          {keyCalibrated ? (
            <>
              <b>{formatSpeed(timeToSpeed(focusedKey!.bestTimeToType!))}</b>
              {" · "}
              {formatConfidence(focusedKey!.bestConfidence)}
            </>
          ) : (
            <b>—</b>
          )}
        </span>
        <span
          title={formatMessage({
            id: "metric.learningRate.description",
            defaultMessage:
              "How your speed on this key is trending from lesson to lesson.",
          })}
        >
          <span className={styles.lab}>
            <FormattedMessage id="practice.pulse.pace" defaultMessage="Pace" />
          </span>
          {learningRate != null && learningRate === learningRate ? (
            <Delta
              delta={learningRate}
              text={(v) =>
                formatMessage(
                  {
                    id: "practice.pulse.perLesson",
                    defaultMessage: "{value}/lesson",
                  },
                  { value: formatSpeed(v) },
                )
              }
            />
          ) : (
            <b>—</b>
          )}{" "}
          <Mood rate={learningRate} />
        </span>
        <StreakWhisper streakList={streakList} />
        {dailyGoal.goal > 0 && <TodayWhisper dailyGoal={dailyGoal} />}
      </div>
    </div>
  );
});

// A tuning "session" begins at the learner's FIRST nudge and lasts 30s. It's
// kept at module scope on purpose: changing the target speed re-seeds the
// practice tree, which briefly remounts this component — module state survives
// that, so the −/+ doesn't vanish the instant it's clicked. It also means the
// control stays put for the full 30s even when raising the goal above the
// current speed momentarily un-reaches it.
const TUNE_MS = 30000;
let tuneStartedAt: number | null = null;
let tuneSpent = false; // a session already elapsed during the current reach

/**
 * The tiny −/+ that lets the learner retune their goal the moment they reach
 * it. It shows as soon as the goal is met; the learner's first nudge starts a
 * 30s clock (not restarted by later nudges) after which it fades — and it
 * stays visible for that whole window even if a nudge raises the goal past the
 * current speed. Steps snap to fives, exactly like the settings control, and
 * stay clamped to the target-speed bounds.
 */
function GoalTuner({
  target,
  reached,
  onChange,
}: {
  readonly target: number;
  readonly reached: boolean;
  readonly onChange: (next: number) => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [, bump] = useState(0);
  const [fading, setFading] = useState(false);
  const rerender = () => bump((n) => n + 1);
  const sessionActive =
    tuneStartedAt != null && Date.now() - tuneStartedAt < TUNE_MS;

  // Leaving the reached state clears the "already tuned" latch, so the next
  // time the goal is genuinely reached the control is offered afresh.
  useEffect(() => {
    if (!reached) {
      tuneSpent = false;
    }
  }, [reached]);

  // When the 30s window elapses, begin a slow fade rather than snapping away.
  useEffect(() => {
    if (tuneStartedAt == null || fading) {
      return;
    }
    const remaining = TUNE_MS - (Date.now() - tuneStartedAt);
    const t = setTimeout(
      () => {
        setFading(true);
      },
      Math.max(0, remaining),
    );
    return () => {
      clearTimeout(t);
    };
  }, [sessionActive, reached, fading]);

  // Once the fade has played out, actually retire the session.
  useEffect(() => {
    if (!fading) {
      return;
    }
    const t = setTimeout(() => {
      if (reached) {
        tuneSpent = true;
      }
      tuneStartedAt = null;
      setFading(false);
      rerender();
    }, 900);
    return () => {
      clearTimeout(t);
    };
  }, [fading, reached]);

  if (!fading && !sessionActive && (!reached || tuneSpent)) {
    return null;
  }

  const { min, max } = lessonProps.targetSpeed;
  // One nudge moves the goal a whole 5 units (of the displayed speed), snapped
  // to a round multiple.
  const STEP = 25; // 25 chars/min == 5 wpm
  const nudge = (dir: number) => {
    const next =
      dir < 0
        ? Math.max(min, Math.ceil(target / STEP) * STEP - STEP)
        : Math.min(max, Math.floor(target / STEP) * STEP + STEP);
    if (next !== target) {
      onChange(next);
    }
    if (tuneStartedAt == null) {
      tuneStartedAt = Date.now();
      rerender();
    }
  };

  return (
    <span className={clsx(styles.tuner, fading && styles.tunerLeaving)}>
      <button
        type="button"
        className={styles.tune}
        disabled={target <= min}
        onClick={() => {
          nudge(-1);
        }}
        title={formatMessage({
          id: "practice.pulse.goalDown",
          defaultMessage: "Lower the goal",
        })}
      >
        <svg viewBox="0 0 12 12" aria-hidden={true}>
          <path d="M2.5 6h7" />
        </svg>
      </button>
      <button
        type="button"
        className={styles.tune}
        disabled={target >= max}
        onClick={() => {
          nudge(1);
        }}
        title={formatMessage({
          id: "practice.pulse.goalUp",
          defaultMessage: "Raise the goal",
        })}
      >
        <svg viewBox="0 0 12 12" aria-hidden={true}>
          <path d="M6 2.5v7M2.5 6h7" />
        </svg>
      </button>
    </span>
  );
}

/**
 * Live typing speed for the hero readout: listens for the controller's live
 * cumulative-speed events and whether keys are currently landing. The dot
 * only pulses while typing; when it stops the hero falls back to the recorded
 * last-lesson number (which the live value has converged to).
 */
function useLiveSpeed(): { readonly cpm: number; readonly typing: boolean } {
  const [cpm, setCpm] = useState(0);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const onSpeed = (ev: Event) => {
      setCpm((ev as CustomEvent<number>).detail);
    };
    const onTyping = (ev: Event) => {
      const on = Boolean((ev as CustomEvent<boolean>).detail);
      setTyping(on);
      if (!on) {
        setCpm(0);
      }
    };
    window.addEventListener("keylearn:live-speed", onSpeed);
    window.addEventListener("keylearn:typing", onTyping);
    return () => {
      window.removeEventListener("keylearn:live-speed", onSpeed);
      window.removeEventListener("keylearn:typing", onTyping);
    };
  }, []);
  return { cpm, typing };
}

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

/** A whisper-line delta: just a tinted numeral, no pill. */
function Delta({
  delta,
  text,
  plain = false,
}: {
  readonly delta: number;
  readonly text: (value: number) => string;
  readonly plain?: boolean;
}): ReactNode {
  const { formatMessage } = useIntl();
  const cls = delta > 0 ? styles.up : delta < 0 ? styles.down : undefined;
  const sign = plain ? "" : delta > 0 ? "+" : delta < 0 ? "−" : "";
  return (
    <span
      className={cls}
      title={formatMessage({
        id: "metric.difference.description",
        defaultMessage: "How this compares to your average.",
      })}
    >
      {sign}
      {text(plain ? delta : Math.abs(delta))}
    </span>
  );
}

/**
 * The mood face, drawn from scratch for KeyLearn: one round stroke-style face
 * whose mouth bends with the learning rate — gently up, up, or beaming at
 * +1/+5/+10 per lesson, with the mirror frowns going down. Flat and grey when
 * nothing is moving.
 */
function Mood({ rate }: { readonly rate: number | null }): ReactNode {
  const r = rate != null && rate === rate ? rate : 0;
  const level =
    r > 0
      ? r >= 10
        ? 3
        : r >= 5
          ? 2
          : 1
      : r < 0
        ? r <= -10
          ? 3
          : r <= -5
            ? 2
            : 1
        : 0;
  const happy = r > 0;
  const sad = r < 0;
  const bend = level * 2.2;
  const d = happy
    ? `M6.6 12 Q10 ${12 + bend} 13.4 12`
    : sad
      ? `M6.6 13.4 Q10 ${13.4 - bend} 13.4 13.4`
      : "M6.9 12.7 H13.1";
  return (
    <svg
      className={clsx(
        styles.mood,
        happy && styles.moodHappy,
        sad && styles.moodSad,
        level >= 3 && styles.moodMax,
      )}
      viewBox="0 0 20 20"
      aria-hidden={true}
    >
      <circle cx="10" cy="10" r="8.4" />
      {level >= 3 && happy ? (
        <>
          <path d="M5.9 8.2 Q7.2 6.8 8.5 8.2" />
          <path d="M11.5 8.2 Q12.8 6.8 14.1 8.2" />
        </>
      ) : (
        <>
          <circle className={styles.moodEye} cx="7.2" cy="8" r="0.95" />
          <circle className={styles.moodEye} cx="12.8" cy="8" r="0.95" />
        </>
      )}
      <path d={d} />
    </svg>
  );
}

const milestones = [5, 10, 25, 50, 100, 250];

function StreakWhisper({
  streakList,
}: {
  readonly streakList: StreakListType;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { formatPercents } = useIntlNumbers();
  let bestRun: { level: number; length: number } | null = null;
  for (const { level, results } of streakList) {
    if (results.length > 0 && (bestRun == null || level > bestRun.level)) {
      bestRun = { level, length: results.length };
    }
  }
  const title = formatMessage({
    id: "practice.lane.streak.description",
    defaultMessage:
      "Your longest run of lessons typed at high accuracy, and the next milestone.",
  });
  if (bestRun == null) {
    return (
      <span title={title}>
        <span className={styles.lab}>
          <FormattedMessage
            id="practice.pulse.streak"
            defaultMessage="Streak"
          />
        </span>
        <b>—</b>
      </span>
    );
  }
  const next = milestones.find((m) => m > bestRun.length) ?? bestRun.length;
  const prev = [0, ...milestones].filter((m) => m <= bestRun.length).pop() ?? 0;
  const fracRun = next > prev ? (bestRun.length - prev) / (next - prev) : 1;
  return (
    <span title={`${title} (${formatPercents(bestRun.level)}+)`}>
      <span className={styles.lab}>
        <FormattedMessage id="practice.pulse.streak" defaultMessage="Streak" />
      </span>
      <b>{bestRun.length}</b>
      <span className={styles.miniBar}>
        <i
          style={
            { inlineSize: `${Math.round(fracRun * 100)}%` } as CSSProperties
          }
        />
      </span>
      <FormattedMessage
        id="practice.pulse.next"
        defaultMessage="next {next}"
        values={{ next }}
      />
    </span>
  );
}

/**
 * Accrues practice time live, between lesson results: while keys are landing
 * (the presenter's typing signal) a one-second ticker adds to a local extra,
 * and every recorded result resets the extra so nothing double-counts. The
 * ring moves while you type instead of jumping once per lesson.
 */
function useLiveExtraMs(recordedValue: number): number {
  const [typing, setTyping] = useState(false);
  const [extraMs, setExtraMs] = useState(0);
  useEffect(() => {
    const onTyping = (ev: Event) => {
      setTyping(Boolean((ev as CustomEvent<boolean>).detail));
    };
    window.addEventListener("keylearn:typing", onTyping);
    return () => {
      window.removeEventListener("keylearn:typing", onTyping);
    };
  }, []);
  useEffect(() => {
    if (!typing) {
      return;
    }
    const timer = setInterval(() => {
      setExtraMs((ms) => ms + 1000);
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [typing]);
  useEffect(() => {
    // A finished lesson lands in the recorded value; drop the live extra.
    setExtraMs(0);
  }, [recordedValue]);
  return extraMs;
}

function TodayWhisper({
  dailyGoal,
}: {
  readonly dailyGoal: DailyGoalType;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { value: recorded, goal } = dailyGoal;
  const extraMs = useLiveExtraMs(recorded);
  const value = recorded + (goal > 0 ? extraMs / (goal * 60000) : 0);
  const done = value >= 1;
  const pct = Math.max(0, Math.min(1, value));
  const minutesDone = Math.floor(value * goal);
  return (
    <span
      title={formatMessage({
        id: "practice.lane.today.description",
        defaultMessage:
          "Today's practice time, out of your daily goal. Only time spent actually typing counts — pauses between lessons don't.",
      })}
    >
      <span
        className={clsx(styles.miniRing, done && styles.miniRingDone)}
        style={{ "--p": `${Math.round(pct * 100)}%` } as CSSProperties}
      />
      <b>
        <FormattedMessage
          id="practice.lane.todayMinutes"
          defaultMessage="{done}/{goal}min"
          values={{ done: minutesDone, goal }}
        />
      </b>{" "}
      <span className={styles.lab}>
        <FormattedMessage id="t_Daily_goal" defaultMessage="Today's goal" />
      </span>
    </span>
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
