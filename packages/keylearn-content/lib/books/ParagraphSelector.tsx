import { Dir } from "@keylearn/intl";
import { Field, FieldList, Icon, IconButton, Range } from "@keylearn/widget";
import { mdiSkipNext, mdiSkipPrevious } from "@mdi/js";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { ParagraphIndex } from "./ParagraphPreview.tsx";

export function ParagraphSelector({
  paragraphs,
  paragraphIndex,
  onChange,
}: {
  readonly paragraphs: readonly string[];
  readonly paragraphIndex: number;
  readonly onChange: (paragraphIndex: number) => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  return (
    <FieldList>
      <Field>
        <FormattedMessage id="books.paragraph" defaultMessage="Paragraph:" />
      </Field>
      <Field>
        <ParagraphIndex paragraphIndex={paragraphIndex} />
      </Field>
      <Field>
        <Range
          size={32}
          min={0}
          max={paragraphs.length - 1}
          step={1}
          value={paragraphIndex}
          onChange={onChange}
        />
      </Field>
      <Field>
        <Dir swap="icon">
          <IconButton
            icon={<Icon shape={mdiSkipPrevious} />}
            title={formatMessage({
              id: "books.paragraph.previous",
              defaultMessage: "Previous paragraph",
            })}
            disabled={paragraphIndex === 0}
            onClick={() => {
              if (paragraphIndex > 0) {
                onChange(paragraphIndex - 1);
              }
            }}
          />
          <IconButton
            icon={<Icon shape={mdiSkipNext} />}
            title={formatMessage({
              id: "books.paragraph.next",
              defaultMessage: "Next paragraph",
            })}
            disabled={paragraphIndex === paragraphs.length - 1}
            onClick={() => {
              if (paragraphIndex < paragraphs.length - 1) {
                onChange(paragraphIndex + 1);
              }
            }}
          />
        </Dir>
      </Field>
    </FieldList>
  );
}
