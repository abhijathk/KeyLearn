import { KeyFrequencyHeatmap, Marker } from "@keybr/chart";
import { useKeyboard } from "@keybr/keyboard";
import { type KeyStatsMap } from "@keybr/result";
import { Explainer, Figure } from "@keybr/widget";
import { FormattedMessage } from "react-intl";

export function KeyFrequencyHeatmapSection({
  keyStatsMap,
}: {
  keyStatsMap: KeyStatsMap;
}) {
  const keyboard = useKeyboard();
  return (
    <Figure>
      <Figure.Caption>
        <FormattedMessage
          id="profile.chart.keyFrequencyHeatmap.caption"
          defaultMessage="Key Frequency Map"
        />
      </Figure.Caption>

      <Explainer>
        <Figure.Description>
          <FormattedMessage
            id="profile.chart.keyFrequencyHeatmap.description"
            defaultMessage="Displays how often each key is used as a heatmap over your keyboard."
          />
        </Figure.Description>
      </Explainer>

      <KeyFrequencyHeatmap keyStatsMap={keyStatsMap} keyboard={keyboard} />

      <Figure.Legend>
        <FormattedMessage
          id="profile.chart.keyFrequencyHeatmap.legend"
          defaultMessage="Circle color: {label1} – number of hits, {label2} – number of misses."
          values={{
            label1: <Marker type="histogram-h" />,
            label2: <Marker type="histogram-m" />,
          }}
        />
      </Figure.Legend>
    </Figure>
  );
}
