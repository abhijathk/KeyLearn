import { type WordList } from "@keylearn/content";
import { type Keyboard } from "@keylearn/keyboard";
import { Filter, Letter, type PhoneticModel } from "@keylearn/phonetic-model";
import { type RNGStream } from "@keylearn/rand";
import { type KeyStatsMap } from "@keylearn/result";
import { type Settings } from "@keylearn/settings";
import { Dictionary, filterWordList } from "./dictionary.ts";
import { LessonKey, LessonKeys } from "./key.ts";
import { filterKidsWords } from "./kids-words.ts";
import { Lesson } from "./lesson.ts";
import { lessonProps } from "./settings.ts";
import { findDueKey, isUrgent } from "./srs.ts";
import { Target } from "./target.ts";
import { generateFragment } from "./text/fragment.ts";
import {
  mangledWords,
  phoneticWords,
  randomWords,
  uniqueWords,
} from "./text/words.ts";

// A letter with at least this many recorded keystrokes counts as genuinely
// practised. In guided mode locked letters never appear in the text, so they
// sit at zero — this cleanly separates "really practised" (hundreds+ of hits,
// including imported keylearn history) from "never unlocked".
const MIN_PRACTICE_HITS = 100;

export class GuidedLesson extends Lesson {
  readonly dictionary: Dictionary;

  constructor(
    settings: Settings,
    keyboard: Keyboard,
    model: PhoneticModel,
    wordList: WordList,
  ) {
    super(settings, keyboard, model);
    if (settings.get(lessonProps.guided.kidsWords)) {
      // Same algorithm, kid-sized vocabulary. If the intersection is too
      // small to feed the generator, keep the full list — the phonetic
      // pseudo-word fallback still guards short letter sets either way.
      const kids = filterKidsWords(wordList);
      if (kids.length >= 50) {
        wordList = kids;
      }
    }
    this.dictionary = new Dictionary(
      filterWordList(wordList, this.codePoints).filter(
        (word) => word.length > 2,
      ),
    );
  }

  override get letters() {
    return this.model.letters;
  }

  override update(keyStatsMap: KeyStatsMap) {
    const alphabetSize = this.settings.get(lessonProps.guided.alphabetSize);
    const recoverKeys = this.settings.get(lessonProps.guided.recoverKeys);

    const letters = this.#getLetters();

    const minSize = 6;
    const maxSize =
      minSize + Math.round((letters.length - minSize) * alphabetSize);

    const target = new Target(this.settings);

    const lessonKeys = new LessonKeys(
      letters.map((letter) => LessonKey.from(keyStatsMap.get(letter), target)),
    );

    for (const lessonKey of lessonKeys) {
      const includedKeys = lessonKeys.findIncludedKeys();

      if (includedKeys.length < minSize) {
        // Meet the minimal required alphabet size.
        lessonKeys.include(lessonKey.letter);
        continue;
      }

      if (includedKeys.length < maxSize) {
        // Meet the maximal required alphabet size.
        lessonKeys.force(lessonKey.letter);
        continue;
      }

      // Keep any genuinely-practised letter in rotation — including keylearn
      // history imported into a profile — even if it sits past the frequency
      // window or its confidence has since dipped. Without this, imported
      // progress on letters that rank low in the default order (e.g. r, l)
      // would never surface, so a migrated learner would "lose" letters they
      // had already unlocked.
      const practiceHits = lessonKey.samples.reduce(
        (sum, s) => sum + s.hitCount,
        0,
      );
      if (practiceHits >= MIN_PRACTICE_HITS) {
        lessonKeys.include(lessonKey.letter);
        continue;
      }

      if ((lessonKey.bestConfidence ?? 0) >= 1) {
        // Must include all confident keys.
        lessonKeys.include(lessonKey.letter);
        continue;
      }

      if (recoverKeys) {
        if (includedKeys.every((key) => (key.confidence ?? 0) >= 1)) {
          // Include a new key only when all the previous keys
          // are now above the target speed.
          lessonKeys.include(lessonKey.letter);
          continue;
        }
      } else {
        if (includedKeys.every((key) => (key.bestConfidence ?? 0) >= 1)) {
          // Include a new key only when all the previous keys
          // were once above the target speed.
          lessonKeys.include(lessonKey.letter);
          continue;
        }
      }
    }

    // Find the least confident of all included keys and focus on it.
    const confidenceOf = (key: LessonKey): number => {
      return recoverKeys ? (key.confidence ?? 0) : (key.bestConfidence ?? 0);
    };
    const includedKeys = lessonKeys.findIncludedKeys();
    const weakestKeys = includedKeys
      .filter((key) => confidenceOf(key) < 1)
      .sort((a, b) => confidenceOf(a) - confidenceOf(b));
    let focusLetter = weakestKeys.length > 0 ? weakestKeys[0].letter : null;

    // Spaced repetition: surface a learned key that's due for review. When
    // nothing is actively being learned it drives the focus; mid-learning it
    // only interrupts for a key that's badly overdue.
    if (this.settings.get(lessonProps.guided.spacedRepetition)) {
      const due = findDueKey(keyStatsMap, includedKeys);
      if (due != null && (focusLetter == null || isUrgent(due))) {
        focusLetter = due.key.letter;
      }
    }

    if (focusLetter != null) {
      lessonKeys.focus(focusLetter);
    }

    return lessonKeys;
  }

  override generate(lessonKeys: LessonKeys, rng: RNGStream) {
    const filter = new Filter(
      lessonKeys.findIncludedKeys(),
      lessonKeys.findFocusedKey(),
    );
    const wordGenerator = this.#makeWordGenerator(filter, rng);
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

  #getLetters() {
    const { letters } = this.model;
    const { codePoints } = this;
    if (this.settings.get(lessonProps.guided.keyboardOrder)) {
      return Letter.weightedFrequencyOrder(letters, ({ codePoint }) =>
        codePoints.weight(codePoint),
      );
    } else {
      return Letter.frequencyOrder(letters);
    }
  }

  #makeWordGenerator(filter: Filter, rng: RNGStream) {
    const pseudoWords = phoneticWords(this.model, filter, rng);
    if (this.settings.get(lessonProps.guided.naturalWords)) {
      const words = this.dictionary.find(filter).slice(0, 1000);
      while (words.length < 15) {
        const word = pseudoWords();
        if (word != null) {
          words.push(word);
        } else {
          break;
        }
      }
      if (words.length === 0) {
        words.push("?");
      }
      return randomWords(words, rng);
    }
    return pseudoWords;
  }
}
