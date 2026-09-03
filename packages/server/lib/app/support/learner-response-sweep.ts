import { injectable } from "@fastr/invert";
import { LearnerResponse } from "@keylearn/database";
import { Logger } from "@keylearn/logger";

const HOUR_MS = 60 * 60 * 1000;
/** Decided 2 Sep 2026: a feedback comment is kept twelve months, then only the star remains. */
export const FEEDBACK_TEXT_RETENTION_MS = 365 * 24 * HOUR_MS;

/**
 * Reduces feedback comments older than twelve months to their star. The
 * row stays, so the average and the distribution the desk shows do not
 * shift when the text goes; only the personal data does.
 *
 * Runs hourly in the cluster's primary, like the other sweeps.
 */
@injectable({ singleton: true })
export class LearnerResponseSweep {
  #timer: NodeJS.Timeout | null = null;

  start(): void {
    if (this.#timer != null) {
      return;
    }
    void this.runOnce();
    this.#timer = setInterval(() => {
      void this.runOnce();
    }, HOUR_MS);
    this.#timer.unref?.();
  }

  stop(): void {
    if (this.#timer != null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  /** Drops the text of every comment older than the retention window; returns how many. */
  async runOnce(now: number = Date.now()): Promise<number> {
    try {
      const dropped = await LearnerResponse.dropTextBefore(
        new Date(now - FEEDBACK_TEXT_RETENTION_MS),
      );
      if (dropped > 0) {
        Logger.info("Feedback retention: dropped %d comment(s)", dropped);
      }
      return dropped;
    } catch (err: any) {
      Logger.warn(err, "Feedback retention sweep failed");
      return 0;
    }
  }
}
