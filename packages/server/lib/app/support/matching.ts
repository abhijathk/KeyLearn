/**
 * Keyword/phrase overlap scoring between a message and a set of
 * {@link AnswerRule} rows — no external NLP dependency, per the mock's own
 * design note: "keyword and phrase matching... no model, nothing sent
 * anywhere". Pure function, no I/O, so it's cheap to call on every keystroke
 * from the live-suggest endpoint as well as once per ticket submission.
 */

export type AnswerRuleInput = {
  readonly id: number;
  readonly answerId: number;
  /** Comma-or-newline-delimited keywords/phrases. */
  readonly keywords: string;
  readonly suggestOnly: boolean;
};

export type AnswerMatch = {
  readonly ruleId: number;
  readonly answerId: number;
  /** Fraction (0–1) of the rule's phrases found as substrings in the text. */
  readonly score: number;
};

function splitKeywords(keywords: string): string[] {
  return keywords
    .split(/[,\n]/)
    .map((phrase) => phrase.trim().toLowerCase())
    .filter((phrase) => phrase !== "");
}

/**
 * Scores every rule against `text` and returns the ones that matched at all
 * (`score > 0`), most confident first. A rule's score is the fraction of its
 * own keyword phrases that appear as substrings of the lower-cased text — a
 * rule with three phrases where two are present scores 2/3, independently of
 * how many other rules exist or how long `text` is.
 */
export function matchAnswers(
  text: string,
  rules: readonly AnswerRuleInput[],
): AnswerMatch[] {
  const haystack = text.toLowerCase();
  const results: AnswerMatch[] = [];
  for (const rule of rules) {
    const phrases = splitKeywords(rule.keywords);
    if (phrases.length === 0) {
      continue;
    }
    const hits = phrases.filter((phrase) => haystack.includes(phrase)).length;
    const score = hits / phrases.length;
    if (score > 0) {
      results.push({ ruleId: rule.id, answerId: rule.answerId, score });
    }
  }
  return results.sort((a, b) => b.score - a.score);
}
