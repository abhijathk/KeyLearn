import { useIntlNumbers } from "@keybr/intl";
import {
  type DailyGoal as DailyGoalType,
  LearningRate,
  type LessonKey,
  Target,
} from "@keybr/lesson";
import { Key, names, useFormatter } from "@keybr/lesson-ui";
import { type StreakList as StreakListType, timeToSpeed } from "@keybr/result";
import { useSettings } from "@keybr/settings";
import { StrokeIcon } from "@keybr/widget";
import { clsx } from "clsx";
import { type CSSProperties, memo, type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { type LessonState } from "./state/index.ts";
import * as styles from "./StatusFooter.module.less";

/**
 * The Key Lane: the footer as the bottom thread mirroring the Pulse above the
 * keyboard — the macro road up there, this key's road to unlock down here.
 * One slim row: the focused key, its latest/best readings, an unlock road with
 * "you" and "best" markers, the learning pace with a bespoke mood face, then
 * the streak and daily-goal stations.
 */
export const StatusFooter = memo(function StatusFooter({
  state: { lessonKeys, streakList, dailyGoal },
}: {
  readonly state: LessonState;
}): ReactNode {
  const focusedKey = lessonKeys.findFocusedKey();
  return (
    <div className={styles.lane}>
      <div id={names.currentKey} className={styles.now}>
        {focusedKey != null ? (
          <>
            <Key lessonKey={focusedKey} />
            <span className={styles.microLabel}>
              <FormattedMessage
                id="practice.learningNow"
                defaultMessage="Currently learning"
              />
            </span>
          </>
        ) : (
          <>
            <StrokeIcon className={styles.trophy} name="trophy" />
            <span className={styles.microLabel}>
              <FormattedMessage
                id="t_All_keys_are_unlocked"
                defaultMessage="Every key is unlocked."
              />
            </span>
          </>
        )}
      </div>
      {focusedKey != null && <KeyStations lessonKey={focusedKey} />}
      <StreakStation streakList={streakList} />
      {dailyGoal.goal > 0 && <TodayStation dailyGoal={dailyGoal} />}
    </div>
  );
});

function KeyStations({
  lessonKey,
}: {
  readonly lessonKey: LessonKey;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { formatSpeed, formatConfidence, formatLearningRate } = useFormatter();
  const { settings } = useSettings();
  const { timeToType, bestTimeToType, confidence, bestConfidence } = lessonKey;
  if (
    timeToType == null ||
    bestTimeToType == null ||
    confidence == null ||
    bestConfidence == null
  ) {
    return (
      <span className={styles.uncalibrated}>
        <FormattedMessage
          id="t_Not_calibrated_"
          defaultMessage="Not calibrated yet — keep practicing to unlock this."
        />
      </span>
    );
  }
  const learningRate =
    LearningRate.from(lessonKey.samples, new Target(settings))?.learningRate ??
    null;
  const conf = Math.min(1, Math.max(0, confidence));
  const best = Math.min(1, Math.max(0, bestConfidence));
  return (
    <>
      <Station
        label={
          <>
            <FormattedMessage id="t_Last_speed" defaultMessage="Latest speed" />
            {" · "}
            {formatConfidence(confidence)}
          </>
        }
        value={formatSpeed(timeToSpeed(timeToType))}
        title={formatMessage({
          id: "practice.lane.latest.description",
          defaultMessage:
            "How fast you typed this key most recently, and how close it is to unlocking.",
        })}
      />
      <div
        className={styles.road}
        title={formatMessage({
          id: "practice.lane.road.description",
          defaultMessage:
            "This key's road to unlocking: the glowing dot is where you are now, the hollow ring is your best so far, the star is the unlock.",
        })}
      >
        <span className={styles.roadAhead} />
        <span
          className={styles.roadDone}
          style={{ inlineSize: `${conf * 100}%` }}
        />
        <span
          className={styles.bestMark}
          style={{ insetInlineStart: `${best * 100}%` }}
        />
        <span
          className={styles.youDot}
          style={{ insetInlineStart: `${conf * 100}%` }}
        />
        <svg className={styles.unlock} viewBox="0 0 14 14" aria-hidden={true}>
          <path d="M7 1.2 8.5 5l3.9.2-3 2.5 1 3.8L7 9.3l-3.4 2.2 1-3.8-3-2.5L5.5 5Z" />
        </svg>
      </div>
      <Station
        label={
          <>
            <FormattedMessage id="t_Top_speed" defaultMessage="Best speed" />
            {" · "}
            {formatConfidence(bestConfidence)}
          </>
        }
        value={formatSpeed(timeToSpeed(bestTimeToType))}
        title={formatMessage({
          id: "practice.lane.best.description",
          defaultMessage: "The fastest you have ever typed this key.",
        })}
      />
      <div
        className={styles.station}
        title={formatMessage({
          id: "metric.learningRate.description",
          defaultMessage:
            "How your speed on this key is trending from lesson to lesson.",
        })}
      >
        <span className={styles.stationTop}>
          <span
            className={clsx(
              styles.chip,
              learningRate != null && learningRate > 0 && styles.chipUp,
              learningRate != null && learningRate < 0 && styles.chipDown,
            )}
          >
            {formatLearningRate(learningRate)}
          </span>
          <Mood rate={learningRate} />
        </span>
        <span className={styles.microLabel}>
          <FormattedMessage
            id="t_Learning_rate"
            defaultMessage="Progress rate"
          />
        </span>
      </div>
    </>
  );
}

/**
 * The mood face, drawn from scratch for KeyLearn: one round stroke-style face
 * whose mouth bends with the learning rate — gently up, up, or beaming at
 * +1/+5/+10 per lesson, and the mirror frowns going down — instead of a row
 * of repeated clipart emoticons. Flat and grey when nothing is moving.
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
  // The mouth: a quadratic curve whose bend grows with the level.
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
        level >= 2 && styles.moodStrong,
        level >= 3 && styles.moodMax,
      )}
      viewBox="0 0 20 20"
      aria-hidden={true}
    >
      <circle cx="10" cy="10" r="8.4" />
      {level >= 3 && happy ? (
        // Beaming: the eyes curve too.
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

function StreakStation({
  streakList,
}: {
  readonly streakList: StreakListType;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { formatPercents } = useIntlNumbers();
  let best: { level: number; length: number } | null = null;
  for (const { level, results } of streakList) {
    if (results.length > 0 && (best == null || level > best.level)) {
      best = { level, length: results.length };
    }
  }
  const title = formatMessage({
    id: "practice.lane.streak.description",
    defaultMessage:
      "Your longest run of lessons typed at high accuracy, and the next milestone.",
  });
  if (best == null) {
    return (
      <div className={styles.station} title={title}>
        <span className={styles.stationTop}>
          <Flame quiet={true} />
          <span className={styles.stationValue}>—</span>
        </span>
        <span className={styles.microLabel}>
          <FormattedMessage
            id="streakList.noStreaks"
            defaultMessage="No streaks yet."
          />
        </span>
      </div>
    );
  }
  const next = milestones.find((m) => m > best.length) ?? best.length;
  const prev = [0, ...milestones].filter((m) => m <= best.length).pop() ?? 0;
  const frac = next > prev ? (best.length - prev) / (next - prev) : 1;
  return (
    <div className={styles.station} title={title}>
      <span className={styles.stationTop}>
        <Flame quiet={false} />
        <span className={styles.stationValue}>{best.length}</span>
        <span className={styles.bar}>
          <i
            style={
              { inlineSize: `${Math.round(frac * 100)}%` } as CSSProperties
            }
          />
        </span>
      </span>
      <span className={styles.microLabel}>
        <FormattedMessage
          id="streakList.milestone"
          defaultMessage="{level}+ · next goal {next}"
          values={{ level: formatPercents(best.level), next }}
        />
      </span>
    </div>
  );
}

function Flame({ quiet }: { readonly quiet: boolean }): ReactNode {
  return (
    <svg
      className={clsx(styles.flame, quiet && styles.flameQuiet)}
      viewBox="0 0 24 24"
      aria-hidden={true}
    >
      <path d="M12 3.5c.6 2.8-1.3 4.6-2.5 6.2-1.2 1.6-2 3.2-2 5a6.5 6.5 0 0 0 13 0c0-1.4-.4-2.7-1.1-3.8-.9 1.1-2 1.4-2.9.9.9-2.4.1-5.8-4.5-8.3z" />
    </svg>
  );
}

function TodayStation({
  dailyGoal,
}: {
  readonly dailyGoal: DailyGoalType;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { formatPercents } = useIntlNumbers();
  const { value, goal } = dailyGoal;
  const done = value >= 1;
  const pct = Math.max(0, Math.min(1, value));
  const minutesDone = Math.round(value * goal);
  return (
    <div
      className={styles.station}
      title={formatMessage({
        id: "practice.lane.today.description",
        defaultMessage: "Today's practice time, out of your daily goal.",
      })}
    >
      <span className={styles.stationTop}>
        <span
          className={clsx(styles.ring, done && styles.ringDone)}
          style={{ "--p": `${Math.round(pct * 100)}%` } as CSSProperties}
        >
          {done ? (
            <svg viewBox="0 0 24 24" className={styles.check}>
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          ) : (
            <span className={styles.ringLabel}>{formatPercents(value, 0)}</span>
          )}
        </span>
        <span className={styles.stationValue}>
          <FormattedMessage
            id="practice.lane.todayMinutes"
            defaultMessage="{done}/{goal}min"
            values={{ done: minutesDone, goal }}
          />
        </span>
      </span>
      <span className={styles.microLabel}>
        <FormattedMessage id="t_Daily_goal" defaultMessage="Today's goal" />
      </span>
    </div>
  );
}

function Station({
  label,
  value,
  title,
}: {
  readonly label: ReactNode;
  readonly value: string;
  readonly title: string;
}): ReactNode {
  return (
    <div className={styles.station} title={title}>
      <span className={styles.stationValue}>{value}</span>
      <span className={styles.microLabel}>{label}</span>
    </div>
  );
}
