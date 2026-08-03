import {
  classify,
  escalate,
  type Standing,
  type Verdict,
} from "@keylearn/moderation";

/**
 * Who has been warned, who is muted, and who has lost the room.
 *
 * Standing is keyed on the signed-in account rather than the socket, so leaving
 * and rejoining does not wipe a warning — otherwise the ladder is one refresh
 * deep and means nothing. Anonymous players are keyed on their session, which
 * is the best that can be done for someone with no account; it is weaker, and
 * it is the reason chat is worth gating behind a sign-in if abuse ever becomes
 * a real problem.
 *
 * This lives in the worker's memory. It survives reconnects, which is what the
 * ladder needs to work at all, but not a deployment — persisting it wants a
 * column on `profile`, and that is the next step rather than this one.
 */

/** Messages allowed in the window, and the window. */
const FLOOD_COUNT = 5;
const FLOOD_MS = 10_000;

// `Standing` is readonly, which is right for the pure functions that read it.
// The warden keeps the mutable copy and hands over a frozen view.
type Entry = {
  strikes: number;
  lastStrikeAt: number;
  blocks: number;
  /** Timestamps of recent messages, for the flood check. */
  recent: number[];
  /** Last thing said, so the same line twice running can be dropped. */
  last: string;
  mutedUntil: number;
  blockedUntil: number;
};

const nobody = (): Entry => ({
  strikes: 0,
  lastStrikeAt: 0,
  blocks: 0,
  recent: [],
  last: "",
  mutedUntil: 0,
  blockedUntil: 0,
});

export type Ruling = {
  /** What the room sees, or null when nothing is passed on. */
  readonly post: {
    text: string;
    blurred: readonly (readonly [number, number])[];
  } | null;
  /** What the sender is told, or null when there is nothing to say. */
  readonly notice: { kind: string; untilMs: number } | null;
};

const SILENT: Ruling = Object.freeze({ post: null, notice: null });

export class ChatWarden {
  readonly #standing = new Map<string, Entry>();

  /** Whether this player may be in a room at all. */
  blockedUntil(key: string, now: number = Date.now()): number {
    const it = this.#standing.get(key);
    return it != null && it.blockedUntil > now ? it.blockedUntil : 0;
  }

  /**
   * Judge one message.
   *
   * Everything is decided here, on the server, before anybody else sees a
   * character of it. The client's blur is only how it draws a decision that has
   * already been taken.
   */
  say(key: string, text: string, now: number = Date.now()): Ruling {
    const it = this.#standing.get(key) ?? nobody();
    this.#standing.set(key, it);

    if (it.blockedUntil > now) {
      return {
        post: null,
        notice: { kind: "blocked", untilMs: it.blockedUntil },
      };
    }
    if (it.mutedUntil > now) {
      return { post: null, notice: { kind: "mute", untilMs: it.mutedUntil } };
    }

    // Flooding costs nothing to check and is the commonest nuisance by far.
    it.recent = it.recent.filter((at) => now - at < FLOOD_MS);
    if (it.recent.length >= FLOOD_COUNT) {
      return { post: null, notice: { kind: "slowdown", untilMs: 0 } };
    }
    // The same line twice running is dropped in silence — saying "you already
    // said that" is itself noise.
    if (text === it.last) {
      return SILENT;
    }

    const verdict: Verdict = classify(text);
    it.recent.push(now);
    it.last = text;

    if (verdict.action === "allow") {
      return { post: { text, blurred: [] }, notice: null };
    }
    if (verdict.action === "blur") {
      // Blurring is a courtesy, not an accusation: it earns no strike.
      return { post: { text, blurred: verdict.spans }, notice: null };
    }

    // Withheld. Nothing reaches the room — not even a placeholder, which would
    // only invite it to guess.
    if (verdict.strikes === 0) {
      return SILENT;
    }
    const standing: Standing = {
      strikes: it.strikes,
      lastStrikeAt: it.lastStrikeAt,
      blocks: it.blocks,
    };
    const consequence = escalate(
      standing,
      verdict.strikes,
      verdict.reason,
      now,
    );
    it.strikes += verdict.strikes;
    it.lastStrikeAt = now;
    switch (consequence.kind) {
      case "mute":
        it.mutedUntil = consequence.untilMs;
        return {
          post: null,
          notice: { kind: "mute", untilMs: consequence.untilMs },
        };
      case "block":
        it.blockedUntil = consequence.untilMs;
        it.blocks += 1;
        return {
          post: null,
          notice: { kind: "blocked", untilMs: consequence.untilMs },
        };
      default:
        return { post: null, notice: { kind: "warn", untilMs: 0 } };
    }
  }
}
