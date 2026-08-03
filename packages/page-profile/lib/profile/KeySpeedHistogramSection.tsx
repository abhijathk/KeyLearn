import { KeySpeedHistogram } from "@keylearn/chart";
import { type KeyStatsMap } from "@keylearn/result";
import { Explainer, Figure } from "@keylearn/widget";
import { FormattedMessage } from "react-intl";
import { ChartWrapper } from "./ChartWrapper.tsx";

export function KeySpeedHistogramSection({
  keyStatsMap,
}: {
  keyStatsMap: KeyStatsMap;
}) {
  return (
    <Figure>
      <Figure.Caption>
        <FormattedMessage
          id="profile.chart.keySpeedHistogram.caption"
          defaultMessage="Per-Key Speed Breakdown"
        />
      </Figure.Caption>

      <Explainer>
        <Figure.Description>
          <FormattedMessage
            id="profile.chart.keySpeedHistogram.description"
            defaultMessage="Shows your average typing speed key by key."
          />
        </Figure.Description>
      </Explainer>

      <ChartWrapper>
        <KeySpeedHistogram
          keyStatsMap={keyStatsMap}
          width="100%"
          height="18rem"
        />
      </ChartWrapper>
    </Figure>
  );
}
