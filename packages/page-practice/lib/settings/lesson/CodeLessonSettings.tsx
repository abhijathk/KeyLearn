import { Syntax } from "@keybr/code";
import {
  CODE_THEMES,
  frameworkOf,
  HIDE_COMMENTS,
  snippetSetFor,
} from "@keybr/content-snippets";
import { type CodeLesson, lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import {
  CheckBox,
  Field,
  FieldList,
  FieldSet,
  OptionList,
  RadioBox,
} from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./CodeLessonSettings.module.less";

export function CodeLessonSettings({
  lesson,
}: {
  readonly lesson: CodeLesson;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  const syntax = settings.get(lessonProps.code.syntax);
  const flags = settings.get(lessonProps.code.flags);
  const set = snippetSetFor(syntax.id);
  // A framework is one thing to choose and then a language to write it in.
  // Selenium in Python and Selenium in Java are the same skill and the same
  // menu entry; listing them separately would put them a third of an
  // alphabetical list apart.
  const framework = frameworkOf(syntax.id);

  // Which exercise, for a language that offers several of them. C/C++ has
  // whole code, prototypes and statements; they are one entry in the list with
  // the choice moved down here, the same way a framework's languages are.
  const variants = Syntax.variantsOf(syntax.id);

  // One entry per framework, not one per language. Postgres and SQL Server
  // are both "SQL": listing them separately put the same word in the menu
  // twice and made the radio below it look redundant.
  const options: { value: string; name: string; group: string }[] = [];
  const listed = new Set<string>();
  for (const item of Syntax.ALL) {
    const group = Syntax.CATEGORIES.get(item.id) ?? "Other";
    if (item.variant != null) {
      if (listed.has(item.variant.group)) {
        continue;
      }
      listed.add(item.variant.group);
      const chosen = Syntax.variantsOf(item.id).some((v) => v.id === syntax.id)
        ? syntax.id
        : item.id;
      options.push({ value: chosen, name: item.variant.group, group });
      continue;
    }
    const fw = frameworkOf(item.id);
    if (fw == null) {
      options.push({ value: item.id, name: item.name, group });
      continue;
    }
    if (listed.has(fw.name)) {
      continue;
    }
    listed.add(fw.name);
    // The selected language when this framework is the selected one, so the
    // button's value always matches an option it is showing.
    const chosen =
      fw.sets.find((set) => set.syntax === syntax.id) ?? fw.sets[0];
    options.push({ value: chosen.syntax, name: fw.name, group });
  }
  options.sort(
    (a, b) =>
      Syntax.CATEGORY_ORDER.indexOf(a.group) -
        Syntax.CATEGORY_ORDER.indexOf(b.group) || a.name.localeCompare(b.name),
  );

  const setSyntax = (id: string) => {
    updateSettings(settings.set(lessonProps.code.syntax, Syntax.ALL.get(id)));
  };

  // A written corpus has topics to switch on and off; a grammar has flags like
  // capitals and comments. Both land in the same setting, and only one of them
  // is ever meaningful for a given language.
  const toggles =
    set != null
      ? set.topics.map(({ id, name }) => ({ id, name }))
      : [...syntax.flags].map((flag) => ({ id: flag, name: flag }));

  // Choosing no topic already means "give me everything", so the boxes are
  // shown ticked to say so. Leaving them all empty would describe the same
  // behaviour as its opposite, and unticking one would then appear to do
  // nothing at all.
  const noneChosen =
    set != null && !set.topics.some(({ id }) => flags.includes(id));

  const toggle = (id: string, on: boolean) => {
    const next = new Set(
      noneChosen ? [...flags, ...toggles.map((t) => t.id)] : flags,
    );
    if (on) {
      next.add(id);
    } else {
      next.delete(id);
    }
    updateSettings(settings.set(lessonProps.code.flags, [...next]));
  };

  return (
    <>
      <FieldSet
        legend={formatMessage({
          id: "t_Lesson_options",
          defaultMessage: "Lesson settings",
        })}
      >
        <FieldList>
          <Field>
            <FormattedMessage
              id="t_Syntax:"
              defaultMessage="Language syntax:"
            />
          </Field>
          <Field>
            <OptionList
              options={options}
              value={syntax.id}
              onSelect={setSyntax}
            />
          </Field>
          {/* On the same line as the thing it describes, and named rather than
              explained. The standard is meant to be absorbed by typing code
              that already follows it, not announced in a sentence. */}
          {set != null && (
            <Field>
              <span className={styles.badge}>{set.standard}</span>
            </Field>
          )}
        </FieldList>

        {/* Offered for every language, not only the written corpora: the
            generated grammars emit the same token classes, so a palette
            colours them just as well. */}
        <FieldList>
          <Field>
            <FormattedMessage
              id="lesson.code.theme"
              defaultMessage="Editor colours:"
            />
          </Field>
          <Field>
            <OptionList
              // Grouped by whose scheme it is, not by light or dark: every
              // one now carries both halves and switches with the app, so
              // filtering by mode would hide schemes that work perfectly well.
              options={CODE_THEMES.map((item) => ({
                value: item.id,
                name: item.name,
                group: item.id.startsWith("keylearn")
                  ? formatMessage({
                      id: "lesson.code.theme.house",
                      defaultMessage: "KeyLearn",
                    })
                  : formatMessage({
                      id: "lesson.code.theme.editors",
                      defaultMessage: "Editor schemes",
                    }),
              }))}
              value={settings.get(lessonProps.code.theme)}
              onSelect={(id) => {
                updateSettings(settings.set(lessonProps.code.theme, id));
              }}
            />
          </Field>
          <Field>
            <CheckBox
              label={formatMessage({
                id: "lesson.code.themeBackground",
                defaultMessage: "Editor background",
              })}
              checked={settings.get(lessonProps.code.themeBackground)}
              onChange={(on) => {
                updateSettings(
                  settings.set(lessonProps.code.themeBackground, on),
                );
              }}
            />
          </Field>
        </FieldList>

        {/* Which slice of the language to practise. Only shown when there is
            more than one, so a language with a single grammar never grows a
            row of one radio button explaining that there is no choice. */}
        {variants.length > 1 && (
          <FieldList>
            <Field>
              <FormattedMessage
                id="lesson.code.variant"
                defaultMessage="Practise:"
              />
            </Field>
            {variants.map((item) => (
              <Field key={item.id}>
                <RadioBox
                  name="snippet-variant"
                  label={item.variant!.name}
                  checked={item.id === syntax.id}
                  onSelect={() => setSyntax(item.id)}
                />
              </Field>
            ))}
          </FieldList>
        )}

        {/* The language the framework is written in — Selenium has Python and
            Java, and picking between them is a choice about this lesson rather
            than a different entry in the list. Hidden for a framework with one
            language, where a lone radio button only says there is no choice. */}
        {framework != null && framework.sets.length > 1 && (
          <FieldList>
            <Field>
              <FormattedMessage
                id="lesson.code.language"
                defaultMessage="Language:"
              />
            </Field>
            {framework.sets.map((item) => (
              <Field key={item.syntax}>
                <RadioBox
                  name="snippet-language"
                  label={item.language}
                  checked={item.syntax === syntax.id}
                  onSelect={() => setSyntax(item.syntax)}
                />
              </Field>
            ))}
          </FieldList>
        )}
      </FieldSet>

      {/* Their own block, in a grid. Flowed inline after the language selector
          they ran off the edge of the panel and read as an afterthought, which
          for the control deciding what you actually practise is backwards. */}
      <FieldSet
        legend={
          set != null
            ? formatMessage({
                id: "lesson.code.topics",
                defaultMessage: "What to practise",
              })
            : formatMessage({
                id: "lesson.code.include",
                defaultMessage: "Include",
              })
        }
      >
        <div className={styles.toggles}>
          {toggles.map(({ id, name }) => (
            <CheckBox
              key={id}
              label={name}
              checked={noneChosen || flags.includes(id)}
              onChange={(on) => toggle(id, on)}
            />
          ))}
          {/* Stored inverted so that a learner who never opens this panel gets
              the comments, which are half of what the snippets teach. */}
          {set != null && (
            <CheckBox
              label={formatMessage({
                id: "lesson.code.comments",
                defaultMessage: "Comments",
              })}
              checked={!flags.includes(HIDE_COMMENTS)}
              onChange={(on) => toggle(HIDE_COMMENTS, !on)}
            />
          )}
        </div>
      </FieldSet>
    </>
  );
}
