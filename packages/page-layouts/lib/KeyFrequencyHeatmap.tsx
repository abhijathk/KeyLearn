import { useIntlNumbers } from "@keybr/intl";
import {
  computeStats,
  type Keyboard,
  useFormattedNames,
} from "@keybr/keyboard";
import {
  HeatmapLayer,
  KeyLayer,
  TransitionsLayer,
  VirtualKeyboard,
} from "@keybr/keyboard-ui";
import { type PhoneticModel } from "@keybr/phonetic-model";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./road.module.less";

export function KeyFrequencyHeatmap({
  keyboard,
  model,
}: {
  readonly keyboard: Keyboard;
  readonly model: PhoneticModel;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { formatPercents } = useIntlNumbers();
  const { formatLayoutName } = useFormattedNames();
  const ngram1 = model.ngram1();
  const ngram2 = model.ngram2();
  const stats = computeStats(keyboard, ngram1, ngram2);
  return (
    <>
      <div className={styles.sect}>{formatLayoutName(keyboard.layout)}</div>

      <div className={styles.strip}>
        <span
          title={formatMessage({
            id: "layouts.stats.homeRowKeys.description",
            defaultMessage:
              "How many keys are typed without moving off the Caps Lock row — higher is better.",
          })}
        >
          <span className={styles.lab}>
            <FormattedMessage
              id="layouts.road.homeRow"
              defaultMessage="Home row"
            />
          </span>
          <b>{formatPercents(stats.homeRow, 0)}</b>
        </span>
        <span
          title={formatMessage({
            id: "layouts.stats.topRowKeys.description",
            defaultMessage:
              "How many keys are typed on the Tab row — lower is better.",
          })}
        >
          <span className={styles.lab}>
            <FormattedMessage
              id="layouts.road.topRow"
              defaultMessage="Top row"
            />
          </span>
          <b>{formatPercents(stats.topRow, 0)}</b>
        </span>
        <span
          title={formatMessage({
            id: "layouts.stats.bottomRowKeys.description",
            defaultMessage:
              "How many keys are typed on the Shift row — lower is better.",
          })}
        >
          <span className={styles.lab}>
            <FormattedMessage
              id="layouts.road.bottomRow"
              defaultMessage="Bottom row"
            />
          </span>
          <b>{formatPercents(stats.bottomRow, 0)}</b>
        </span>
        <span
          title={formatMessage({
            id: "layouts.stats.sameHandKeys.description",
            defaultMessage:
              "How many keys in a row are typed with the same hand — lower is better.",
          })}
        >
          <span className={styles.lab}>
            <FormattedMessage
              id="layouts.road.sameHand"
              defaultMessage="Same hand"
            />
          </span>
          <b>{formatPercents(1 - stats.handSwitches, 0)}</b>
        </span>
        <span
          title={formatMessage({
            id: "layouts.stats.sameFingerKeys.description",
            defaultMessage:
              "How many keys in a row are typed with the same finger — lower is better.",
          })}
        >
          <span className={styles.lab}>
            <FormattedMessage
              id="layouts.road.sameFinger"
              defaultMessage="Same finger"
            />
          </span>
          <b>{formatPercents(1 - stats.fingerSwitches, 0)}</b>
        </span>
      </div>

      <div className={styles.board}>
        <VirtualKeyboard keyboard={keyboard}>
          <KeyLayer />
          <HeatmapLayer histogram={ngram1} modifier="f" />
          <TransitionsLayer histogram={ngram2} modifier="f" />
        </VirtualKeyboard>
      </div>
    </>
  );
}
