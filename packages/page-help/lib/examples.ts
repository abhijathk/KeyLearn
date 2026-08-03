import { LessonKey, LessonKeys } from "@keylearn/lesson";
import { Letter } from "@keylearn/phonetic-model";
import { letters } from "./english.ts";

export function makeExampleLesson(
  confidences: readonly (number | null)[],
): LessonKeys {
  const keys: LessonKey[] = [];

  // Show the set that's in play plus a couple of upcoming locked stops, so the
  // journey trail stays readable in the help figure instead of spanning all 26
  // letters. (The final "every letter mastered" example still shows them all.)
  const ROAD_AHEAD = 2;
  const shown = Math.min(letters.length, confidences.length + ROAD_AHEAD);

  let index = 0;
  for (const letter of Letter.frequencyOrder(letters)) {
    if (index >= shown) {
      break;
    }
    if (index < confidences.length) {
      const confidence = confidences[index];
      keys.push(
        new LessonKey({
          letter,
          samples: [],
          timeToType: null,
          bestTimeToType: null,
          confidence: confidence,
          bestConfidence: confidence,
        }).asIncluded(),
      );
    } else {
      keys.push(
        new LessonKey({
          letter,
          samples: [],
          timeToType: null,
          bestTimeToType: null,
          confidence: null,
          bestConfidence: null,
        }).asExcluded(),
      );
    }
    index += 1;
  }

  const lessonKeys = new LessonKeys(keys);

  // Find the least confident of all included keys and focus on it.
  const candidateKeys = lessonKeys
    .findIncludedKeys()
    .filter((key) => (key.confidence ?? 0) < 1)
    .sort((a, b) => (a.confidence ?? 0) - (b.confidence ?? 0));
  if (candidateKeys.length > 0) {
    lessonKeys.focus(candidateKeys[0].letter);
  }

  return lessonKeys;
}
