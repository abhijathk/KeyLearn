import { useIntlNumbers } from "@keylearn/intl";
import { useFormatter } from "@keylearn/lesson-ui";
import { type SummaryStats } from "@keylearn/result";
import { formatDuration, Header, Para } from "@keylearn/widget";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./Summary.module.less";

export function AllTimeSummary({
  stats: { count, time, speed, accuracy },
}: {
  stats: SummaryStats;
}) {
  const { formatMessage } = useIntl();
  const { formatNumber, formatPercents } = useIntlNumbers();
  const { formatSpeed } = useFormatter();

  return (
    <>
      <Header level={2}>
        <FormattedMessage
          id="t_All_Time_Statistics"
          defaultMessage="Lifetime Stats"
        />
      </Header>

      <Para className={styles.statisticList}>
        <Statistic
          name={formatMessage({
            id: "t_Time",
            defaultMessage: "Time spent",
          })}
          value={formatDuration(time)}
        />

        <Statistic
          name={formatMessage({
            id: "t_num_Lessons",
            defaultMessage: "Lessons done",
          })}
          value={formatNumber(count)}
        />

        <Statistic
          name={formatMessage({
            id: "t_Top_speed",
            defaultMessage: "Best speed",
          })}
          value={speed.max > 0 ? formatSpeed(speed.max) : "N/A"}
        />

        <Statistic
          name={formatMessage({
            id: "t_Average_speed",
            defaultMessage: "Typical speed",
          })}
          value={speed.avg > 0 ? formatSpeed(speed.avg) : "N/A"}
        />

        <Statistic
          name={formatMessage({
            id: "t_Top_accuracy",
            defaultMessage: "Best accuracy",
          })}
          value={accuracy.max > 0 ? formatPercents(accuracy.max) : "N/A"}
        />

        <Statistic
          name={formatMessage({
            id: "t_Average_accuracy",
            defaultMessage: "Typical accuracy",
          })}
          value={accuracy.avg > 0 ? formatPercents(accuracy.avg) : "N/A"}
        />
      </Para>
    </>
  );
}

export function TodaySummary({
  stats: { count, time, speed, accuracy },
}: {
  stats: SummaryStats;
}) {
  const { formatMessage } = useIntl();
  const { formatNumber, formatPercents } = useIntlNumbers();
  const { formatSpeed } = useFormatter();

  return (
    <>
      <Header level={2}>
        <FormattedMessage
          id="t_Statistics_for_Today"
          defaultMessage="Today’s Stats"
        />
      </Header>

      <Para className={styles.statisticList}>
        <Statistic
          name={formatMessage({
            id: "t_Time",
            defaultMessage: "Time spent",
          })}
          value={formatDuration(time)}
        />

        <Statistic
          name={formatMessage({
            id: "t_num_Lessons",
            defaultMessage: "Lessons done",
          })}
          value={formatNumber(count)}
        />

        <Statistic
          name={formatMessage({
            id: "t_Top_speed",
            defaultMessage: "Best speed",
          })}
          value={speed.max > 0 ? formatSpeed(speed.max) : "N/A"}
        />

        <Statistic
          name={formatMessage({
            id: "t_Average_speed",
            defaultMessage: "Typical speed",
          })}
          value={speed.avg > 0 ? formatSpeed(speed.avg) : "N/A"}
        />

        <Statistic
          name={formatMessage({
            id: "t_Top_accuracy",
            defaultMessage: "Best accuracy",
          })}
          value={accuracy.max > 0 ? formatPercents(accuracy.max) : "N/A"}
        />

        <Statistic
          name={formatMessage({
            id: "t_Average_accuracy",
            defaultMessage: "Typical accuracy",
          })}
          value={accuracy.avg > 0 ? formatPercents(accuracy.avg) : "N/A"}
        />
      </Para>
    </>
  );
}

function Statistic({ name, value }: { name: unknown; value: unknown }) {
  return (
    <span className={styles.statisticListItem}>
      <span className={styles.itemName}>{String(name) + ":"}</span>
      <span className={styles.itemValue}>{String(value)}</span>
    </span>
  );
}
