import { useIntlNumbers } from "@keylearn/intl";
import { textStatsOf } from "@keylearn/unicode";
import { NameValue } from "@keylearn/widget";
import { memo, type ReactNode, useMemo } from "react";
import { useIntl } from "react-intl";
import * as styles from "./BookPreview.module.less";
import { type BookContent } from "./types.ts";
import { flattenContent } from "./util.ts";

export const BookPreview = memo(function BookPreview({
  book,
  content,
}: BookContent): ReactNode {
  const { formatMessage } = useIntl();
  const { formatNumber } = useIntlNumbers();
  const {
    numChapters,
    numParagraphs,
    numWords,
    numUniqueWords,
    numCharacters,
    avgWordLength,
  } = useMemo(() => {
    const paragraphs = flattenContent(content);
    const numChapters = content.length;
    const numParagraphs = paragraphs.length;
    const textStats = textStatsOf(book.language.locale, paragraphs);
    return {
      numChapters,
      numParagraphs,
      ...textStats,
    };
  }, [book, content]);
  return (
    <div className={styles.root}>
      <img
        className={styles.coverImage}
        src={book.coverImage}
        alt={formatMessage({
          id: "books.coverImage",
          defaultMessage: "Book cover image",
        })}
        title={`${book.title} by ${book.author}`}
      />
      <div className={styles.details}>
        <p>
          <strong>{book.title}</strong> by <strong>{book.author}</strong>
        </p>
        <p>
          <NameValue
            name={formatMessage({
              id: "t_num_Chapters",
              defaultMessage: "Chapter count",
            })}
            value={formatNumber(numChapters)}
          />
          <NameValue
            name={formatMessage({
              id: "t_num_Paragraphs",
              defaultMessage: "Paragraph count",
            })}
            value={formatNumber(numParagraphs)}
          />
          <NameValue
            name={formatMessage({
              id: "t_num_All_words",
              defaultMessage: "Total words",
            })}
            value={formatNumber(numWords)}
          />
          <NameValue
            name={formatMessage({
              id: "t_num_Unique_words",
              defaultMessage: "Distinct words",
            })}
            value={formatNumber(numUniqueWords)}
          />
          <NameValue
            name={formatMessage({
              id: "t_num_Characters",
              defaultMessage: "Characters",
            })}
            value={formatNumber(numCharacters)}
          />
        </p>
        <p>
          <NameValue
            name={formatMessage({
              id: "t_Average_word_length",
              defaultMessage: "Mean word length",
            })}
            value={formatNumber(avgWordLength, 2)}
          />
        </p>
      </div>
    </div>
  );
});
