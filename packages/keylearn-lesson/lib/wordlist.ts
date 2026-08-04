import { type WordList } from "@keylearn/content";
import { type Keyboard } from "@keylearn/keyboard";
import { Letter, type PhoneticModel } from "@keylearn/phonetic-model";
import { type RNGStream } from "@keylearn/rand";
import { type KeyStatsMap } from "@keylearn/result";
import { type Settings } from "@keylearn/settings";
import { filterWordList } from "./dictionary.ts";
import { LessonKeys } from "./key.ts";
import { Lesson } from "./lesson.ts";
import { lessonProps } from "./settings.ts";
import { Target } from "./target.ts";
import { generateFragment } from "./text/fragment.ts";
import { mangledWords, randomWords, uniqueWords } from "./text/words.ts";

/**
 * The learner's own words, when the toggle is on and the box holds any.
 *
 * Split on whitespace, commas and semicolons so a pasted spelling list works
 * whatever its shape; duplicates collapse so one word cannot crowd the drill.
 */
export function customWordList(settings: Settings): readonly string[] {
  if (!settings.get(lessonProps.wordList.useCustom)) {
    return [];
  }
  const text = settings.get(lessonProps.wordList.custom);
  return [...new Set(text.split(/[\s,;]+/).filter((word) => word.length > 0))];
}

export class WordListLesson extends Lesson {
  readonly wordList: WordList;

  constructor(
    settings: Settings,
    keyboard: Keyboard,
    model: PhoneticModel,
    wordList: WordList,
  ) {
    super(settings, keyboard, model);
    const custom = customWordList(settings);
    if (custom.length > 0) {
      // The learner's own vocabulary replaces the frequency list outright.
      // The size and length filters exist for trimming a ranked list of
      // thousands; words someone chose by hand are drilled exactly as given.
      this.wordList = filterWordList(custom, this.codePoints);
    } else {
      const wordListSize = settings.get(lessonProps.wordList.wordListSize);
      const longWordsOnly = settings.get(lessonProps.wordList.longWordsOnly);
      this.wordList = filterWordList(wordList, this.codePoints)
        .filter((word) => !longWordsOnly || word.length > 3)
        .slice(0, wordListSize);
    }
  }

  override get letters() {
    return this.model.letters;
  }

  override update(keyStatsMap: KeyStatsMap) {
    return LessonKeys.includeAll(keyStatsMap, new Target(this.settings));
  }

  override generate(lessonKeys: LessonKeys, rng: RNGStream) {
    const wordGenerator = randomWords(this.wordList, rng);
    const words = mangledWords(
      uniqueWords(wordGenerator),
      this.model.language,
      Letter.restrict(Letter.punctuators, this.codePoints),
      {
        withCapitals: this.settings.get(lessonProps.capitals),
        withPunctuators: this.settings.get(lessonProps.punctuators),
      },
      rng,
    );
    return generateFragment(this.settings, words, {
      repeatWords: this.settings.get(lessonProps.repeatWords),
    });
  }
}
