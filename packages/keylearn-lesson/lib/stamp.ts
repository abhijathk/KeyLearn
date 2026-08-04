import { type Settings } from "@keylearn/settings";
import { LessonType } from "./lessontype.ts";
import { lessonProps } from "./settings.ts";

/**
 * What the practice page is serving right now, for the stamp on the pulse
 * island.
 *
 * Two parts: the mode, and — where the mode has one — the particular thing
 * chosen inside it. "Code craft" alone does not say which language, and
 * "Book Text" does not say which book; those are exactly the choices a
 * learner is most likely to have forgotten making.
 *
 * The mode comes back as a key rather than a translated string: the message
 * extractor needs literal ids at the call site, so the caller owns the
 * formatting and this stays a pure function of the settings.
 */
export type StampMode =
  | "guided"
  | "curriculum"
  | "code"
  | "wordlist"
  | "books"
  | "quotes"
  | "custom"
  | "numbers";

export type LessonStamp = {
  readonly mode: StampMode;
  /** The choice inside the mode, or null when the mode has none. */
  readonly detail: string | null;
  /**
   * True when the detail is our own words rather than a content title, so
   * the caller translates it instead of printing it.
   */
  readonly detailIsMessage: boolean;
};

export function lessonStamp(settings: Settings): LessonStamp {
  const type = settings.get(lessonProps.type);
  switch (type) {
    case LessonType.CURRICULUM:
      return plain("curriculum");
    case LessonType.CODE:
      return {
        mode: "code",
        detail: settings.get(lessonProps.code.syntax).name,
        detailIsMessage: false,
      };
    case LessonType.WORDLIST:
      return {
        mode: "wordlist",
        // The one detail that is a state of ours, not a content title.
        detail: settings.get(lessonProps.wordList.useCustom)
          ? "ownWords"
          : null,
        detailIsMessage: true,
      };
    case LessonType.BOOKS:
      return {
        mode: "books",
        detail: settings.get(lessonProps.books.book).title,
        detailIsMessage: false,
      };
    case LessonType.QUOTES:
      return plain("quotes");
    case LessonType.CUSTOM:
      return plain("custom");
    case LessonType.NUMBERS:
      return plain("numbers");
    default:
      return plain("guided");
  }
}

function plain(mode: StampMode): LessonStamp {
  return { mode, detail: null, detailIsMessage: false };
}
