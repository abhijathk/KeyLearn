import { useIntlNumbers } from "@keylearn/intl";
import { type LearningRate, type LessonKey } from "@keylearn/lesson";
import { Name, Para, Value } from "@keylearn/widget";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";

export function LearningRateDescription({
  lessonKey,
  learningRate,
}: {
  readonly lessonKey: LessonKey;
  readonly learningRate: LearningRate | null;
}): ReactNode {
  const { formatNumber, formatPercents } = useIntlNumbers();
  if ((lessonKey.bestConfidence ?? 0) >= 1) {
    return (
      <Para align="center">
        <Name>
          <FormattedMessage
            id="learningRate.alreadyUnlocked"
            defaultMessage="You’ve already unlocked this letter."
          />
        </Name>
      </Para>
    );
  }
  if (
    learningRate != null &&
    learningRate.remainingLessons > 0 &&
    learningRate.certainty > 0
  ) {
    return (
      <Para align="center">
        <Name>
          <FormattedMessage
            id="learningRate.remainingLessons"
            defaultMessage={
              "Roughly {remainingLessons} more lessons until the next " +
              "letter unlocks ({certainty} confidence)."
            }
            values={{
              remainingLessons: (
                <Value value={formatNumber(learningRate.remainingLessons)} />
              ),
              certainty: (
                <Value value={formatPercents(learningRate.certainty)} />
              ),
            }}
          />
        </Name>
      </Para>
    );
  }
  return (
    <Para align="center">
      <Name>
        <FormattedMessage
          id="learningRate.unknown"
          defaultMessage="Not enough data yet to estimate how many lessons remain to unlock this letter."
        />
      </Name>
    </Para>
  );
}
