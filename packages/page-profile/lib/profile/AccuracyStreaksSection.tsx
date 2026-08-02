import { useIntlDates, useIntlNumbers } from "@keybr/intl";
import { useFormatter } from "@keybr/lesson-ui";
import {
  makeSummaryStats,
  MutableStreakList,
  type Result,
  type Streak,
} from "@keybr/result";
import { Explainer, Figure, NameValue, Para } from "@keybr/widget";
import { FormattedMessage, useIntl } from "react-intl";

export function AccuracyStreaksSection({
  results,
}: {
  results: readonly Result[];
}) {
  const streaks = MutableStreakList.findLongest(results);

  return (
    <Figure>
      <Figure.Caption>
        <FormattedMessage
          id="profile.accuracy.header"
          defaultMessage="Your Accuracy Streaks"
        />
      </Figure.Caption>

      {streaks.length > 0 ? (
        <dl>
          {streaks.map((streak, index) => (
            <StreakDetails key={index} streak={streak} />
          ))}
        </dl>
      ) : (
        <Para align="center">
          <FormattedMessage
            id="profile.accuracy.noData"
            defaultMessage="No accuracy streaks yet. Try finishing a lesson at your highest possible accuracy, no matter how fast you type."
          />
        </Para>
      )}

      <Explainer>
        <Figure.Description>
          <FormattedMessage
            id="profile.accuracy.legend"
            defaultMessage="Listed above are your longest unbroken runs of lessons that kept accuracy above a chosen minimum, along with the stats for each run. Longer runs are better."
          />
        </Figure.Description>
      </Explainer>
    </Figure>
  );
}

function StreakDetails({ streak }: { streak: Streak }) {
  const { formatMessage } = useIntl();
  const { formatDateTime } = useIntlDates();
  const { formatNumber, formatPercents } = useIntlNumbers();
  const { formatSpeed } = useFormatter();
  const { level, results } = streak;
  const characterCount = results.reduce((x, { length }) => length + x, 0);
  const stats = makeSummaryStats(results);

  return (
    <>
      <dt>
        <NameValue
          name={formatMessage({
            id: "t_Accuracy_threshold",
            defaultMessage: "Minimum accuracy",
          })}
          value={formatPercents(level)}
        />
      </dt>
      <dd>
        <NameValue
          name={formatMessage({
            id: "t_num_Lessons",
            defaultMessage: "Lessons done",
          })}
          value={formatNumber(results.length)}
        />
        <NameValue
          name={formatMessage({
            id: "t_num_Characters",
            defaultMessage: "Characters",
          })}
          value={formatNumber(characterCount)}
        />
        <NameValue
          name={formatMessage({
            id: "t_Top_speed",
            defaultMessage: "Best speed",
          })}
          value={formatSpeed(stats.speed.max)}
        />
        <NameValue
          name={formatMessage({
            id: "t_Average_speed",
            defaultMessage: "Typical speed",
          })}
          value={formatSpeed(stats.speed.avg)}
        />
        <NameValue
          name={formatMessage({
            id: "t_Start_date",
            defaultMessage: "Streak started",
          })}
          value={formatDateTime(results[0].timeStamp, "short")}
        />
      </dd>
    </>
  );
}
