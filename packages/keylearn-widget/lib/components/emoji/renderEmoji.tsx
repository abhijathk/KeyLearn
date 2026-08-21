import { type ReactNode } from "react";
import { hasDateMark, splitDateMarks } from "./datemark.ts";
import {
  SUPPORT_EMOJI,
  SupportEmoji,
  type SupportEmojiChar,
} from "./SupportEmoji.tsx";

/**
 * Swaps the six support emoji in a string for their drawn versions.
 *
 * The message itself still holds the ordinary character — this only
 * changes what is painted, which is why a reply sent by email needs no
 * special case at all. Anything not in the set is left exactly as typed;
 * this is not a general emoji replacer and should not become one.
 *
 * Splitting on a character class rather than scanning code unit by code
 * unit: every one of these is a surrogate pair, and `str[i]` would cut
 * them in half.
 */
const PATTERN = new RegExp(
  `(${Object.keys(SUPPORT_EMOJI)
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})`,
  "gu",
);

const isSupportEmoji = (s: string): s is SupportEmojiChar =>
  Object.hasOwn(SUPPORT_EMOJI, s);

/**
 * A message as the customer should read it: the desk's marks drawn, and
 * any date the desk inserted resolved into their own clock.
 *
 * One entry point rather than two, because every caller wants both and a
 * caller that remembered only the emoji would show somebody a raw
 * `{{t:…}}` where a date was meant to be.
 */
export function renderMessageText(
  text: string,
  /**
   * Left undefined by every caller in the app, deliberately: the date is
   * then shown in the clock of the device reading it.
   *
   * The account has a time-zone preference and this does NOT follow it.
   * Somebody travelling has their preference set to home and their laptop
   * set to where they are standing — and "we will look at this at 9am" is
   * a promise about the day they are actually having. The parameter
   * exists for the mailer, which has no device to ask.
   */
  timeZone?: string,
  /**
   * How it is written — the account's chosen locale.
   *
   * Separate from the zone on purpose: preferences decide the FORMAT,
   * the device decides the INSTANT. Those are two different questions
   * and the app was answering both with the same setting.
   */
  locale?: string,
): ReactNode {
  // Asked directly rather than inferred from the number of parts: a body
  // that is ONLY a date marker splits into exactly one part, so counting
  // parts treated the clearest case as "nothing to resolve" and showed
  // the customer the raw marker.
  if (!hasDateMark(text)) {
    return renderSupportEmoji(text);
  }
  const parts = splitDateMarks(text, { timeZone, locale });
  return parts.map((part, i) =>
    part.isDate ? (
      <time key={i} className="keylearn-date">
        {part.text}
      </time>
    ) : (
      <span key={i}>{renderSupportEmoji(part.text)}</span>
    ),
  );
}

export function renderSupportEmoji(text: string): ReactNode {
  // The overwhelmingly common case is a message with none in it, and a
  // split allocates an array whatever the answer. One scan first.
  if (!PATTERN.test(text)) {
    PATTERN.lastIndex = 0;
    return text;
  }
  PATTERN.lastIndex = 0;

  return text
    .split(PATTERN)
    .map((part, i) =>
      isSupportEmoji(part) ? (
        <SupportEmoji key={i} name={SUPPORT_EMOJI[part]} />
      ) : (
        part
      ),
    );
}

/** Whether a string carries any of them — for a preview or a summary. */
export function hasSupportEmoji(text: string): boolean {
  const found = PATTERN.test(text);
  PATTERN.lastIndex = 0;
  return found;
}
