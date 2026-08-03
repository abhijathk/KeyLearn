import { Calendar, EffortLegend, useEffort } from "@keylearn/lesson-ui";
import { type DailyStatsMap } from "@keylearn/result";
import { Explainer, Figure } from "@keylearn/widget";
import { FormattedMessage } from "react-intl";

export function CalendarSection({
  dailyStatsMap,
}: {
  dailyStatsMap: DailyStatsMap;
}) {
  const effort = useEffort();

  return (
    <Figure>
      <Figure.Caption>
        <FormattedMessage
          id="profile.chart.calendar.caption"
          defaultMessage="Your Practice Calendar"
        />
      </Figure.Caption>

      <Explainer>
        <Figure.Description>
          <FormattedMessage
            id="profile.chart.calendar.description"
            defaultMessage="Marks every day you’ve spent practicing."
          />
        </Figure.Description>
      </Explainer>

      <Calendar dailyStatsMap={dailyStatsMap} effort={effort} />

      <Figure.Legend>
        <EffortLegend effort={effort} />
      </Figure.Legend>
    </Figure>
  );
}
