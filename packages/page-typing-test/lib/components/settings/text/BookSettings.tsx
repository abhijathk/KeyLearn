import {
  type BookContent,
  BookPreview,
  BookSelector,
  flattenContent,
  ParagraphPreview,
  ParagraphSelector,
} from "@keylearn/content";
import { BookContentLoader } from "@keylearn/content-books";
import { useSettings } from "@keylearn/settings";
import { SettingsCard } from "@keylearn/widget";
import { useMemo } from "react";
import { FormattedMessage } from "react-intl";
import { typingTestProps } from "../../../settings.ts";

export function BookSettings() {
  const { settings } = useSettings();
  return (
    <BookContentLoader book={settings.get(typingTestProps.book)}>
      {(bookContent) => <Content bookContent={bookContent} />}
    </BookContentLoader>
  );
}

function Content({ bookContent }: { bookContent: BookContent }) {
  const { settings, updateSettings } = useSettings();
  const paragraphs = useMemo(
    () => flattenContent(bookContent.content),
    [bookContent],
  );
  const book = settings.get(typingTestProps.book);
  const paragraphIndex = settings.get(typingTestProps.bookParagraphIndex);
  return (
    <SettingsCard
      caption={
        <FormattedMessage
          id="typingTest.source.book"
          defaultMessage="Book paragraphs"
        />
      }
    >
      <BookSelector
        book={book}
        onChange={(book) => {
          updateSettings(
            settings
              .set(typingTestProps.book, book)
              .set(typingTestProps.bookParagraphIndex, 0),
          );
        }}
      />

      <BookPreview {...bookContent} />

      <ParagraphSelector
        paragraphs={paragraphs}
        paragraphIndex={paragraphIndex}
        onChange={(paragraphIndex) => {
          updateSettings(
            settings.set(typingTestProps.bookParagraphIndex, paragraphIndex),
          );
        }}
      />

      <ParagraphPreview
        paragraphs={paragraphs}
        paragraphIndex={paragraphIndex}
      />
    </SettingsCard>
  );
}
