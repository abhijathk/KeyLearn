/**
 * Practice lines built from the cells a learner actually has.
 *
 * The same trick the typing engine uses: draw real words that can be written
 * with the unlocked cells, weighted toward the one going worst, and fall back
 * to generated syllables when the alphabet is still too small for real words.
 * Drilling a weak cell in isolation is a flashcard; meeting it inside ordinary
 * words is practice.
 */
import { LETTER_CELLS, type Progress, type Target } from "./progress.ts";

/**
 * Common short words, so early lessons read like language rather than noise.
 *
 * Deliberately carries words for the awkward letters — q, z, x, j, v — even
 * where they are not among the commonest words in English. Without them those
 * cells are taught and then never practised: they are last in the teaching
 * order, so they are always the weakest cell, and the focus mechanism has
 * nothing to draw on.
 */
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
  // The awkward letters. Every one of these is here because its letter appears
  // in no other word on the list.
  "quick",
  "quiet",
  "quite",
  "queen",
  "equal",
  "zero",
  "size",
  "lazy",
  "zone",
  "puzzle",
  "box",
  "six",
  "fix",
  "next",
  "text",
  "jump",
  "just",
  "join",
  "voice",
  "value",
  "vote",
  "wave",
  "gave",
];

/** How often the weak cell is deliberately included. */
const FOCUS_SHARE = 0.6;

/**
 * How often an unlocked sign appears in a line it is not the focus of.
 *
 * Not every line: prose is mostly letters, and a line carrying every mark the
 * learner knows reads like a punctuation drill rather than like writing.
 */
const SIGN_SHARE = 0.45;

/** The letters, so a "cell" that is really a sign is not looked for in a word. */
const LETTER_SET: ReadonlySet<string> = new Set(LETTER_CELLS);

/**
 * How a sign is written into a line once it has been unlocked.
 *
 * Everything past the alphabet needs a carrier: a capital sign is only ever
 * typed by writing a capital letter, a number sign by writing a digit, and a
 * full stop has to come after something. So each one is a small edit applied to
 * the finished line rather than a word that can be drawn from a list.
 */
type Sign = {
  /** The teaching-order key, and what `weakest` will name. */
  readonly key: string;
  /**
   * Applies it to the words of a line.
   *
   * `letters` is what the learner has unlocked, so a sign that needs a carrier
   * word cannot smuggle in a cell they have never been taught.
   */
  readonly apply: (
    words: string[],
    rnd: () => number,
    letters: ReadonlySet<string>,
  ) => void;
};

/** Puts a mark after a word that is not already punctuated. */
function markAfterWord(
  words: string[],
  mark: string,
  rnd: () => number,
  { last = false }: { last?: boolean } = {},
): void {
  if (words.length === 0) {
    return;
  }
  const at = last
    ? words.length - 1
    : Math.floor(rnd() * Math.max(1, words.length - 1));
  if (/[.,?!;:'-]$/.test(words[at])) {
    return;
  }
  words[at] += mark;
}

/** Ordinary contractions, for teaching the apostrophe in its natural home. */
const CONTRACTIONS = [
  "don't",
  "can't",
  "it's",
  "that's",
  "isn't",
  "didn't",
  "hasn't",
  "we'll",
  "he'll",
  "there's",
];

/** Ordinary compounds, for the hyphen. */
const COMPOUNDS = [
  "well-known",
  "long-term",
  "part-time",
  "left-hand",
  "half-open",
  "one-off",
  "off-hand",
  "life-like",
];

/**
 * Replaces one word of the line with a word that carries the mark.
 *
 * Only with something the learner can actually write: a contraction using a
 * letter they have not met would teach the apostrophe by way of a cell they
 * have never seen.
 */
function swapIn(
  words: string[],
  pool: readonly string[],
  rnd: () => number,
  letters: ReadonlySet<string>,
): void {
  const usable = pool.filter((candidate) =>
    [...candidate.replace(/[^a-z]/g, "")].every((ch) => letters.has(ch)),
  );
  // Nothing writable yet: the mark waits rather than being taught through a
  // cell the learner has not met.
  if (words.length === 0 || usable.length === 0) {
    return;
  }
  words[Math.floor(rnd() * words.length)] =
    usable[Math.floor(rnd() * usable.length)];
}

const SIGNS: readonly Sign[] = [
  { key: ".", apply: (w, r) => markAfterWord(w, ".", r, { last: true }) },
  { key: ",", apply: (w, r) => markAfterWord(w, ",", r) },
  {
    key: "A",
    apply: (w) => {
      if (w.length > 0) {
        w[0] = w[0][0].toUpperCase() + w[0].slice(1);
      }
    },
  },
  { key: "?", apply: (w, r) => markAfterWord(w, "?", r, { last: true }) },
  {
    // Real contractions rather than an apostrophe bolted onto whatever word
    // came up: "last's" is not English, and a learner reading these lines back
    // should meet the mark where it actually belongs.
    key: "'",
    apply: (w, r, letters) => swapIn(w, CONTRACTIONS, r, letters),
  },
  { key: "!", apply: (w, r) => markAfterWord(w, "!", r, { last: true }) },
  {
    // Likewise a real compound, not two neighbouring words stapled together.
    key: "-",
    apply: (w, r, letters) => swapIn(w, COMPOUNDS, r, letters),
  },
  { key: ";", apply: (w, r) => markAfterWord(w, ";", r) },
  { key: ":", apply: (w, r) => markAfterWord(w, ":", r) },
  {
    key: "1",
    apply: (w, r) => {
      const at = Math.floor(r() * w.length);
      w[at] = String(1 + Math.floor(r() * 999));
    },
  },
];

function canWrite(word: string, unlocked: ReadonlySet<string>): boolean {
  return [...word].every((ch) => unlocked.has(ch));
}

/**
 * The signs in play, weak one first.
 *
 * Applied in teaching order otherwise, so a comma is not inserted into a
 * sentence that has not been given its full stop yet.
 */
function signsInPlay(
  unlocked: ReadonlySet<string>,
  focus: string | null,
): readonly Sign[] {
  const inPlay = SIGNS.filter((s) => unlocked.has(s.key));
  const weak = inPlay.find((s) => s.key === focus);
  return weak == null ? inPlay : [...inPlay.filter((s) => s !== weak), weak];
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
  // Words are built from letters only; everything past the alphabet is a sign
  // applied to the finished line, because none of them can stand alone.
  const letters = new Set([...set].filter((c) => LETTER_SET.has(c)));
  const writable = WORDS.filter((w) => canWrite(w, letters));
  const letterFocus = focus != null && LETTER_SET.has(focus) ? focus : null;
  const withFocus =
    letterFocus == null ? [] : writable.filter((w) => w.includes(letterFocus));

  const out: string[] = [];
  for (let i = 0; i < words; i++) {
    const wantFocus = letterFocus != null && rnd() < FOCUS_SHARE;
    // An empty focus pool falls through to the syllable path below rather than
    // to the general word list, or the weak letter is silently skipped.
    const pool = wantFocus ? withFocus : writable;
    if (pool.length === 0) {
      // Either too few cells for real words yet, or the weak letter appears in
      // none of them — in which case a made-up syllable carrying it is the only
      // way to practise it at all, and drilling nothing is the worse option.
      let made = syllable([...letters], rnd);
      if (letterFocus != null && wantFocus && !made.includes(letterFocus)) {
        made = letterFocus + made;
      }
      out.push(made);
    } else {
      out.push(pool[Math.floor(rnd() * pool.length)]);
    }
  }

  // Then the signs, once the learner has them. The weak one is applied last so
  // that nothing else can overwrite the word it was put on.
  for (const sign of signsInPlay(set, focus)) {
    if (sign.key === focus || rnd() < SIGN_SHARE) {
      sign.apply(out, rnd, letters);
    }
  }
  return out.join(" ");
}
