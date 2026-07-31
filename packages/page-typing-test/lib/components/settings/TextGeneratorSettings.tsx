import { useSettings } from "@keybr/settings";
import { SettingTiles } from "@keybr/widget";
import { useIntl } from "react-intl";
import { TextSourceType, typingTestProps } from "../../settings.ts";
import { BookSettings } from "./text/BookSettings.tsx";
import { CommonWordsSettings } from "./text/CommonWordsSettings.tsx";
import { PseudoWordsSettings } from "./text/PseudoWordsSettings.tsx";

export function TextGeneratorSettings() {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  // Three genuinely different kinds of text, each needing a sentence — the same
  // reasoning as the practice modes, so the same tiles.
  const sources = [
    {
      id: TextSourceType.CommonWords,
      label: formatMessage({
        id: "typingTest.source.commonWords",
        defaultMessage: "Common words",
      }),
      description: formatMessage({
        id: "typingTest.source.commonWords.summary",
        defaultMessage: "The words you meet most often, in random order.",
      }),
    },
    {
      id: TextSourceType.PseudoWords,
      label: formatMessage({
        id: "typingTest.source.pseudoWords",
        defaultMessage: "Pseudo words",
      }),
      description: formatMessage({
        id: "typingTest.source.pseudoWords.summary",
        defaultMessage:
          "Invented words that follow your language's patterns — no guessing ahead.",
      }),
    },
    {
      id: TextSourceType.Book,
      label: formatMessage({
        id: "typingTest.source.book",
        defaultMessage: "Book paragraphs",
      }),
      description: formatMessage({
        id: "typingTest.source.book.summary",
        defaultMessage: "Real prose, with its punctuation and capitals.",
      }),
    },
  ];
  const selected = settings.get(typingTestProps.type);
  return (
    <>
      <SettingTiles
        value={selected}
        onChange={(type) => {
          updateSettings(settings.set(typingTestProps.type, type));
        }}
        options={sources}
      />

      {selected === TextSourceType.CommonWords && <CommonWordsSettings />}
      {selected === TextSourceType.PseudoWords && <PseudoWordsSettings />}
      {selected === TextSourceType.Book && <BookSettings />}
    </>
  );
}
