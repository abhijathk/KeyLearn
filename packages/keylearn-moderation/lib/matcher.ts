import {
  englishDataset,
  englishRecommendedTransformers,
  RegExpMatcher,
} from "obscenity";
import { type Span } from "./types.ts";

/**
 * The profanity matcher, and the one place its configuration is decided.
 *
 * Obscenity's recommended transformers fold leetspeak, confusables and repeated
 * letters, so `sh1t` and `fuuuuuck` are caught without anyone listing the
 * variants, and its whitelist keeps "Scunthorpe", "assassin" and "analysis"
 * out of trouble.
 *
 * What it deliberately does NOT do is ignore punctuation, so `f.u.c.k` and
 * `f u c k` go straight through. The obvious fix — adding
 * `skipNonAlphabeticTransformer` — was tried and rejected: stripping separators
 * from the whole message also welds neighbouring words together, and
 * "the analysis was hard" becomes "theanalysiswashard", in which `anal` matches
 * across the join at an offset the whitelist cannot rescue. Measured, not
 * guessed.
 *
 * So separator evasion is handled by {@link findProfanity} instead, which
 * collapses only the runs that look deliberately spaced out. Ordinary prose
 * never looks like that, because ordinary words are longer than one letter.
 */
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

/**
 * Words that are not merely rude but abusive. These are withheld rather than
 * blurred and count double, because "please be nicer" is the wrong response.
 */
const ABUSIVE = new Set(["nigger", "cunt", "faggot", "whore", "rape"]);

/**
 * A run of single letters held apart by punctuation or spaces — `f.u.c.k`,
 * `f u c k`, `f-u-c-k`. Four or more, so ordinary text ("I a m" is rare, "a b"
 * commoner) does not qualify, and initialisms like "U.S.A." are too short.
 */
const SPACED = /[a-z](?:[^a-z0-9]{1,3}[a-z]){3,}/gi;

export type Found = {
  readonly span: Span;
  readonly word: string;
  readonly abusive: boolean;
};

function look(text: string): { word: string; span: Span }[] {
  const out: { word: string; span: Span }[] = [];
  for (const match of matcher.getAllMatches(text, true)) {
    const word =
      englishDataset.getPayloadWithPhraseMetadata(match).phraseMetadata
        ?.originalWord ?? "";
    // endIndex is inclusive in obscenity; everything else here, and
    // String.prototype.slice, works with half-open ranges.
    out.push({ word, span: [match.startIndex, match.endIndex + 1] });
  }
  return out;
}

/**
 * Every profanity in the text, de-duplicated and in reading order.
 *
 * Obscenity can report one span several times when more than one pattern
 * describes the same word — `sh1t` matches twice — which would otherwise draw
 * two blurs on top of each other.
 */
export function findProfanity(text: string): readonly Found[] {
  const byKey = new Map<string, Found>();

  const add = (word: string, span: Span) => {
    const key = `${span[0]}:${span[1]}`;
    const prev = byKey.get(key);
    const abusive = ABUSIVE.has(word);
    // Keep the worse reading, so a span that is both listed and abusive is
    // treated as abusive.
    if (prev == null || (!prev.abusive && abusive)) {
      byKey.set(key, { span, word, abusive });
    }
  };

  for (const { word, span } of look(text)) {
    add(word, span);
  }

  // Second pass: only over runs that were plainly spaced out on purpose. The
  // whole run is flagged, because the separators are part of the word as far as
  // a reader is concerned.
  for (const run of text.matchAll(SPACED)) {
    const at = run.index ?? 0;
    const collapsed = run[0].replace(/[^a-z0-9]/gi, "");
    for (const { word } of look(collapsed)) {
      add(word, [at, at + run[0].length]);
    }
  }

  return [...byKey.values()].sort((a, b) => a.span[0] - b.span[0]);
}
