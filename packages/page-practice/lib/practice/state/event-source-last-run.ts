import { type Result } from "@keybr/result";
import {
  type LessonEventListener,
  type LessonEventSource,
} from "./event-types.ts";

// A near miss within this margin of the last run is worth an encouraging
// "so close" nudge; anything further off stays quiet (a bad round shouldn't
// be rubbed in).
const NEAR_MARGIN = 0.9;

/**
 * The small-wins engine: compares each round's score to the previous round.
 * Beating it fires a little celebration; just missing fires an encouraging
 * "so close" so you see how near you were. Score already blends speed with
 * accuracy, so the win rewards clean improvement — not reckless speed.
 */
export class LastRunEvents implements LessonEventSource {
  #prevScore = 0;

  append(result: Result, listener: LessonEventListener): void {
    const { score } = result;
    const prev = this.#prevScore;
    this.#prevScore = score;
    if (prev <= 0) {
      return; // No previous round to compare against yet.
    }
    if (score > prev) {
      listener({ type: "beat-last-run", score, previous: prev });
    } else if (score >= prev * NEAR_MARGIN) {
      listener({
        type: "near-last-run",
        gap: Math.max(1, Math.round((1 - score / prev) * 100)),
      });
    }
  }
}
