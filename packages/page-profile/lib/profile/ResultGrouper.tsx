import { useCollator } from "@keylearn/intl";
import {
  KeyboardContext,
  keyboardProps,
  Layout,
  loadKeyboard,
  useFormattedNames,
} from "@keylearn/keyboard";
import { Letter } from "@keylearn/phonetic-model";
import { PhoneticModelLoader } from "@keylearn/phonetic-model-loader";
import {
  type KeyStatsMap,
  makeKeyStatsMap,
  ResultGroups,
  useResults,
} from "@keylearn/result";
import { useSettings } from "@keylearn/settings";
import { clsx } from "clsx";
import { type ReactNode, useMemo, useState } from "react";
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
  if (!resultsLayouts.has(selectedLayout)) {
    setSelectedLayout(defaultLayout());
  }
  const layoutOptions = useLayoutOptions(resultsLayouts);
  const keyboard = loadKeyboard(selectedLayout);
  const group = groups.get(selectedLayout);

  // Every character this profile has actually struck on this layout. The
  // filters are drawn from it, the way the layout list is drawn from the
  // layouts in the results: offering "Symbols" to somebody who has only ever
  // typed words leads to an empty chart and the impression something is broken,
  // when in truth there is simply nothing there yet.
  const typed = useMemo(() => {
    // Code points, as plain numbers — which is all a CodePoint is.
    const set = new Set<number>();
    for (const result of group) {
      for (const { codePoint, hitCount } of result.histogram) {
        if (hitCount > 0) {
          set.add(codePoint);
        }
      }
    }
    return set;
  }, [group]);
  const practised = (letters: readonly Letter[]) =>
    letters.some(({ codePoint }) => typed.has(codePoint));

  const classes: (readonly [string, string])[] = [
    // Always offered, and the fallback. Letters are what a first lesson is made
    // of, so there is no state in which this one is the empty view — and with
    // no results at all it is the only thing left to show.
    [
      "letters",
      formatMessage({ id: "t_cc_Letters", defaultMessage: "Letters" }),
    ],
  ];
  if (practised(Letter.digits)) {
    classes.push([
      "digits",
      formatMessage({ id: "t_cc_Digits", defaultMessage: "Digits" }),
    ]);
  }
  if (practised(Letter.punctuators)) {
    classes.push([
      "punctuators",
      formatMessage({
        id: "t_cc_Punctuation_characters",
        defaultMessage: "Punctuation marks",
      }),
    ]);
  }
  if (practised(Letter.specials)) {
    classes.push([
      "specials",
      formatMessage({
        id: "t_cc_Special_characters",
        defaultMessage: "Symbols",
      }),
    ]);
  }
  // The same set the Code craft lessons draw from, so the figures here answer
  // "how am I doing at code" rather than making somebody read four filters and
  // add them up. Never on a child's profile, whatever the results contain.
  if (!kidProfile && practised(Letter.programming)) {
    classes.push([
      "programming",
      formatMessage({
        id: "profile.filter.codeCraft",
        defaultMessage: "Code craft",
      }),
    ]);
  }

  // A class can stop being offered — switching layout, or a profile whose
  // history was cleared. Falling back to letters keeps the selection on
  // something that is actually on screen.
  const filter = classes.some(([value]) => value === characterClass)
    ? characterClass
    : "letters";

  // Nothing to choose between is not a filter. With one keyboard layout
  // and one character class — which is every account until somebody has
  // practised digits or symbols — the row is a label, a lone button that
  // cannot be turned off, and the vertical space of a control.
  const hasChoice = resultsLayouts.size > 1 || classes.length > 1;

  return (
    <>
      {hasChoice && (
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
            {classes.map(([value, name]) => (
              <button
                key={value}
                type="button"
                className={clsx(
                  styles.segItem,
                  filter === value && styles.segOn,
                )}
                onClick={() => {
                  setCharacterClass(value);
                }}
              >
                {name}
              </button>
            ))}
          </span>
        </div>
      )}

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
