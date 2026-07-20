import { makeSpeedDistribution, SpeedHistogram } from "@keybr/chart";
import { useIntlNumbers } from "@keybr/intl";
import { type SummaryStats } from "@keybr/result";
import {
  Explainer,
  Field,
  FieldList,
  Figure,
  Para,
  RadioBox,
  Value,
} from "@keybr/widget";
import React, { useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { ChartWrapper } from "./ChartWrapper.tsx";

export function SpeedHistogramSection({ stats }: { stats: SummaryStats }) {
  const distribution = useMemo(() => makeSpeedDistribution(), []);
  const { formatMessage } = useIntl();
  const { formatPercents } = useIntlNumbers();
  const [period, setPeriod] = useState("average");

  const value = period === "top" ? stats.speed.max : stats.speed.avg;
  const cdf = distribution.cdf(value);

  return (
    <Figure>
      <Figure.Caption>
        <FormattedMessage
          id="profile.chart.histogram.caption"
          defaultMessage="Your Typing Speed, Compared"
        />
      </Figure.Caption>

      <Explainer>
        <Figure.Description>
          <FormattedMessage
            id="profile.chart.histogram.description"
            defaultMessage="A histogram of typing speeds across all users, with your own standing marked on it."
          />
        </Figure.Description>
      </Explainer>

      <Para align="center">
        {period === "average" ? (
          <FormattedMessage
            id="profile.chart.compareAverageSpeed.description"
            defaultMessage="Your lifetime average speed outpaces {value} of everyone else."
            values={{
              value: <Value value={value > 0 ? formatPercents(cdf) : "N/A"} />,
            }}
          />
        ) : (
          <FormattedMessage
            id="profile.chart.compareTopSpeed.description"
            defaultMessage="Your lifetime top speed outpaces {value} of everyone else."
            values={{
              value: <Value value={value > 0 ? formatPercents(cdf) : "N/A"} />,
            }}
          />
        )}
      </Para>

      <ChartWrapper>
        <SpeedHistogram
          distribution={distribution}
          thresholds={[
            period === "average"
              ? {
                  label: formatMessage({
                    id: "t_Average_speed",
                    defaultMessage: "Typical speed",
                  }),
                  value,
                }
              : {
                  label: formatMessage({
                    id: "t_Top_speed",
                    defaultMessage: "Best speed",
                  }),
                  value,
                },
          ]}
          width="100%"
          height="25rem"
        />
      </ChartWrapper>

      <FieldList>
        <Field.Filler />
        <Field>
          <RadioBox
            name="period"
            value="average"
            checked={period === "average"}
            label={formatMessage({
              id: "t_Average_speed",
              defaultMessage: "Typical speed",
            })}
            onSelect={() => {
              setPeriod("average");
            }}
          />
        </Field>
        <Field>
          <RadioBox
            name="period"
            value="top"
            checked={period === "top"}
            label={formatMessage({
              id: "t_Top_speed",
              defaultMessage: "Best speed",
            })}
            onSelect={() => {
              setPeriod("top");
            }}
          />
        </Field>
        <Field.Filler />
      </FieldList>

      <Explainer>
        <Figure.Legend>
          <FormattedMessage
            id="profile.chart.histogram.legend"
            defaultMessage="Compares your typing speed against other users. Taller bars mean more people type at that speed, and the colored vertical lines mark where you stand."
          />
        </Figure.Legend>
      </Explainer>
    </Figure>
  );
}
