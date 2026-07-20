import { Marker, ProgressOverviewChart } from "@keybr/chart";
import { type KeyStatsMap } from "@keybr/result";
import { Explainer, Figure } from "@keybr/widget";
import { FormattedMessage } from "react-intl";
import { ChartWrapper } from "./ChartWrapper.tsx";

export function ProgressOverviewSection({
  keyStatsMap,
}: {
  keyStatsMap: KeyStatsMap;
}) {
  return (
    <Figure>
      <Figure.Caption>
        <FormattedMessage
          id="profile.chart.progressOverview.caption"
          defaultMessage="Overall Learning Progress"
        />
      </Figure.Caption>

      <Explainer>
        <Figure.Description>
          <FormattedMessage
            id="profile.chart.progressOverview.description"
            defaultMessage="Gives you a bird's-eye view of your learning progress across every key."
          />
        </Figure.Description>
      </Explainer>

      <ChartWrapper>
        <ProgressOverviewChart
          keyStatsMap={keyStatsMap}
          width="100%"
          height="35rem"
        />
      </ChartWrapper>

      <Figure.Legend>
        <FormattedMessage
          id="profile.chart.progressOverview.legend"
          defaultMessage="X-axis: lesson number. Y-axis: typing speed per key, from {label1} slow to {label2} fast."
          values={{
            label1: <Marker type="slow" />,
            label2: <Marker type="fast" />,
          }}
        />
      </Figure.Legend>
    </Figure>
  );
}
