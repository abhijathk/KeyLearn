/** A span of the original text, as [start, end) code-unit offsets. */
export type Span = readonly [start: number, end: number];

/**
 * What to do with a message.
 *
 * - `allow` — send it as written.
 * - `blur` — send it, with {@link Verdict.spans} drawn blurred by the client.
 * - `withhold` — never send it; the room sees nothing at all. A placeholder
 *   ("message removed") only invites the room to guess, so there isn't one.
 */
export type Action = "allow" | "blur" | "withhold";

/**
 * Why a message was withheld, which decides how hard the response is.
 *
 * `contact` is deliberately separate from, and far more serious than, `severe`.
 * A rude word is rudeness; a phone number in a children's app is an attempt to
 * move someone off-platform, and the two do not share a policy.
 */
export type Reason = "clean" | "mild" | "severe" | "slur" | "contact" | "flood";

export type Verdict = {
  readonly action: Action;
  readonly reason: Reason;
  /** Spans to blur. Empty unless the action is `blur`. */
  readonly spans: readonly Span[];
  /**
   * How much this counts against the sender. Zero for a clean message and for
   * a blur — blurring is a courtesy, not an accusation.
   */
  readonly strikes: number;
};

export const CLEAN: Verdict = Object.freeze({
  action: "allow",
  reason: "clean",
  spans: Object.freeze([]),
  strikes: 0,
});
