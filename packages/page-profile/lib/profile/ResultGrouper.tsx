import { useCollator } from "@keybr/intl";
import {
  KeyboardContext,
  keyboardProps,
  Layout,
  loadKeyboard,
  useFormattedNames,
} from "@keybr/keyboard";
import { Letter } from "@keybr/phonetic-model";
import { PhoneticModelLoader } from "@keybr/phonetic-model-loader";
import {
  type KeyStatsMap,
  makeKeyStatsMap,
  ResultGroups,
  useResults,
} from "@keybr/result";
import { useSettings } from "@keybr/settings";
import { clsx } from "clsx";
import { type ReactNode, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./road/road.module.less";

export function ResultGrouper({
  children,
}: {
  children: (keyStatsMap: KeyStatsMap) => ReactNode;
}) {
  const { formatMessage } = useIntl();
  const { settings } = useSettings();
  const { results, kidProfile = false } = useResults();
  const groups = ResultGroups.byLayout(results);
  const resultsLayouts = new Set(groups.keys());
  const configuredLayout = settings.get(keyboardProps.layout);
  if (resultsLayouts.size === 0) {
    resultsLayouts.add(configuredLayout);
  }
  const defaultLayout = () =>
    resultsLayouts.has(configuredLayout)
      ? configuredLayout
      : [...resultsLayouts][0];
  const [selectedLayout, setSelectedLayout] = useState(defaultLayout);
  const [characterClass, setCharacterClass] = useState("letters");
  const filter =
    kidProfile && characterClass === "programming" ? "letters" : characterClass;
  if (!resultsLayouts.has(selectedLayout)) {
    setSelectedLayout(defaultLayout());
  }
  const layoutOptions = useLayoutOptions(resultsLayouts);
  const keyboard = loadKeyboard(selectedLayout);
  const group = groups.get(selectedLayout);

  return (
    <>
      <div className={styles.filterRow}>
        <span className={styles.axis}>
          <FormattedMessage
            id="t_Show_statistics_for:"
            defaultMessage="Filter statistics by:"
          />
        </span>
        {resultsLayouts.size > 1 && (
          <select
            className={styles.filterSelect}
            value={selectedLayout.id}
            onChange={(ev) => {
              setSelectedLayout(Layout.ALL.get(ev.target.value));
            }}
          >
            {layoutOptions.map(({ value, name }) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        )}
        <span className={styles.seg}>
          {[
            [
              "letters",
              formatMessage({
                id: "t_cc_Letters",
                defaultMessage: "Letters",
              }),
            ],
            [
              "digits",
              formatMessage({ id: "t_cc_Digits", defaultMessage: "Digits" }),
            ],
            [
              "punctuators",
              formatMessage({
                id: "t_cc_Punctuation_characters",
                defaultMessage: "Punctuation marks",
              }),
            ],
            [
              "specials",
              formatMessage({
                id: "t_cc_Special_characters",
                defaultMessage: "Symbols",
              }),
            ],
            // The same set the Code craft lessons draw from, so the figures
            // here answer "how am I doing at code" rather than making somebody
            // read four filters and add them up. Not offered on a child's
            // profile: they do not practise it, so the view would always be
            // empty.
            ...(kidProfile
              ? []
              : [
                  [
                    "programming",
                    formatMessage({
                      id: "profile.filter.codeCraft",
                      defaultMessage: "Code craft",
                    }),
                  ] as const,
                ]),
          ].map(([value, name]) => (
            <button
              key={value}
              type="button"
              className={clsx(styles.segItem, filter === value && styles.segOn)}
              onClick={() => {
                setCharacterClass(value);
              }}
            >
              {name}
            </button>
          ))}
        </span>
      </div>

      <KeyboardContext.Provider value={keyboard}>
        <PhoneticModelLoader language={selectedLayout.language}>
          {({ letters }) => {
            switch (filter) {
              case "letters":
                return children(
                  makeKeyStatsMap(
                    Letter.restrict(letters, keyboard.getCodePoints()),
                    group,
                  ),
                );
              case "digits":
                return children(makeKeyStatsMap(Letter.digits, group));
              case "punctuators":
                return children(makeKeyStatsMap(Letter.punctuators, group));
              case "specials":
                return children(makeKeyStatsMap(Letter.specials, group));
              case "programming":
                return children(makeKeyStatsMap(Letter.programming, group));
              default:
                throw new Error();
            }
          }}
        </PhoneticModelLoader>
      </KeyboardContext.Provider>
    </>
  );
}

function useLayoutOptions(layouts: Iterable<Layout>) {
  const { formatFullLayoutName } = useFormattedNames();
  const { compare } = useCollator();
  return [...layouts]
    .map((item) => ({
      value: item.id,
      name: formatFullLayoutName(item),
    }))
    .sort((a, b) => compare(a.name, b.name));
}
