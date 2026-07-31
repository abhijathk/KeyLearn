import { useIntlDisplayNames } from "@keybr/intl";
import { Language } from "@keybr/keyboard";
import { Alphabet, Filter, type PhoneticModel } from "@keybr/phonetic-model";
import { PhoneticModelLoader } from "@keybr/phonetic-model-loader";
import { useSettings } from "@keybr/settings";
import {
  OptionList,
  Para,
  RowSeparator,
  SettingRow,
  SettingsCard,
} from "@keybr/widget";
import { FormattedMessage } from "react-intl";
import { typingTestProps } from "../../../settings.ts";

export function PseudoWordsSettings() {
  const { settings } = useSettings();
  return (
    <PhoneticModelLoader language={settings.get(typingTestProps.language)}>
      {(model) => <Content model={model} />}
    </PhoneticModelLoader>
  );
}

function Content({ model }: { model: PhoneticModel }) {
  const { settings, updateSettings } = useSettings();
  const { formatLanguageName } = useIntlDisplayNames();
  const words = [];
  for (let i = 0; i < 50; i++) {
    words.push(model.nextWord(Filter.empty));
  }
  return (
    <SettingsCard
      caption={
        <FormattedMessage
          id="typingTest.source.pseudoWords"
          defaultMessage="Pseudo words"
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
            id="typingTest.pseudoWords.language.short"
            defaultMessage="Whose phonetic rules the invented words should follow."
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
            id="typingTest.pseudoWords.alphabet.label"
            defaultMessage="Alphabet"
          />
        }
        description={
          <FormattedMessage
            id="typingTest.pseudoWords.alphabet.short"
            defaultMessage="The letters these words are built from."
          />
        }
      >
        <Alphabet model={model} />
      </SettingRow>

      <RowSeparator />

      <SettingRow
        label={
          <FormattedMessage
            id="typingTest.pseudoWords.example.label"
            defaultMessage="For example"
          />
        }
        description={
          <FormattedMessage
            id="typingTest.pseudoWords.example.short"
            defaultMessage="Nothing you can guess ahead — every word has to be read."
          />
        }
      >
        <span />
      </SettingRow>
      <Para>
        <em>{words.join(" ")}</em>
      </Para>
    </SettingsCard>
  );
}
