import { KeyFrequencyHistogram, Marker } from "@keybr/chart";
import { type KeyStatsMap } from "@keybr/result";
import { Explainer, Figure } from "@keybr/widget";
import { FormattedMessage } from "react-intl";
import { ChartWrapper } from "./ChartWrapper.tsx";

export function KeyFrequencyHistogramSection({
  keyStatsMap,
}: {
  keyStatsMap: KeyStatsMap;
}) {
  return (
    <Figure>
      <Figure.Caption>
        <FormattedMessage
          id="profile.chart.keyFrequencyHistogram.caption"
          defaultMessage="Key Frequency Breakdown"
        />
      </Figure.Caption>

      <Explainer>
        <Figure.Description>
          <FormattedMessage
            id="profile.chart.keyFrequencyHistogram.description"
            defaultMessage="Shows how often each key comes up, relative to the others."
          />
        </Figure.Description>
      </Explainer>

      <ChartWrapper>
        <KeyFrequencyHistogram
          keyStatsMap={keyStatsMap}
          width="100%"
          height="28rem"
        />
      </ChartWrapper>

      <Figure.Legend>
        <FormattedMessage
          id="profile.chart.keyFrequencyHistogram.legend"
          defaultMessage="Bar color: {label1} – number of hits, {label2} – number of misses, {label3} – miss-to-hit ratio (how often you miss relative to hits)."
          values={{
            label1: <Marker type="histogram-h" />,
            label2: <Marker type="histogram-m" />,
            label3: <Marker type="histogram-r" />,
          }}
        />
      </Figure.Legend>
    </Figure>
  );
}
