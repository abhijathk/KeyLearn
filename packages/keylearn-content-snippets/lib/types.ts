/**
 * A piece of real code, written to be typed.
 *
 * Generated code can teach character sequences and nothing else — nobody ever
 * learned anything from `type float64 struct { }`. These are authored instead:
 * each one is a complete, working, idiomatic unit, so the practice that builds
 * typing speed also builds familiarity with the API and the house style.
 *
 * Authored rather than taken from real repositories on purpose. Permissive
 * licences still carry attribution obligations, reformatting a file to a
 * different style makes a derivative work rather than an unencumbered one, and
 * code lifted out of its project rarely stands alone. Writing them means the
 * difficulty can be sequenced and the awkward characters guaranteed.
 */
export type Snippet = {
  /** Stable, unique, and used to remember what a learner has already seen. */
  readonly id: string;
  /** What the learner is meant to take away, in a few words. */
  readonly title: string;
  /**
   * The code. Real newlines and real indentation: the shape of the standard is
   * most of what is being taught, and it cannot be shown on one line.
   */
  readonly code: string;
  /**
   * Roughly how hard this is to type and to understand, 1 to 5. The corpus is
   * meant to be worked through, not shuffled.
   */
  readonly level: 1 | 2 | 3 | 4 | 5;
  /** For grouping and for choosing what to practise next. */
  readonly tags: readonly string[];
  /**
   * What this fragment is, for the formatter's benefit. Defaults to `"unit"`.
   *
   * Python and JavaScript will parse a bare statement, so their corpora never
   * need this. Java will not — it has no top-level statements — and a snippet
   * showing three lines of a test method is far more useful than the same
   * three lines buried in a class nobody wanted to type. The gate wraps the
   * fragment before formatting and unwraps it afterwards, so the snippet stays
   * short and the check stays real.
   */
  readonly scope?: Scope;
};

/**
 * Where a snippet would sit in a real source file.
 *
 * `unit` is a whole file, `member` belongs inside a class body, and
 * `statement` inside a method body.
 */
export type Scope = "unit" | "member" | "statement";

export type SnippetSet = {
  /** Matches the `Syntax` id in `@keylearn/code`, so settings can line up. */
  readonly syntax: string;
  /**
   * What the learner would call this: "Playwright", "Selenium".
   *
   * Several corpora can share one, and that is the point — Selenium is one
   * thing to choose and then a language to write it in, not two unrelated
   * entries a third of the way apart in an alphabetical list.
   */
  readonly framework: string;
  /** The language this corpus is written in, within that framework. */
  readonly language: string;
  /**
   * The parts of the corpus a learner can switch on and off, in the order they
   * are best met.
   *
   * The grammar-backed languages have toggles for capitals, comments and the
   * like; a written corpus has no such knobs, but it does have subject matter,
   * and "just the assertions today" is a more useful thing to ask for than
   * "just the string literals". Each one names a tag its snippets carry.
   */
  readonly topics: readonly Topic[];
  /** Shown on the practice page, quietly. */
  readonly standard: StandardName;
  /**
   * The command that decides whether these snippets really do follow the
   * standard. Run over every snippet in CI; a diff is a failing test.
   *
   * Without it "learn the standard while you type" is a claim rather than a
   * guarantee, and a near-miss drilled into muscle memory is worse than
   * teaching nothing at all.
   */
  readonly formatter: FormatterCheck;
  /**
   * How a line comment opens in this language. Used to take the comments out
   * when the learner would rather type only the code.
   */
  readonly lineComment: readonly string[];
  /** Which lexicon colours this corpus. See `highlight.ts`. */
  readonly lexicon: Lexicon;
  /**
   * True where the language's own standard indents with tab characters.
   *
   * Only Go, and it is not negotiable there: gofmt has emitted tabs since the
   * first release and will not be argued with. Everything else here uses
   * spaces, and the corpus test holds them to it — a stray tab in a Python
   * snippet is a defect, and in a Go one it is the point.
   */
  readonly indentsWithTabs?: boolean;
  readonly snippets: readonly Snippet[];
};

import { type Lexicon } from "./highlight.ts";

export type Topic = {
  /** The tag this topic selects, and the id the setting stores. */
  readonly id: string;
  readonly name: string;
};

export type StandardName = string;

export type FormatterCheck = {
  /** Executable, looked up on PATH. Skipped with a warning when absent. */
  readonly command: string;
  /** Arguments; the snippet arrives on stdin and formatted code on stdout. */
  readonly args: readonly string[];
  /** Extension for the temporary file, when the tool insists on a real path. */
  readonly extension: string;
  /**
   * How to make a fragment parseable, per scope. Only needed by a language
   * that refuses to parse one — see `Snippet.scope`.
   */
  readonly wrap?: Partial<Record<Exclude<Scope, "unit">, FormatterWrap>>;
};

export type FormatterWrap = {
  /** Put before the snippet, on its own lines. */
  readonly before: string;
  /** Put after it. */
  readonly after: string;
  /**
   * The exact prefix the formatter will put on each wrapped line — two spaces,
   * four, or a tab. Removed again before comparing, so the snippet is judged
   * at column zero.
   *
   * A string rather than a count because Go indents with tabs and gofmt will
   * not be talked out of it.
   */
  readonly indent: string;
};
