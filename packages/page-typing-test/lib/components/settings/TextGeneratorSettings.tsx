import { useSettings } from "@keybr/settings";
import { FieldSet, Para } from "@keybr/widget";
import { clsx } from "clsx";
import { FormattedMessage, useIntl } from "react-intl";
import { TextSourceType, typingTestProps } from "../../settings.ts";
import * as styles from "../settings.module.less";
import { BookSettings } from "./text/BookSettings.tsx";
import { CommonWordsSettings } from "./text/CommonWordsSettings.tsx";
import { PseudoWordsSettings } from "./text/PseudoWordsSettings.tsx";

export function TextGeneratorSettings() {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  const sources = [
    {
      type: TextSourceType.CommonWords,
      label: formatMessage({
        id: "typingTest.source.commonWords",
        defaultMessage: "Common words",
      }),
    },
    {
      type: TextSourceType.PseudoWords,
      label: formatMessage({
        id: "typingTest.source.pseudoWords",
        defaultMessage: "Pseudo words",
      }),
    },
    {
      type: TextSourceType.Book,
      label: formatMessage({
        id: "typingTest.source.book",
        defaultMessage: "Book paragraphs",
      }),
    },
  ];
  const selected = settings.get(typingTestProps.type);
  return (
    <>
      <FieldSet
        legend={formatMessage({
          id: "typingTest.settings.textLegend",
          defaultMessage: "Text settings",
        })}
      >
        <Para>
          <FormattedMessage
            id="typingTest.settings.textIntro"
            defaultMessage="Choose what text to type in the test."
          />
        </Para>
        <span className={styles.seg}>
          {sources.map(({ type, label }) => (
            <button
              key={label}
              type="button"
              className={clsx(
                styles.segItem,
                selected === type && styles.segOn,
              )}
              onClick={() => {
                updateSettings(settings.set(typingTestProps.type, type));
              }}
            >
              {label}
            </button>
          ))}
        </span>
      </FieldSet>

      {selected === TextSourceType.CommonWords && <CommonWordsSettings />}
      {selected === TextSourceType.PseudoWords && <PseudoWordsSettings />}
      {selected === TextSourceType.Book && <BookSettings />}
    </>
  );
}
