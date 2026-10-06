import { Enum, type EnumItem } from "@keylearn/lang";
import { TextType } from "@keylearn/result";

export class LessonType implements EnumItem {
  static readonly GUIDED = new LessonType("guided", TextType.GENERATED);
  static readonly CURRICULUM = new LessonType("curriculum", TextType.GENERATED);
  static readonly WORDLIST = new LessonType("wordlist", TextType.NATURAL);
  static readonly BOOKS = new LessonType("books", TextType.NATURAL);
  static readonly QUOTES = new LessonType("quotes", TextType.NATURAL);
  static readonly CUSTOM = new LessonType("custom", TextType.NATURAL);
  static readonly CODE = new LessonType("code", TextType.CODE);
  static readonly NUMBERS = new LessonType("numbers", TextType.NUMBERS);
  // Order here is the order the practice settings offer them in. Code sits
  // straight after the classic course: for someone learning to type code it is
  // the destination, not an afterthought filed between prose and numbers.
  // Quotes sit beside Books: the same real prose, in a smaller commitment.
  static readonly ALL = new Enum<LessonType>(
    LessonType.GUIDED,
    LessonType.CURRICULUM,
    LessonType.CODE,
    LessonType.WORDLIST,
    LessonType.BOOKS,
    LessonType.QUOTES,
    LessonType.CUSTOM,
    LessonType.NUMBERS,
  );

  private constructor(
    readonly id: string,
    readonly textType: TextType,
  ) {
    Object.freeze(this);
  }

  /**
   * Whether a visitor who is not signed in may practise this (owner, 6 Oct
   * 2026). Only Guided: every other kind keeps its own state in the browser,
   * and on a machine many people share that state belongs to nobody. By id,
   * not identity, for the same bundler reason the practice page compares by id.
   */
  get openToGuests(): boolean {
    return this.id === "guided";
  }

  toString() {
    return this.id;
  }

  toJSON() {
    return this.id;
  }
}
