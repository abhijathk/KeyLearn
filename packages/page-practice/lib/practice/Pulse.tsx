import { useIntlNumbers } from "@keylearn/intl";
import {
  type DailyGoal as DailyGoalType,
  LearningRate,
  type LessonKey,
  type LessonKeys,
  lessonProps,
  LessonType,
  suggestTarget,
  Target,
} from "@keylearn/lesson";
import { Key, type Names, useFormatter } from "@keylearn/lesson-ui";
import {
  type Result,
  type StreakList as StreakListType,
  type SummaryStats,
  timeToSpeed,
} from "@keylearn/result";
import { useSettings } from "@keylearn/settings";
import { StrokeIcon } from "@keylearn/widget";
import { clsx } from "clsx";
import {
  type CSSProperties,
  memo,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./Pulse.module.less";
import {
  AlphabetGrid,
  GoalRing,
  SessionMarks,
  SlowKeys,
  SpeedSpark,
} from "./RecapCharts.tsx";
import { speedTrend } from "./trend.ts";

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
  results,
  lessonKeys,
  streakList,
  dailyGoal,
  bottleneck,
  names,
}: {
  readonly summaryStats: SummaryStats;
  readonly speeds: readonly number[];
  readonly results: readonly Result[];
  readonly lessonKeys: LessonKeys;
  readonly streakList: StreakListType;
  readonly dailyGoal: DailyGoalType;
  /** The slow key-pair this round is aimed at, if any. */
  readonly bottleneck: { readonly from: number; readonly to: number } | null;
  readonly names?: Names;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { formatNumber, formatPercents } = useIntlNumbers();
  const { formatSpeed, formatConfidence, speedUnit } = useFormatter();
  const { settings, updateSettings } = useSettings();
  const target = settings.get(lessonProps.targetSpeed);
  const { count, speed, accuracy, score } = summaryStats;
  const hasData = count > 0;
  const [expanded, setExpanded] = useState(readExpanded);
  const toggleExpanded = () => {
    setExpanded((v) => {
      writeExpanded(!v);
      return !v;
    });
  };
  // A sitting starts when the gap since the previous lesson is long enough
  // that the hands have gone cold. Half an hour is generous — a tea break is
  // not a new sitting, an evening away is.
  const warmingUp = (() => {
    if (results.length < 2) {
      return results.length === 1;
    }
    const last = results[results.length - 1];
    const before = results[results.length - 2];
    return last.timeStamp - before.timeStamp > 30 * 60000;
  })();
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
  const learningRateInfo =
    focusedKey != null
      ? LearningRate.from(focusedKey.samples, new Target(settings))
      : null;
  const learningRate = learningRateInfo?.learningRate ?? null;

  // Only while something is actually blocked — once every key is through, the
  // target is not what is holding anybody up.
  const suggestion = useMemo(
    () =>
      focusedKey == null
        ? null
        : suggestTarget(
            lessonKeys.findIncludedKeys(),
            target,
            results.length,
            lessonProps.targetSpeed,
          ),
    [focusedKey, lessonKeys, target, results.length],
  );

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
        {hasData &&
          (warmingUp ? (
            // Cold hands. The first round after a break is reliably slower
            // than the last round of the previous sitting, so the delta beside
            // it is a comparison against a different pair of hands — and it
            // greeted every returning learner with a red number.
            <span
              className={styles.warmup}
              title={formatMessage({
                id: "practice.pulse.warmup.description",
                defaultMessage:
                  "The first round back is always slower. This one is not being compared against your last sitting.",
              })}
            >
              <FormattedMessage
                id="practice.pulse.warmup"
                defaultMessage="warm-up"
              />
            </span>
          ) : (
            <Chip delta={speed.delta} text={formatSpeed} />
          ))}

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
              {/*
                The opposite case to the tuner above, which only appears once
                the goal has been *reached*: this is for a learner stuck the
                other side of it. One slow key holds the whole alphabet, so a
                target set above what that key can manage stops the trail
                entirely — and nothing here connected "no new letters lately"
                to "your target", leaving the reasonable conclusion that they
                had stopped improving.
              */}
              {suggestion != null && (
                <button
                  type="button"
                  className={styles.suggest}
                  onClick={() =>
                    updateSettings(
                      settings.set(lessonProps.targetSpeed, suggestion.target),
                    )
                  }
                >
                  <FormattedMessage
                    id="practice.pulse.suggestTarget"
                    defaultMessage="{key} is your slowest at {speed} — try a {target} goal to get moving again"
                    values={{
                      key: suggestion.blocker.letter.label.toUpperCase(),
                      speed: formatSpeed(
                        timeToSpeed(suggestion.blocker.timeToType!),
                      ),
                      target: formatSpeed(suggestion.target),
                    }}
                  />
                </button>
              )}
            </span>
          </div>

          <div
            id={names?.currentKey}
            className={clsx(styles.road, styles.roadMicro)}
            title={formatMessage({
              id: "practice.lane.road.description",
              defaultMessage:
                "This key’s road to unlocking: the glowing dot is where you are now, the hollow ring is your best so far, the star is the unlock.",
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
                    {bottleneck != null && (
                      <span
                        className={styles.joinTag}
                        title={formatMessage({
                          id: "practice.pulse.join.description",
                          defaultMessage:
                            "Past the first weeks the drag is rarely a letter — it is the join between two of them. This round is aimed at yours.",
                        })}
                      >
                        <FormattedMessage
                          id="practice.pulse.join"
                          defaultMessage="slow join {pair}"
                          values={{
                            pair: (
                              <b>
                                {String.fromCodePoint(bottleneck.from)}
                                {String.fromCodePoint(bottleneck.to)}
                              </b>
                            ),
                          }}
                        />
                      </span>
                    )}
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
              // Finishing the alphabet used to be a trophy and a full stop.
              // It is the point at which somebody has done the hard part and
              // is most likely to keep going — and the app had capitals,
              // punctuation, numbers and code all sitting there, and mentioned
              // none of them. A finish line with nothing past it is where
              // people stop.
              <span className={styles.microNote}>
                <StrokeIcon className={styles.trophy} name="trophy" />
                <FormattedMessage
                  id="t_All_keys_are_unlocked"
                  defaultMessage="Every key is unlocked."
                />
                <NextChallenge />
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        className={clsx(styles.whisper, expanded && styles.whisperOpen)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        title={formatMessage({
          id: "practice.pulse.expand",
          defaultMessage: "Show more about this session",
        })}
        onClick={toggleExpanded}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            toggleExpanded();
          }
        }}
      >
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
              "Your last lesson’s score, in points. " +
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
        <svg className={styles.chevron} viewBox="0 0 12 12" aria-hidden={true}>
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </div>

      <div
        className={clsx(styles.session, expanded && styles.sessionOpen)}
        aria-hidden={!expanded}
      >
        <div className={styles.sessionClip}>
          <div className={styles.sessionInner}>
            <SessionRecap
              results={results}
              summaryStats={summaryStats}
              lessonKeys={lessonKeys}
              focusedKey={focusedKey}
              forecast={learningRateInfo}
              streakList={streakList}
              dailyGoal={dailyGoal}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

// Whether the session panel is left open, remembered across visits so the
// learner's choice sticks. Guarded for SSR / storage-blocked environments.
const OPEN_KEY = "keylearn.pulse.open";
function readExpanded(): boolean {
  try {
    return window.localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}
function writeExpanded(open: boolean): void {
  try {
    window.localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    // ignore — a closed session panel is a fine fallback
  }
}

/**
 * Midnight this morning, in the reader's own timezone.
 *
 * This card used to count from whenever the page module first evaluated — a
 * genuine "sitting", but one that reset on every reload, so a learner who had
 * practised for twenty minutes and refreshed was told they had done nothing.
 * Worse, it sat directly beside a goal ring counting the same day's minutes,
 * so the card contradicted itself: "0 lessons · 0 min" next to "23 of 30 min".
 *
 * Today is the honest window. It matches the ring, it matches what a learner
 * means when they ask how much they have done, and it survives a reload.
 */
function startOfToday(now: number = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * The expand-on-click panel beneath the whisper line: a calm, glanceable recap
 * that deepens the session rather than repeating the last-lesson numbers above.
 * Three cards, left to right:
 *   • This session — lessons and minutes typed this sitting, plus the session's
 *     best speed (starred when it beats the all-time record). Gives a sitting a
 *     sense of closure and accumulates small wins.
 *   • Recent form — average speed across the last lessons with an
 *     improving / steady / dip read, and average accuracy. Makes progress (or a
 *     plateau) visible so effort feels like it's compounding.
 *   • Your alphabet — keys unlocked out of the whole set, with the next key up.
 *     A visible finish line pulls the learner forward (the goal-gradient effect).
 */
function SessionRecap({
  results,
  summaryStats,
  lessonKeys,
  focusedKey,
  forecast,
  streakList,
  dailyGoal,
}: {
  readonly results: readonly Result[];
  readonly summaryStats: SummaryStats;
  readonly lessonKeys: LessonKeys;
  readonly focusedKey: LessonKey | null;
  readonly forecast: LearningRate | null;
  readonly streakList: StreakListType;
  readonly dailyGoal: DailyGoalType;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { formatPercents } = useIntlNumbers();
  const { formatSpeed, speedUnit } = useFormatter();

  const dayStart = startOfToday();
  const session = results.filter((r) => r.timeStamp >= dayStart);
  const sessionCount = session.length;
  const sessionMinutes = Math.round(
    session.reduce((sum, r) => sum + r.time, 0) / 60000,
  );
  const sessionBest = session.reduce((m, r) => Math.max(m, r.speed), 0);
  const record = summaryStats.speed.max;
  const beatRecord = sessionBest > 0 && sessionBest >= record;
  // The gap to the all-time best, in whole display units (wpm/cpm).
  const recordGap =
    !beatRecord && record > 0 && sessionBest > 0
      ? Math.max(1, Math.round(speedUnit.measure(record - sessionBest)))
      : 0;
  const recordFrac = record > 0 ? Math.min(1, sessionBest / record) : 0;

  const recent = results.slice(-20);
  const recentAvg =
    recent.length > 0
      ? recent.reduce((s, r) => s + r.speed, 0) / recent.length
      : 0;
  const recentAccuracy =
    recent.length > 0
      ? recent.reduce((s, r) => s + r.accuracy, 0) / recent.length
      : 0;
  // Fitted across the whole window rather than read off its two endpoints —
  // see `trend.ts`. "Steady" is the honest answer far more often than the old
  // rule admitted.
  const trend = speedTrend(recent.map((r) => r.speed));

  const total = lessonKeys.letters.length;
  const unlocked = lessonKeys.findIncludedKeys().length;
  const unlockedFrac = total > 0 ? unlocked / total : 0;

  // The forward hook: a forecast of how many more lessons until the current
  // key unlocks. It's the number a learner returns to watch shrink — so it's
  // only shown once the model is confident enough to name one.
  const remaining =
    forecast != null &&
    Number.isFinite(forecast.remainingLessons) &&
    forecast.remainingLessons > 0
      ? Math.round(forecast.remainingLessons)
      : null;
  const nextKey = focusedKey != null ? String(focusedKey.letter.label) : null;

  return (
    <>
      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardLab}>
            <FormattedMessage
              id="practice.session.today"
              defaultMessage="Today"
            />
          </span>
          <span className={styles.cardMain}>
            <FormattedMessage
              id="practice.session.lessonsMinutes"
              defaultMessage="{lessons} {lessons, plural, one {lesson} other {lessons}} · {minutes} min"
              values={{ lessons: sessionCount, minutes: sessionMinutes }}
            />
          </span>
          <span className={styles.cardSub}>
            {sessionBest > 0 ? (
              <>
                <FormattedMessage
                  id="practice.session.best"
                  defaultMessage="best {speed}"
                  values={{ speed: formatSpeed(sessionBest) }}
                />
                {beatRecord && <span className={styles.flourish}> ✦</span>}
              </>
            ) : (
              <FormattedMessage
                id="practice.session.warmup"
                defaultMessage="warming up…"
              />
            )}
          </span>
          <SessionMarks session={session} />
          {dailyGoal.goal > 0 && (
            <span className={styles.goalRow}>
              <GoalRing value={dailyGoal.value} />
              <span className={styles.cardSub}>
                <FormattedMessage
                  id="practice.session.goalRing"
                  defaultMessage="{done} of {goal} min"
                  values={{
                    done: Math.round(dailyGoal.value * dailyGoal.goal),
                    goal: dailyGoal.goal,
                  }}
                />
                <br />
                <FormattedMessage
                  id="practice.session.goalRingNote"
                  defaultMessage="daily goal"
                />
              </span>
            </span>
          )}
        </div>

        <div className={styles.card}>
          <span className={styles.cardLab}>
            <FormattedMessage
              id="practice.session.recentForm"
              defaultMessage="Recent form"
            />
          </span>
          <span className={styles.cardMain}>
            {recent.length > 0 ? formatSpeed(recentAvg) : "—"}
            <i className={styles.cardMainNote}>
              {" "}
              <FormattedMessage
                id="practice.session.avg"
                defaultMessage="avg"
              />
            </i>
          </span>
          <span className={styles.cardSub}>
            {recent.length >= 2 && (
              <span
                className={clsx(
                  styles.trendTag,
                  trend === "improving"
                    ? styles.trendUp
                    : trend === "dip"
                      ? styles.trendDown
                      : styles.trendFlat,
                )}
              >
                {trend === "improving" ? (
                  <FormattedMessage
                    id="practice.session.improving"
                    defaultMessage="improving"
                  />
                ) : trend === "dip" ? (
                  <FormattedMessage
                    id="practice.session.dip"
                    defaultMessage="slight dip"
                  />
                ) : (
                  <FormattedMessage
                    id="practice.session.steady"
                    defaultMessage="steady"
                  />
                )}
              </span>
            )}
            {recent.length > 0 && (
              <>
                {" · "}
                <FormattedMessage
                  id="practice.session.accuracy"
                  defaultMessage="{value} clean"
                  values={{ value: formatPercents(recentAccuracy) }}
                />
              </>
            )}
          </span>
          <SpeedSpark speeds={recent.map((r) => r.speed)} />
        </div>

        <div className={clsx(styles.card, styles.cardNext)}>
          <span className={styles.cardLab}>
            <FormattedMessage
              id="practice.session.alphabet"
              defaultMessage="Your alphabet"
            />
          </span>
          {focusedKey != null ? (
            <>
              <span className={styles.cardMain}>
                {unlocked}
                <i className={styles.cardMainNote}>
                  {" "}
                  <FormattedMessage
                    id="practice.session.ofKeys"
                    defaultMessage="of {total} keys"
                    values={{ total }}
                  />
                </i>
              </span>
              <AlphabetGrid keys={[...lessonKeys]} focused={focusedKey} />
              <span className={styles.cardSub}>
                <FormattedMessage
                  id="practice.session.nextUp"
                  defaultMessage="next up {key}"
                  values={{
                    key: <span className={styles.nextKey}>{nextKey}</span>,
                  }}
                />
                {remaining != null && (
                  <>
                    {" — "}
                    <FormattedMessage
                      id="practice.session.awayLessons"
                      defaultMessage="about {n} {n, plural, one {lesson} other {lessons}} away"
                      values={{ n: remaining }}
                    />
                  </>
                )}
              </span>
            </>
          ) : (
            <>
              <span className={styles.cardMain}>
                <FormattedMessage
                  id="practice.session.allDone"
                  defaultMessage="all {total} keys"
                  values={{ total }}
                />
              </span>
              <span className={styles.cardSub}>
                <FormattedMessage
                  id="practice.session.complete"
                  defaultMessage="every key unlocked — chase your speed now"
                />
              </span>
            </>
          )}
        </div>

        <div className={styles.card}>
          <span className={styles.cardLab}>
            <FormattedMessage
              id="practice.session.recordToBeat"
              defaultMessage="Record to beat"
            />
          </span>
          {beatRecord ? (
            <>
              <span className={styles.cardMain}>
                <FormattedMessage
                  id="practice.session.newRecord"
                  defaultMessage="new best!"
                />
                <span className={styles.flourish}> ✦</span>
              </span>
              <span className={styles.cardSub}>
                <FormattedMessage
                  id="practice.session.newRecordSub"
                  defaultMessage="you set it this session"
                />
              </span>
            </>
          ) : recordGap > 0 ? (
            <>
              <span className={styles.cardMain}>
                {recordGap}
                <i className={styles.cardMainNote}> {speedUnit.id}</i>
              </span>
              <span className={styles.cardSub}>
                <FormattedMessage
                  id="practice.session.toTopBest"
                  defaultMessage="to top your {best} best"
                  values={{ best: formatSpeed(record) }}
                />
              </span>
              <span className={styles.recordBar}>
                <i style={{ inlineSize: `${Math.round(recordFrac * 100)}%` }} />
              </span>
              <span className={styles.slowRow}>
                <SlowKeys keys={lessonKeys.findIncludedKeys()} />
                <span className={styles.cardSub}>
                  <FormattedMessage
                    id="practice.session.slowest"
                    defaultMessage="slowest keys"
                  />
                </span>
              </span>
            </>
          ) : (
            <>
              <span className={styles.cardMain}>—</span>
              <span className={styles.cardSub}>
                <FormattedMessage
                  id="practice.session.noRecordYet"
                  defaultMessage="a few lessons sets your first record"
                />
              </span>
            </>
          )}
        </div>
      </div>
    </>
  );
}

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
/**
 * Where to go once the alphabet is finished.
 *
 * One suggestion at a time, in the order that keeps the most of what was just
 * learned: capitals first (the same letters, one new motion), then
 * punctuation, then the modes that are a different sport altogether. Each is a
 * single press, because the whole failure here is a door the learner never
 * knew was there.
 */
function NextChallenge(): ReactNode {
  const { settings, updateSettings } = useSettings();
  const capitals = settings.get(lessonProps.capitals);
  const punctuators = settings.get(lessonProps.punctuators);

  if (capitals === 0) {
    return (
      <button
        type="button"
        className={styles.suggest}
        onClick={() =>
          updateSettings(settings.set(lessonProps.capitals, DEFAULT_MANGLE))
        }
      >
        <FormattedMessage
          id="practice.next.capitals"
          defaultMessage="Ready for more? Add capitals — same letters, one new motion."
        />
      </button>
    );
  }
  if (punctuators === 0) {
    return (
      <button
        type="button"
        className={styles.suggest}
        onClick={() =>
          updateSettings(settings.set(lessonProps.punctuators, DEFAULT_MANGLE))
        }
      >
        <FormattedMessage
          id="practice.next.punctuation"
          defaultMessage="Next: add punctuation, and you are typing real sentences."
        />
      </button>
    );
  }
  return (
    <button
      type="button"
      className={styles.suggest}
      onClick={() =>
        updateSettings(settings.set(lessonProps.type, LessonType.CODE))
      }
    >
      <FormattedMessage
        id="practice.next.code"
        defaultMessage="You have the whole keyboard. Try Code craft, or Numbers, for a different sport."
      />
    </button>
  );
}

/**
 * How much of the text a newly-added mangling touches.
 *
 * A fifth: enough that it turns up in every lesson, few enough that the first
 * one does not read as a punctuation drill.
 */
const DEFAULT_MANGLE = 0.2;

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
          "Today’s practice time, out of your daily goal. Only time spent actually typing counts — pauses between lessons don’t.",
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
        <FormattedMessage id="t_Daily_goal" defaultMessage="Today’s goal" />
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
