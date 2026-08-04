import {
  lessonProps,
  NUMBER_FORMATS,
  type NumbersLesson,
} from "@keylearn/lesson";
import { useSettings } from "@keylearn/settings";
import {
  CheckBox,
  Description,
  Explainer,
  Field,
  FieldList,
  FieldSet,
} from "@keylearn/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { BenfordProp } from "./BenfordProp.tsx";

export function NumbersLessonSettings({
  lesson,
}: {
  readonly lesson: NumbersLesson;
}): ReactNode {
  const { formatMessage } = useIntl();
  return (
    <>
      <FieldSet
        legend={formatMessage({
          id: "t_Lesson_options",
          defaultMessage: "Lesson settings",
        })}
      >
        <NumberFormatsProp />
        <BenfordProp />
      </FieldSet>
    </>
  );
}

function NumberFormatsProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  const labels: Record<string, string> = {
    plain: formatMessage({
      id: "lesson.numbers.format.plain",
      defaultMessage: "Plain digits",
    }),
    dates: formatMessage({
      id: "lesson.numbers.format.dates",
      defaultMessage: "Dates (14/06/2026)",
    }),
    times: formatMessage({
      id: "lesson.numbers.format.times",
      defaultMessage: "Times (09:45)",
    }),
    currency: formatMessage({
      id: "lesson.numbers.format.currency",
      defaultMessage: "Money ($1,234.56)",
    }),
    phone: formatMessage({
      id: "lesson.numbers.format.phone",
      defaultMessage: "Phone numbers ((555) 867-5309)",
    }),
  };
  const enabled = new Set(settings.get(lessonProps.numbers.formats));
  return (
    <>
      <Explainer>
        <Description>
          <FormattedMessage
            id="lesson.numbers.formats.description"
            defaultMessage="Numbers as they occur in the world. Pick the shapes to drill; each line mixes them. With everything off, plain digits are served anyway."
          />
        </Description>
      </Explainer>
      <FieldList>
        {NUMBER_FORMATS.map((format) => (
          <Field key={format}>
            <CheckBox
              label={labels[format] ?? format}
              checked={enabled.has(format)}
              onChange={(value) => {
                const next = NUMBER_FORMATS.filter((f) =>
                  f === format ? value : enabled.has(f),
                );
                updateSettings(settings.set(lessonProps.numbers.formats, next));
              }}
            />
          </Field>
        ))}
      </FieldList>
    </>
  );
}
