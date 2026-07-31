import { Syntax } from "@keybr/code";
import { type CodeLesson, lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import {
  CheckBox,
  Field,
  FieldList,
  FieldSet,
  OptionList,
} from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function CodeLessonSettings({
  lesson,
}: {
  readonly lesson: CodeLesson;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  const syntax = settings.get(lessonProps.code.syntax);
  const flags = settings.get(lessonProps.code.flags);
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
              options={Syntax.ALL.map((item) => ({
                value: item.id,
                name: item.name,
              }))}
              value={syntax.id}
              onSelect={(id) => {
                updateSettings(
                  settings.set(lessonProps.code.syntax, Syntax.ALL.get(id)),
                );
              }}
            />
          </Field>
          {[...syntax.flags].map((flag) => {
            return (
              <Field key={flag}>
                <CheckBox
                  label={flag}
                  checked={flags.includes(flag)}
                  onChange={(checked) => {
                    const set = new Set(flags);
                    if (checked) {
                      set.add(flag);
                    } else {
                      set.delete(flag);
                    }
                    updateSettings(
                      settings.set(lessonProps.code.flags, [...set]),
                    );
                  }}
                />
              </Field>
            );
          })}
        </FieldList>
      </FieldSet>
    </>
  );
}
