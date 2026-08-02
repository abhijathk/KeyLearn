import { Enum, type EnumItem } from "@keybr/lang";
import { TextType } from "@keybr/result";

export class LessonType implements EnumItem {
  static readonly GUIDED = new LessonType("guided", TextType.GENERATED);
  static readonly CURRICULUM = new LessonType("curriculum", TextType.GENERATED);
  static readonly WORDLIST = new LessonType("wordlist", TextType.NATURAL);
  static readonly BOOKS = new LessonType("books", TextType.NATURAL);
  static readonly CUSTOM = new LessonType("custom", TextType.NATURAL);
  static readonly CODE = new LessonType("code", TextType.CODE);
  static readonly NUMBERS = new LessonType("numbers", TextType.NUMBERS);
  // Order here is the order the practice settings offer them in. Code sits
  // straight after the classic course: for someone learning to type code it is
  // the destination, not an afterthought filed between prose and numbers.
  static readonly ALL = new Enum<LessonType>(
    LessonType.GUIDED,
    LessonType.CURRICULUM,
    LessonType.CODE,
    LessonType.WORDLIST,
    LessonType.BOOKS,
    LessonType.CUSTOM,
    LessonType.NUMBERS,
  );

  private constructor(
    readonly id: string,
    readonly textType: TextType,
  ) {
    Object.freeze(this);
  }

  toString() {
    return this.id;
  }

  toJSON() {
    return this.id;
  }
}
