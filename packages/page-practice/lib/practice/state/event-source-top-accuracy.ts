import { type Result } from "@keybr/result";
import {
  type LessonEventListener,
  type LessonEventSource,
} from "./event-types.ts";

/**
 * Celebrates a new best accuracy — a personal best that rewards clean typing
 * even when raw speed has plateaued. Only fires on a clearly clean run so it
 * doesn't trigger on a trivial early result.
 */
export class TopAccuracyEvents implements LessonEventSource {
  #resultCount = 0;
  #topAccuracy = 0;

  append(result: Result, listener: LessonEventListener): void {
    this.#resultCount += 1;
    const { accuracy } = result;
    if (accuracy > this.#topAccuracy) {
      if (this.#resultCount >= 3 && accuracy > 0.95) {
        listener({
          type: "top-accuracy",
          accuracy,
          previous: this.#topAccuracy,
        });
      }
      this.#topAccuracy = accuracy;
    }
  }
}
