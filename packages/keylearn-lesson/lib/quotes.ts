import { randomQuote } from "@keylearn/content-quotes";
import { filterText, type Keyboard } from "@keylearn/keyboard";
import { type PhoneticModel } from "@keylearn/phonetic-model";
import { type RNGStream } from "@keylearn/rand";
import { type KeyStatsMap } from "@keylearn/result";
import { type Settings } from "@keylearn/settings";
import { LessonKeys } from "./key.ts";
import { Lesson } from "./lesson.ts";
import { lessonProps } from "./settings.ts";
import { Target } from "./target.ts";

/**
 * Short, complete, properly punctuated passages.
 *
 * The middle ground between the word list (no sentences) and Books (a long
 * commitment): every lesson is a handful of whole thoughts with their real
 * capitals and punctuation, and a fresh set every time. Quotes are served
 * whole — a passage cut off mid-sentence would defeat the point of the mode.
 */
export class QuotesLesson extends Lesson {
  constructor(settings: Settings, keyboard: Keyboard, model: PhoneticModel) {
    super(settings, keyboard, model);
  }

  override get letters() {
    return this.model.letters;
  }

  override update(keyStatsMap: KeyStatsMap) {
    return LessonKeys.includeAll(keyStatsMap, new Target(this.settings));
  }

  override generate(lessonKeys: LessonKeys, rng: RNGStream) {
    const attribution = this.settings.get(lessonProps.quotes.attribution);
    const length =
      100 + Math.round(this.settings.get(lessonProps.length) * 100);
    const codePoints = new Set(this.codePoints);
    const parts: string[] = [];
    let partsLength = 0;
    // A whole number of quotes, at least one — the last one may run past the
    // target length rather than be cut off.
    while (partsLength < length) {
      const { text, author } = randomQuote(rng);
      // A plain hyphen before the author: every layout can type it, where an
      // em-dash would be filtered out on most. The corpus is plain prose, but
      // the layout may still not cover everything — anything the keyboard
      // cannot type is dropped rather than shown untypeable.
      const part = filterText(
        attribution ? `${text} - ${author}` : text,
        codePoints,
      );
      if (part.length === 0) {
        continue;
      }
      parts.push(part);
      partsLength += part.length;
    }
    return parts.join(" ");
  }
}
