import { useIntlNumbers } from "@keybr/intl";
import { type StreakList as StreakListType } from "@keybr/result";
import { type ClassName } from "@keybr/widget";
import { clsx } from "clsx";
import { type CSSProperties } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./StreakList.module.less";

const milestones = [5, 10, 25, 50, 100, 250];

export const StreakList = ({
  id,
  className,
  streakList,
}: {
  id?: string;
  className?: ClassName;
  streakList: StreakListType;
}) => {
  const { formatPercents } = useIntlNumbers();
  // The strongest current streak: the highest accuracy level that has a run.
  let best: { level: number; length: number } | null = null;
  for (const { level, results } of streakList) {
    if (results.length > 0 && (best == null || level > best.level)) {
      best = { level, length: results.length };
    }
  }
  if (best == null) {
    return (
      <span id={id} className={clsx(styles.root, className)}>
        <span className={styles.empty}>
          <FormattedMessage
            id="streakList.noStreaks"
            defaultMessage="No streaks yet."
          />
        </span>
      </span>
    );
  }
  const next = milestones.find((m) => m > best.length) ?? best.length;
  const prev = [0, ...milestones].filter((m) => m <= best.length).pop() ?? 0;
  const frac = next > prev ? (best.length - prev) / (next - prev) : 1;
  return (
    <span id={id} className={clsx(styles.root, className)}>
      <span className={styles.num}>{best.length}</span>
      <span className={styles.bar}>
        <i style={{ inlineSize: `${Math.round(frac * 100)}%` } as CSSProperties} />
      </span>
      <span className={styles.caption}>
        <FormattedMessage
          id="streakList.milestone"
          defaultMessage="{level}+ · next goal {next}"
          values={{ level: formatPercents(best.level), next }}
        />
      </span>
    </span>
  );
};
