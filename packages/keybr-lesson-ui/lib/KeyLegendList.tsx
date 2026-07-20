import { FormattedMessage } from "react-intl";
import { KeyLegend } from "./KeyLegend.tsx";

export const KeyLegendList = () => {
  return (
    <ul>
      <li>
        <KeyLegend //
          isIncluded={true}
          confidence={null}
          isFocused={false}
          isForced={false}
        />{" "}
        <FormattedMessage
          id="lesson.indicator.notCalibrated"
          defaultMessage="An uncalibrated key with an unknown confidence score — you haven't pressed it yet."
        />
      </li>
      <li>
        <KeyLegend //
          isIncluded={true}
          confidence={0}
          isFocused={false}
          isForced={false}
        />{" "}
        <FormattedMessage
          id="lesson.indicator.leastConfidence"
          defaultMessage="A calibrated key sitting at the lowest confidence level. Keep pressing it and the score sharpens over time."
        />
      </li>
      <li>
        <KeyLegend //
          isIncluded={true}
          confidence={1}
          isFocused={false}
          isForced={false}
        />{" "}
        <FormattedMessage
          id="lesson.indicator.mostConfidence"
          defaultMessage="A calibrated key at the highest confidence level. The more you press it, the more precise this score gets."
        />
      </li>
      <li>
        <KeyLegend //
          isIncluded={true}
          confidence={0.3}
          isFocused={true}
          isForced={false}
        />{" "}
        <FormattedMessage
          id="lesson.indicator.focused"
          defaultMessage="A key that shows up more often. It's the one slowing you down most, so the algorithm works it into every generated word."
        />
      </li>
      <li>
        <KeyLegend //
          isIncluded={true}
          confidence={null}
          isFocused={false}
          isForced={true}
        />{" "}
        <FormattedMessage
          id="lesson.indicator.forced"
          defaultMessage="A key you added to your lessons by hand."
        />
      </li>
      <li>
        <KeyLegend //
          isIncluded={false}
          confidence={null}
          isFocused={false}
          isForced={false}
        />{" "}
        <FormattedMessage
          id="lesson.indicator.notIncluded"
          defaultMessage="A key that hasn't been added to your lessons yet."
        />
      </li>
    </ul>
  );
};
