import { type SummaryStats } from "@keybr/result";
import { Tab, TabList } from "@keybr/widget";
import React, { useState } from "react";
import { useIntl } from "react-intl";
import { AccuracyHistogramSection } from "./AccuracyHistogramSection.tsx";
import { SpeedHistogramSection } from "./SpeedHistogramSection.tsx";

export function HistogramsSection({ stats }: { stats: SummaryStats }) {
  const { formatMessage } = useIntl();
  const [index, setIndex] = useState(0);
  return (
    <TabList selectedIndex={index} onSelect={setIndex}>
      <Tab
        label={formatMessage({
          id: "profile.chart.histogram.caption",
          defaultMessage: "Your Typing Speed, Compared",
        })}
      >
        <SpeedHistogramSection stats={stats} />
      </Tab>
      <Tab
        label={formatMessage({
          id: "profile.chart.histogram.accuracy.caption",
          defaultMessage: "Your Accuracy, Compared",
        })}
      >
        <AccuracyHistogramSection stats={stats} />
      </Tab>
    </TabList>
  );
}
