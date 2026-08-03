import { type Result } from "@keylearn/result";
import {
  type LessonEventListener,
  type LessonEventSource,
} from "./event-types.ts";

/**
 * Celebrates a new best typing rhythm. Rhythm is computed live and only
 * present on this session's results, so results without it (loaded from
 * storage) are skipped.
 */
export class TopConsistencyEvents implements LessonEventSource {
  #resultCount = 0;
  #topConsistency = 0;

  append(result: Result, listener: LessonEventListener): void {
    const { consistency } = result;
    if (consistency == null) {
      return;
    }
    this.#resultCount += 1;
    if (consistency > this.#topConsistency) {
      if (this.#resultCount >= 3) {
        listener({
          type: "top-consistency",
          consistency,
          previous: this.#topConsistency,
        });
      }
      this.#topConsistency = consistency;
    }
  }
}
