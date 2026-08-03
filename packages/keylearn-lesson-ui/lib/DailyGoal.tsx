import { useIntlNumbers } from "@keylearn/intl";
import { type DailyGoal as DailyGoalType } from "@keylearn/lesson";
import { type ClassName } from "@keylearn/widget";
import { clsx } from "clsx";
import { type CSSProperties } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./DailyGoal.module.less";

export const DailyGoal = ({
  id,
  className,
  dailyGoal,
}: {
  id?: string;
  className?: ClassName;
  dailyGoal: DailyGoalType;
}) => {
  const { formatPercents } = useIntlNumbers();
  const { value, goal } = dailyGoal;
  const done = value >= 1;
  const pct = Math.max(0, Math.min(1, value));
  const minutesDone = Math.round(value * goal);
  return (
    <span id={id} className={clsx(styles.root, className)}>
      <span
        className={clsx(styles.ring, done && styles.ringDone)}
        style={{ "--p": `${Math.round(pct * 100)}%` } as CSSProperties}
      >
        <span className={styles.ringLabel}>
          {done ? (
            <svg viewBox="0 0 24 24" className={styles.check}>
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          ) : (
            formatPercents(value, 0)
          )}
        </span>
      </span>
      <span className={styles.text}>
        {done ? (
          <FormattedMessage
            id="dailyGoal.done"
            defaultMessage="Complete · {done} of {goal} min"
            values={{ done: minutesDone, goal }}
          />
        ) : (
          <FormattedMessage
            id="dailyGoal.progress"
            defaultMessage="{done} of {goal} min so far"
            values={{ done: minutesDone, goal }}
          />
        )}
      </span>
    </span>
  );
};
