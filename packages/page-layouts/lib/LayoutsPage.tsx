import {
  Language,
  Layout,
  loadKeyboard,
  useFormattedNames,
} from "@keybr/keyboard";
import { Alphabet } from "@keybr/phonetic-model";
import { PhoneticModelLoader } from "@keybr/phonetic-model-loader";
import { Article, Field, FieldList, OptionList } from "@keybr/widget";
import { useState } from "react";
import { FormattedMessage } from "react-intl";
import { CustomLayoutDesignerToggler } from "./custom/CustomLayoutDesignerToggler.tsx";
import { KeyFrequencyHeatmap } from "./KeyFrequencyHeatmap.tsx";

export function LayoutsPage() {
  const { formatLanguageName } = useFormattedNames();
  const [language, setLanguage] = useState(Language.EN);
  const keyboards = Layout.ALL.filter(
    (layout) => layout.language === language,
  ).map((layout) => loadKeyboard(layout));
  return (
    <Article>
      <CustomLayoutDesignerToggler />
      <FormattedMessage
        id="page.layouts.content"
        defaultMessage={
          "<h1>Keyboard Layouts</h1>" +
          "<p>These charts show how efficient each keyboard layout is — in other words, how easy that layout is to type on.</p>" +
          "<p>Circle size reflects how often each key is used, and arcs show how often each pair of keys is typed one after another.</p>" +
          "<p>Typing is easiest when your most-used keys sit on the home row and your most common key pairs alternate between different fingers and hands. That's why an efficient layout has its biggest circles clustered on the home row, along with arcs spread evenly across the keyboard that run long and horizontal rather than short and diagonal — a sign that fingers and hands are switching off frequently.</p>"
        }
      />
      <dl>
        <dt>
          <FormattedMessage
            id="layouts.stats.homeRowKeys.name"
            defaultMessage="Share of keys on the home row:"
          />
        </dt>
        <dd>
          <FormattedMessage
            id="layouts.stats.homeRowKeys.description"
            defaultMessage="How many keys are typed without moving off the Caps Lock row — higher is better."
          />
        </dd>
        <dt>
          <FormattedMessage
            id="layouts.stats.topRowKeys.name"
            defaultMessage="Share of keys on the top row:"
          />
        </dt>
        <dd>
          <FormattedMessage
            id="layouts.stats.topRowKeys.description"
            defaultMessage="How many keys are typed on the Tab row — lower is better."
          />
        </dd>
        <dt>
          <FormattedMessage
            id="layouts.stats.bottomRowKeys.name"
            defaultMessage="Share of keys on the bottom row:"
          />
        </dt>
        <dd>
          <FormattedMessage
            id="layouts.stats.bottomRowKeys.description"
            defaultMessage="How many keys are typed on the Shift row — lower is better."
          />
        </dd>
        <dt>
          <FormattedMessage
            id="layouts.stats.sameHandKeys.name"
            defaultMessage="Share of keys typed by the same hand:"
          />
        </dt>
        <dd>
          <FormattedMessage
            id="layouts.stats.sameHandKeys.description"
            defaultMessage="How many keys in a row are typed with the same hand — lower is better."
          />
        </dd>
        <dt>
          <FormattedMessage
            id="layouts.stats.sameFingerKeys.name"
            defaultMessage="Share of keys typed by the same finger:"
          />
        </dt>
        <dd>
          <FormattedMessage
            id="layouts.stats.sameFingerKeys.description"
            defaultMessage="How many keys in a row are typed with the same finger — lower is better."
          />
        </dd>
      </dl>
      <FieldList>
        <Field>
          <FormattedMessage id="t_Language:" defaultMessage="Language:" />
        </Field>
        <Field>
          <OptionList
            options={Language.ALL.map((item) => ({
              name: formatLanguageName(item),
              value: item.id,
            }))}
            value={language.id}
            onSelect={(id) => {
              setLanguage(Language.ALL.get(id));
            }}
          />
        </Field>
      </FieldList>
      <PhoneticModelLoader language={language}>
        {(model) => {
          return (
            <>
              <FieldList>
                <Field>
                  <FormattedMessage
                    id="t_Alphabet:"
                    defaultMessage="Alphabet:"
                  />
                </Field>
                <Field>
                  <Alphabet model={model} />
                </Field>
              </FieldList>
              {keyboards.map((keyboard) => (
                <KeyFrequencyHeatmap
                  key={keyboard.layout.id}
                  keyboard={keyboard}
                  model={model}
                />
              ))}
            </>
          );
        }}
      </PhoneticModelLoader>
    </Article>
  );
}
