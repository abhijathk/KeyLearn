import { useIntlNumbers } from "@keylearn/intl";
import { type KeyboardStats } from "@keylearn/keyboard";
import { Value } from "@keylearn/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function KeyboardStats({
  stats: { homeRow, topRow, bottomRow, handSwitches, fingerSwitches },
}: {
  readonly stats: KeyboardStats;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { formatPercents } = useIntlNumbers();
  return (
    <ul>
      <li
        title={formatMessage({
          id: "layouts.stats.homeRowKeys.description",
          defaultMessage:
            "How many keys are typed without moving off the Caps Lock row — higher is better.",
        })}
      >
        <FormattedMessage
          id="layouts.stats.homeRowKeys.name"
          defaultMessage="Share of keys on the home row:"
        />{" "}
        <Value value={formatPercents(homeRow, 0)} />
      </li>
      <li
        title={formatMessage({
          id: "layouts.stats.topRowKeys.description",
          defaultMessage:
            "How many keys are typed on the Tab row — lower is better.",
        })}
      >
        <FormattedMessage
          id="layouts.stats.topRowKeys.name"
          defaultMessage="Share of keys on the top row:"
        />{" "}
        <Value value={formatPercents(topRow, 0)} />
      </li>
      <li
        title={formatMessage({
          id: "layouts.stats.bottomRowKeys.description",
          defaultMessage:
            "How many keys are typed on the Shift row — lower is better.",
        })}
      >
        <FormattedMessage
          id="layouts.stats.bottomRowKeys.name"
          defaultMessage="Share of keys on the bottom row:"
        />{" "}
        <Value value={formatPercents(bottomRow, 0)} />
      </li>
      <li
        title={formatMessage({
          id: "layouts.stats.sameHandKeys.description",
          defaultMessage:
            "How many keys in a row are typed with the same hand — lower is better.",
        })}
      >
        <FormattedMessage
          id="layouts.stats.sameHandKeys.name"
          defaultMessage="Share of keys typed by the same hand:"
        />{" "}
        <Value value={formatPercents(1 - handSwitches, 0)} />
      </li>
      <li
        title={formatMessage({
          id: "layouts.stats.sameFingerKeys.description",
          defaultMessage:
            "How many keys in a row are typed with the same finger — lower is better.",
        })}
      >
        <FormattedMessage
          id="layouts.stats.sameFingerKeys.name"
          defaultMessage="Share of keys typed by the same finger:"
        />{" "}
        <Value value={formatPercents(1 - fingerSwitches, 0)} />
      </li>
    </ul>
  );
}
