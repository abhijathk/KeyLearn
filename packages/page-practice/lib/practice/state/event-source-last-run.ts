import { type Result } from "@keylearn/result";
import {
  type LessonEventListener,
  type LessonEventSource,
} from "./event-types.ts";

// A near miss within this margin of the last run is worth an encouraging
// "so close" nudge; anything further off stays quiet (a bad round shouldn't
// be rubbed in).
const NEAR_MARGIN = 0.9;

/**
 * The small-wins engine: compares each round to the previous one and fires a
 * little celebration when you do better, or an encouraging "so close" when you
 * just miss.
 *
 * It compares EFFECTIVE SPEED — typing speed scaled by accuracy — not the raw
 * `score`. Score is inflated by each round's text length and key complexity,
 * which are set by the randomly generated lesson rather than by how well you
 * typed; comparing it round-to-round produced false wins on longer/harder text
 * and false misses on shorter text. Speed (chars/min) and accuracy are both
 * independent of the text, so their product is a fair, honest measure of a
 * clean, fast round — and it still rewards accuracy over reckless speed.
 */
export class LastRunEvents implements LessonEventSource {
  #prevMetric = 0;

  append(result: Result, listener: LessonEventListener): void {
    const metric = result.speed * result.accuracy;
    const prev = this.#prevMetric;
    this.#prevMetric = metric;
    if (prev <= 0 || metric <= 0) {
      return; // No comparable previous round yet.
    }
    if (metric > prev) {
      listener({ type: "beat-last-run", score: metric, previous: prev });
    } else if (metric >= prev * NEAR_MARGIN) {
      listener({
        type: "near-last-run",
        gap: Math.max(1, Math.round((1 - metric / prev) * 100)),
      });
    }
  }
}
