import { AccuracyHistogram, makeAccuracyDistribution } from "@keybr/chart";
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

export function AccuracyHistogramSection({ stats }: { stats: SummaryStats }) {
  const distribution = useMemo(() => makeAccuracyDistribution(), []);
  const { formatMessage } = useIntl();
  const { formatPercents } = useIntlNumbers();
  const [period, setPeriod] = useState("average");

  const value = period === "top" ? stats.accuracy.max : stats.accuracy.avg;
  const cdf = distribution.cdf(distribution.scale(value));

  return (
    <Figure>
      <Figure.Caption>
        <FormattedMessage
          id="profile.chart.histogram.accuracy.caption"
          defaultMessage="Your Accuracy, Compared"
        />
      </Figure.Caption>

      <Explainer>
        <Figure.Description>
          <FormattedMessage
            id="profile.chart.histogram.accuracy.description"
            defaultMessage="A histogram of accuracy across all users, with your own standing marked on it."
          />
        </Figure.Description>
      </Explainer>

      <Para align="center">
        {period === "average" ? (
          <FormattedMessage
            id="profile.chart.compareAverageAccuracy.description"
            defaultMessage="Your lifetime average accuracy outpaces {value} of everyone else."
            values={{
              value: <Value value={value > 0 ? formatPercents(cdf) : "N/A"} />,
            }}
          />
        ) : (
          <FormattedMessage
            id="profile.chart.compareTopAccuracy.description"
            defaultMessage="Your lifetime top accuracy outpaces {value} of everyone else."
            values={{
              value: <Value value={value > 0 ? formatPercents(cdf) : "N/A"} />,
            }}
          />
        )}
      </Para>

      <ChartWrapper>
        <AccuracyHistogram
          distribution={distribution}
          thresholds={[
            period === "average"
              ? {
                  label: formatMessage({
                    id: "t_Average_accuracy",
                    defaultMessage: "Typical accuracy",
                  }),
                  value,
                }
              : {
                  label: formatMessage({
                    id: "t_Top_accuracy",
                    defaultMessage: "Best accuracy",
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
              id: "t_Average_accuracy",
              defaultMessage: "Typical accuracy",
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
              id: "t_Top_accuracy",
              defaultMessage: "Best accuracy",
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
            id="profile.chart.histogram.accuracy.legend"
            defaultMessage="Compares your accuracy against other users. Taller bars mean more people type at that accuracy, and the colored vertical lines mark where you stand."
          />
        </Figure.Legend>
      </Explainer>
    </Figure>
  );
}
