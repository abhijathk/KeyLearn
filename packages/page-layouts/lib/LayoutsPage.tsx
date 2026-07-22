import {
  Language,
  Layout,
  loadKeyboard,
  useFormattedNames,
} from "@keybr/keyboard";
import { Alphabet } from "@keybr/phonetic-model";
import { PhoneticModelLoader } from "@keybr/phonetic-model-loader";
import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { CustomLayoutDesignerToggler } from "./custom/CustomLayoutDesignerToggler.tsx";
import { KeyFrequencyHeatmap } from "./KeyFrequencyHeatmap.tsx";
import * as styles from "./road.module.less";

export function LayoutsPage() {
  const { formatMessage } = useIntl();
  const { formatLanguageName } = useFormattedNames();
  const [language, setLanguage] = useState(Language.EN);
  const keyboards = Layout.ALL.filter(
    (layout) => layout.language === language,
  ).map((layout) => loadKeyboard(layout));
  return (
    <div className={styles.col}>
      <div className={styles.sect}>
        <FormattedMessage
          id="layouts.road.header"
          defaultMessage="Keyboard Layouts"
        />
      </div>
      <h1 className={styles.title}>
        <FormattedMessage
          id="layouts.road.title"
          defaultMessage="How easy is your layout to type on?"
        />
      </h1>
      <p className={styles.para}>
        <FormattedMessage
          id="layouts.road.intro1"
          defaultMessage="These charts show how efficient each keyboard layout is — in other words, how easy that layout is to type on. Circle size reflects how often each key is used, and arcs show how often each pair of keys is typed one after another."
        />
      </p>
      <p className={styles.para}>
        <FormattedMessage
          id="layouts.road.intro2"
          defaultMessage="Typing is easiest when your most-used keys sit on the home row and your most common key pairs alternate between different fingers and hands. That's why an efficient layout has its biggest circles clustered on the home row, along with arcs spread evenly across the keyboard that run long and horizontal rather than short and diagonal — a sign that fingers and hands are switching off frequently."
        />
      </p>
      <dl className={styles.defs}>
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
      <CustomLayoutDesignerToggler />
      <div className={styles.filterRow}>
        <span className={styles.lab}>
          <FormattedMessage id="t_Language:" defaultMessage="Language:" />
        </span>
        <select
          className={styles.filterSelect}
          value={language.id}
          onChange={(event) => {
            setLanguage(Language.ALL.get(event.target.value));
          }}
          aria-label={formatMessage({
            id: "t_Language:",
            defaultMessage: "Language:",
          })}
        >
          {Language.ALL.map((item) => (
            <option key={item.id} value={item.id}>
              {formatLanguageName(item)}
            </option>
          ))}
        </select>
      </div>
      <PhoneticModelLoader language={language}>
        {(model) => {
          return (
            <>
              <div className={styles.whisper}>
                <span>
                  <span className={styles.lab}>
                    <FormattedMessage
                      id="t_Alphabet:"
                      defaultMessage="Alphabet:"
                    />
                  </span>
                  <Alphabet model={model} />
                </span>
              </div>
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
    </div>
  );
}
