import { type WordList, wordListStats } from "@keylearn/content";
import { WordListLoader } from "@keylearn/content-words";
import { useIntlDisplayNames, useIntlNumbers } from "@keylearn/intl";
import { Language } from "@keylearn/keyboard";
import { useSettings } from "@keylearn/settings";
import {
  OptionList,
  Para,
  Range,
  RowSeparator,
  SettingRow,
  SettingsCard,
  TextField,
} from "@keylearn/widget";
import { FormattedMessage, useIntl } from "react-intl";
import { typingTestProps } from "../../../settings.ts";

export function CommonWordsSettings() {
  const { settings } = useSettings();
  return (
    <WordListLoader language={settings.get(typingTestProps.language)}>
      {(wordList) => (
        <Content
          wordList={wordList.slice(
            0,
            settings.get(typingTestProps.wordList.wordListSize),
          )}
        />
      )}
    </WordListLoader>
  );
}

function Content({ wordList }: { wordList: WordList }) {
  const { settings, updateSettings } = useSettings();
  const { formatMessage } = useIntl();
  const { formatLanguageName } = useIntlDisplayNames();
  const { formatNumber } = useIntlNumbers();
  const { wordCount, avgWordLength } = wordListStats(wordList);
  return (
    <SettingsCard
      caption={
        <FormattedMessage
          id="typingTest.source.commonWords"
          defaultMessage="Common words"
        />
      }
    >
      <SettingRow
        label={
          <FormattedMessage
            id="settings.language.label"
            defaultMessage="Language"
          />
        }
        description={
          <FormattedMessage
            id="typingTest.wordList.language.short"
            defaultMessage="Which language’s most-used words to draw from."
          />
        }
      >
        <OptionList
          options={Language.ALL.map((item) => ({
            value: item.id,
            name: formatLanguageName(item.id),
          }))}
          value={String(settings.get(typingTestProps.language))}
          onSelect={(id) => {
            updateSettings(
              settings.set(typingTestProps.language, Language.ALL.get(id)),
            );
          }}
        />
      </SettingRow>

      <RowSeparator />

      <SettingRow
        label={
          <FormattedMessage
            id="typingTest.wordList.size.label"
            defaultMessage="Size of the word list"
          />
        }
        description={
          <FormattedMessage
            id="typingTest.wordList.size.short"
            defaultMessage="A shorter list repeats sooner; a longer one is more varied."
          />
        }
        value={formatNumber(
          settings.get(typingTestProps.wordList.wordListSize),
        )}
      >
        <Range
          size={10}
          min={typingTestProps.wordList.wordListSize.min}
          max={typingTestProps.wordList.wordListSize.max}
          step={1}
          value={settings.get(typingTestProps.wordList.wordListSize)}
          onChange={(value) => {
            updateSettings(
              settings.set(typingTestProps.wordList.wordListSize, value),
            );
          }}
        />
      </SettingRow>

      <RowSeparator />

      <SettingRow
        label={
          <FormattedMessage
            id="typingTest.wordList.preview.label"
            defaultMessage="The words themselves"
          />
        }
        description={
          <FormattedMessage
            id="typingTest.wordList.preview.short"
            defaultMessage="{words} distinct words, {length} letters long on average."
            values={{
              words: formatNumber(wordCount),
              length: formatNumber(avgWordLength, 2),
            }}
          />
        }
      >
        <span />
      </SettingRow>
      <Para>
        <TextField
          type="textarea"
          value={wordList.join(", ")}
          readOnly={true}
        />
      </Para>
    </SettingsCard>
  );
}
