import {
  GuidedLesson,
  kidsLetterOrder,
  LessonKey,
  LessonKeys,
  lessonProps,
  Target,
} from "@keylearn/lesson";
import { Letter } from "@keylearn/phonetic-model";
import { type KeyStatsMap } from "@keylearn/result";

/**
 * THE KIDS' OWN COPY OF THE UNLOCK RULE.
 *
 * A separate class rather than a flag threaded through the shared engine, and
 * that is the point of it: whatever is tuned for a six-year-old here can never
 * reach a grown-up's practice. `keylearn-lesson` is left exactly as it is.
 *
 * Everything about how a key is EARNED is unchanged and deliberately so. The
 * bar still sits at four fifths of the goal. Judging is still on current speed
 * rather than best-ever, so nothing banks on one lucky keystroke. The whole
 * hand still has to be up to speed. This is a touch-typing tutor and a letter
 * is not a gift.
 *
 * ONE CLAUSE DIFFERS: the single weakest key is allowed to sit below the bar.
 *
 * The shared rule requires every key in play to pass at the same moment. At
 * twenty keys that is a harder standard than this app holds an adult to, and
 * its failure mode is bad: one letter a child is having a poor week with locks
 * the whole alphabet, the trail visibly stops growing, and nothing on screen
 * explains why. An adult would reason about it; a child concludes the game is
 * broken or that they are.
 *
 * Excusing exactly one key cannot be gamed — the other nineteen still have to
 * be there, and it is the WORST one that is excused, so there is never a key
 * worth neglecting on purpose. It only removes the wall.
 */
export class KidsLesson extends GuidedLesson {
  override update(keyStatsMap: KeyStatsMap): LessonKeys {
    const alphabetSize = this.settings.get(lessonProps.guided.alphabetSize);

    // The shared class keeps its letter order private, so the kids order is
    // re-derived here rather than reached into. It is the only order this
    // class will ever want — the one that spells words early — so unlike the
    // shared engine there is no branch on `kidsWords` or `keyboardOrder`.
    const letters = kidsLetterOrder(Letter.frequencyOrder(this.model.letters));

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
        lessonKeys.include(lessonKey.letter);
        continue;
      }

      if (includedKeys.length < maxSize) {
        lessonKeys.force(lessonKey.letter);
        continue;
      }

      if (Target.passes(lessonKey.bestConfidence)) {
        // Anything already earned stays in rotation.
        lessonKeys.include(lessonKey.letter);
        continue;
      }

      // ── THE ONE CHANGE ────────────────────────────────────────────────
      //
      // The shared engine asks whether EVERY included key passes. This asks
      // whether at most one is behind. The bar itself has not moved.
      const behind = includedKeys.filter(
        (key) => !Target.passes(key.confidence),
      ).length;
      if (behind <= 1) {
        lessonKeys.include(lessonKey.letter);
        continue;
      }
    }

    // Focus the weakest key in play — which, with one of them now allowed to
    // lag, is the one most worth the next passage's attention.
    const confidenceOf = (key: LessonKey): number => key.confidence ?? 0;
    const weakest = lessonKeys
      .findIncludedKeys()
      .filter((key) => !Target.passes(confidenceOf(key)))
      .sort((a, b) => confidenceOf(a) - confidenceOf(b));
    if (weakest.length > 0) {
      lessonKeys.focus(weakest[0]!.letter);
    }

    return lessonKeys;
  }
}
