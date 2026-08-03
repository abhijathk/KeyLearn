import { hasContactDetails } from "./contact.ts";
import { findProfanity } from "./matcher.ts";
import { CLEAN, type Span, type Verdict } from "./types.ts";

/** Longest message we will carry. Chat is for a sentence, not an essay. */
export const MAX_LENGTH = 140;

/**
 * How many profanities in one message stop counting as a slip.
 *
 * One rude word in a sentence is somebody being frustrated at a passage. Three
 * is somebody using the room as a wall, and blurring it would just leave a
 * message that is mostly smudge.
 */
const TIRADE = 3;

/**
 * Decides what happens to one message.
 *
 * Everything here runs on the SERVER, before the message reaches anybody. The
 * client's blur is only how it draws a decision that has already been taken —
 * a client asked to censor itself is a client that can be asked not to.
 */
export function classify(text: string): Verdict {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { action: "withhold", reason: "clean", spans: [], strikes: 0 };
  }
  if (trimmed.length > MAX_LENGTH) {
    // Not an offence, just too long — the client caps it too, so reaching here
    // means the cap was bypassed rather than that somebody typed a lot.
    return { action: "withhold", reason: "clean", spans: [], strikes: 0 };
  }

  // Checked first, and never blurred. A blurred phone number is still a phone
  // number to anyone who screenshots it, and this is the risk that matters.
  if (hasContactDetails(trimmed)) {
    return { action: "withhold", reason: "contact", spans: [], strikes: 3 };
  }

  const found = findProfanity(trimmed);
  if (found.length === 0) {
    return CLEAN;
  }

  if (found.some(({ abusive }) => abusive)) {
    return { action: "withhold", reason: "slur", spans: [], strikes: 2 };
  }

  if (found.length >= TIRADE) {
    return { action: "withhold", reason: "severe", spans: [], strikes: 1 };
  }

  // One or two ordinary swear words: let the sentence through with them
  // smudged. The conversation survives, nobody has to read it, and the sender
  // is not accused of anything.
  const spans: Span[] = found.map(({ span }) => span);
  return { action: "blur", reason: "mild", spans, strikes: 0 };
}
