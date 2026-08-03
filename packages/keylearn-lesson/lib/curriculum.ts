import { type Keyboard } from "@keylearn/keyboard";
import { Filter, Letter, type PhoneticModel } from "@keylearn/phonetic-model";
import { type RNGStream } from "@keylearn/rand";
import { type KeyStatsMap } from "@keylearn/result";
import { type Settings } from "@keylearn/settings";
import { orderForCurriculum } from "./curriculum-order.ts";
import { LessonKey, LessonKeys } from "./key.ts";
import { Lesson } from "./lesson.ts";
import { lessonProps } from "./settings.ts";
import { Target } from "./target.ts";
import { generateFragment } from "./text/fragment.ts";
import { mangledWords, phoneticWords, uniqueWords } from "./text/words.ts";

/**
 * The classic finger-by-finger curriculum, the way TypingClub / Mavis Beacon
 * teach it — a fixed home-row-first march through the keyboard — made adaptive.
 *
 * The order is fixed and derived from hand geometry (see
 * {@link orderForCurriculum}), so it's the same trustworthy progression every
 * session. The improvement over rote drills is that advancement is *earned*:
 * you only unlock the next stage once you've actually mastered the keys you're
 * on (reached the target speed on them), rather than after a fixed number of
 * lessons — so no one is marched past a key they haven't got yet, and quick
 * learners aren't held back. Practice text is generated from the phonetic model
 * restricted to your unlocked keys, so even a two-key stage reads as real,
 * pronounceable drills.
 */
export class CurriculumLesson extends Lesson {
  readonly #order: readonly Letter[];

  constructor(settings: Settings, keyboard: Keyboard, model: PhoneticModel) {
    super(settings, keyboard, model);
    this.#order = orderForCurriculum(this.keyboard, this.model.letters);
  }

  override get letters(): readonly Letter[] {
    return this.#order;
  }

  override update(keyStatsMap: KeyStatsMap): LessonKeys {
    const target = new Target(this.settings);
    const lessonKeys = new LessonKeys(
      this.#order.map((letter) =>
        LessonKey.from(keyStatsMap.get(letter), target),
      ),
    );
    const keys = [...lessonKeys];
    const minSize = 3;
    const stageSize = Math.max(
      1,
      this.settings.get(lessonProps.curriculum.stageSize),
    );

    const mastered = (key: LessonKey) => (key.bestConfidence ?? 0) >= 1;

    // The longest leading run of keys the learner has already mastered.
    let cleared = 0;
    while (cleared < keys.length && mastered(keys[cleared])) {
      cleared += 1;
    }

    // Show everything cleared, plus the next stage currently being learned.
    const unlocked = Math.min(
      keys.length,
      Math.max(minSize, cleared + stageSize),
    );
    for (let i = 0; i < unlocked; i++) {
      lessonKeys.include(keys[i].letter);
    }

    // Focus the first key in the window that isn't mastered yet — the one the
    // learner is currently working on.
    let focusIndex = 0;
    while (focusIndex < unlocked && mastered(keys[focusIndex])) {
      focusIndex += 1;
    }
    if (focusIndex >= unlocked) {
      focusIndex = unlocked - 1;
    }
    lessonKeys.focus(keys[focusIndex].letter);

    return lessonKeys;
  }

  override generate(lessonKeys: LessonKeys, rng: RNGStream) {
    const filter = new Filter(
      lessonKeys.findIncludedKeys(),
      lessonKeys.findFocusedKey(),
    );
    const words = mangledWords(
      uniqueWords(phoneticWords(this.model, filter, rng)),
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
