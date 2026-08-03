/**
 * Practice lines built from the cells a learner actually has.
 *
 * The same trick the typing engine uses: draw real words that can be written
 * with the unlocked cells, weighted toward the one going worst, and fall back
 * to generated syllables when the alphabet is still too small for real words.
 * Drilling a weak cell in isolation is a flashcard; meeting it inside ordinary
 * words is practice.
 */
import { type Progress, type Target } from "./progress.ts";

/** Common short words, so early lessons read like language rather than noise. */
const WORDS = [
  "a",
  "and",
  "be",
  "bad",
  "cab",
  "dad",
  "did",
  "face",
  "fed",
  "he",
  "head",
  "hi",
  "id",
  "if",
  "in",
  "is",
  "it",
  "job",
  "back",
  "big",
  "call",
  "can",
  "children",
  "come",
  "did",
  "each",
  "find",
  "from",
  "get",
  "had",
  "half",
  "hand",
  "has",
  "have",
  "help",
  "high",
  "his",
  "home",
  "into",
  "keep",
  "kind",
  "last",
  "left",
  "life",
  "like",
  "line",
  "list",
  "little",
  "long",
  "look",
  "made",
  "make",
  "man",
  "many",
  "mean",
  "might",
  "more",
  "most",
  "much",
  "name",
  "need",
  "next",
  "night",
  "not",
  "now",
  "off",
  "old",
  "one",
  "only",
  "open",
  "other",
  "out",
  "over",
  "own",
  "part",
  "place",
  "point",
  "put",
  "read",
  "real",
  "right",
  "said",
  "same",
  "see",
  "seem",
  "set",
  "she",
  "show",
  "side",
  "small",
  "some",
  "still",
  "such",
  "take",
  "tell",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "thing",
  "think",
  "this",
  "time",
  "to",
  "too",
  "turn",
  "under",
  "up",
  "use",
  "very",
  "want",
  "way",
  "we",
  "well",
  "went",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "will",
  "with",
  "word",
  "work",
  "world",
  "would",
  "year",
  "you",
  "your",
];

/** How often the weak cell is deliberately included. */
const FOCUS_SHARE = 0.6;

function canWrite(word: string, unlocked: ReadonlySet<string>): boolean {
  return [...word].every((ch) => unlocked.has(ch));
}

/** A pronounceable filler for when too few cells are unlocked for real words. */
function syllable(letters: readonly string[], rnd: () => number): string {
  const vowels = letters.filter((c) => "aeiou".includes(c));
  const consonants = letters.filter((c) => !"aeiou".includes(c));
  const pick = (list: readonly string[]) =>
    list.length === 0 ? "" : list[Math.floor(rnd() * list.length)];
  const len = 2 + Math.floor(rnd() * 2);
  let out = "";
  for (let i = 0; i < len; i++) {
    out +=
      i % 2 === 0
        ? pick(consonants) || pick(vowels)
        : pick(vowels) || pick(consonants);
  }
  return out || pick(letters);
}

/**
 * A line of practice for where this learner currently is.
 *
 * `focus` is included in roughly six words in ten. Enough that the weak cell
 * comes round often, not so much that the line stops resembling language.
 */
export function generateLine(
  progress: Progress,
  {
    words = 8,
    target,
    rnd = Math.random,
  }: { words?: number; target?: Target; rnd?: () => number } = {},
): string {
  const unlocked = progress.unlocked(target);
  const set = new Set(unlocked);
  const focus = progress.weakest(target);
  const writable = WORDS.filter((w) => canWrite(w, set));
  const withFocus =
    focus == null ? [] : writable.filter((w) => w.includes(focus));

  const out: string[] = [];
  for (let i = 0; i < words; i++) {
    const wantFocus = focus != null && rnd() < FOCUS_SHARE;
    const pool = wantFocus && withFocus.length > 0 ? withFocus : writable;
    if (pool.length === 0) {
      // Too few cells for real words yet; make something sayable instead.
      let made = syllable(unlocked, rnd);
      if (focus != null && wantFocus && !made.includes(focus)) {
        made = focus + made;
      }
      out.push(made);
    } else {
      out.push(pool[Math.floor(rnd() * pool.length)]);
    }
  }
  return out.join(" ");
}
