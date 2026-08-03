/**
 * Anything that could move a conversation off KeyLearn.
 *
 * This is the serious half of chat safety. A rude word is unpleasant; a handle
 * or a phone number offered to a stranger in an app that children have open is
 * the beginning of something else. So these patterns are matched separately
 * from profanity, they are never blurred — only withheld — and they carry the
 * heaviest penalty with no warning ladder in front of it.
 *
 * The patterns are deliberately broad. A false positive costs somebody one
 * retyped message; a false negative costs considerably more.
 */

/** Digits that have been spelled or spaced out to dodge a naive matcher. */
const DIGIT_WORDS =
  "zero|one|two|three|four|five|six|seven|eight|nine|oh|nought";

const PATTERNS: readonly RegExp[] = [
  // Explicit schemes, and bare "www." — the commonest form by far.
  /\b(?:https?|ftp|ws|data|file|mailto|tel|sms|javascript)\s*:/i,
  /\bwww\s*\./i,

  // A bare domain: "example.com", "keylearn·com", "example (dot) com". The
  // separator class covers the usual dodges around the dot.
  new RegExp(
    String.raw`\b[a-z0-9][a-z0-9-]{1,}\s*(?:\.|\(\s*dot\s*\)|\[\s*dot\s*\]|\s+dot\s+|·)\s*` +
      String.raw`(?:com|net|org|io|co|me|gg|tv|xyz|app|dev|link|site|info|biz|ru|uk|us|de|fr|in|au|ly|to|cc)\b`,
    "i",
  ),

  // Email, including "name (at) host (dot) com".
  new RegExp(
    String.raw`[a-z0-9._%+-]+\s*(?:@|\(\s*at\s*\)|\[\s*at\s*\]|\s+at\s+)\s*` +
      String.raw`[a-z0-9-]+\s*(?:\.|\(\s*dot\s*\)|\s+dot\s+)\s*[a-z]{2,}`,
    "i",
  ),

  // Seven or more digits, however they have been broken up. Catches phone
  // numbers without also catching "1990" or a wpm score.
  /(?:\d[\s.\-()+]*){7,}/,

  // The same, spelled out in words.
  new RegExp(String.raw`(?:\b(?:${DIGIT_WORDS})\b[\s,.-]*){7,}`, "i"),

  // Naming a platform alongside an invitation is the giveaway, more than the
  // platform name on its own — "I use discord" is chat, "add me on discord" is
  // an attempt to leave.
  new RegExp(
    String.raw`\b(?:add|msg|message|dm|pm|text|call|find|follow|contact|reach|join|hmu|hit\s+me\s+up)\b` +
      String.raw`[^.!?]{0,24}\b(?:discord|snap(?:chat)?|insta(?:gram)?|whats\s*app|telegram|tiktok|kik|skype|signal|roblox|steam|xbox|psn|tg|wa)\b`,
    "i",
  ),
  // …and the reverse order: "discord: name#1234".
  new RegExp(
    String.raw`\b(?:discord|snap(?:chat)?|insta(?:gram)?|whats\s*app|telegram|tiktok|kik|skype|signal|roblox|steam)\b\s*` +
      String.raw`(?:[:@#]|is|=)\s*\S`,
    "i",
  ),
];

/** Whether the text contains anything that would take a person off-platform. */
export function hasContactDetails(text: string): boolean {
  return PATTERNS.some((re) => re.test(text));
}
