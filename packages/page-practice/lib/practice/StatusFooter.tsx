import { CurrentKey, DailyGoal, names, StreakList } from "@keybr/lesson-ui";
import { memo, type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import { type LessonState } from "./state/index.ts";
import * as styles from "./StatusFooter.module.less";

export const StatusFooter = memo(function StatusFooter({
  state: { lessonKeys, streakList, dailyGoal },
}: {
  readonly state: LessonState;
}): ReactNode {
  return (
    <div className={styles.footer}>
      <div className={styles.seg}>
        <span className={styles.label}>
          <FormattedMessage
            id="practice.learningNow"
            defaultMessage="Currently learning"
          />
        </span>
        <CurrentKey id={names.currentKey} lessonKeys={lessonKeys} />
      </div>
      <div className={styles.seg}>
        <span className={styles.label}>
          <FormattedMessage id="t_Accuracy" defaultMessage="Accuracy" />
        </span>
        <StreakList streakList={streakList} />
      </div>
      {dailyGoal.goal > 0 && (
        <div className={styles.seg}>
          <span className={styles.label}>
            <FormattedMessage id="t_Daily_goal" defaultMessage="Today's goal" />
          </span>
          <DailyGoal dailyGoal={dailyGoal} />
        </div>
      )}
    </div>
  );
});
