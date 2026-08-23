/**
 * Parses a support reply into the blocks a chat bubble renders.
 *
 * ── Why this file exists in two repositories ──
 *
 * The customer reads Tab's reply in KeyLearn; staff read the same reply in
 * QDesk. If only one of them understands the markup, the other shows raw
 * text — `**Pause cursor on mistakes**` with the asterisks, an arrow path
 * as a grey run-on sentence. Worse than plain, because it looks broken.
 *
 * So the *parse* is shared and the *presentation* is not. This file
 * produces framework-free blocks and has no opinion about class names,
 * colours or markup; each app maps the blocks onto its own components. The
 * copy in `quakka-support-desk/packages/shared/lib/reply-format.ts` is byte-identical
 * and both repos test it against the same fixtures — if they ever drift,
 * a customer and the agent helping them are looking at different messages,
 * which is the one thing a support desk cannot afford.
 *
 * ── Why no markdown library ──
 *
 * A general markdown renderer accepts far more than Tab writes: images,
 * links, raw HTML, tables. Every one of those is a way for text that
 * originated in a model — or in a *customer's message quoted back* — to
 * become markup in someone's browser. This reads a closed, enumerated set
 * and treats everything else as plain text, which makes the attack surface
 * the whole story rather than a mitigation.
 *
 * ── What it recognises ──
 *
 * Four shapes are inferred from prose Tab was already writing:
 *
 *   **Bold**                        → a named control
 *   A → B → C  (own line, 3+)       → a path rail
 *   A → B  (inside a sentence)      → an inline crumb
 *   1. … 2. …                       → ordered steps
 *
 * The rest of the design sheet cannot be inferred — a checklist is not a
 * shape prose falls into, and guessing at one would mean promoting ordinary
 * sentences into chrome. Those are named, in one bracket form, always at
 * the start of a line:
 *
 *   [note] / [warn] / [danger]      → the three weights of callout
 *   [check] / [todo]                → a requirement checklist
 *   [on] / [off]                    → a toggle, shown at its target state
 *   [range 28 wpm | 10 | 60]        → a slider value
 *   [compare 45 | words | 38 | cpm] → two readings of one thing
 *   [quote]                         → their sentence, paraphrased back
 *   [echo] theirs | ours            → proof the message was read
 *   [source]                        → where the answer came from
 *   [sorted]                        → the resolution moment
 *   [reading] about 40 seconds      → expectation-setting
 *   ``` … ```                       → a sample of practice text or code
 *
 * and two that sit inside a sentence:
 *
 *   [stat 78 | day streak]          → a quantity from their own account
 *   [keys Ctrl + ←]                 → keys pressed together
 *
 * One recogniser, one bracket, a fixed keyword list. A bracket whose
 * keyword is not on the list is left alone, so the failure mode of a model
 * inventing `[banner]` is a customer reading the word "[banner]" — not a
 * new element appearing in someone's browser.
 *
 * Anything else is a paragraph. Unrecognised syntax degrades to the text
 * the customer would have read anyway.
 */

export type Span =
  | { readonly kind: "text"; readonly text: string }
  /** A control named on its own — rendered as a single keycap. */
  | { readonly kind: "control"; readonly text: string }
  /** A path mentioned mid-sentence — rendered as an inline crumb. */
  | { readonly kind: "crumb"; readonly segments: readonly string[] }
  /** A quantity from their own account, inside a sentence. */
  | { readonly kind: "stat"; readonly value: string; readonly unit: string }
  /** Keys pressed together — joined by a plus, never by an arrow. */
  | { readonly kind: "keys"; readonly keys: readonly string[] };

export type Block =
  | { readonly kind: "paragraph"; readonly spans: readonly Span[] }
  /** A path on its own line — rendered as the keycap rail. */
  | { readonly kind: "path"; readonly segments: readonly string[] }
  /** Ordered actions — rendered as the step rail. */
  | { readonly kind: "steps"; readonly items: readonly StepItem[] }
  /** A fact worth knowing, a thing to check, or a thing that cannot be undone. */
  | {
      readonly kind: "callout";
      readonly tone: CalloutTone;
      /** The bolded first clause, if there was one — drawn as the heading. */
      readonly heading: string | null;
      readonly spans: readonly Span[];
    }
  /** "Not yet, and here's what's left." */
  | { readonly kind: "checklist"; readonly items: readonly CheckItem[] }
  /** Switches shown at the state they should be in, not controls to press. */
  | { readonly kind: "toggles"; readonly items: readonly ToggleItem[] }
  /** A setting that is a number on a range. */
  | {
      readonly kind: "range";
      readonly name: string;
      readonly value: string;
      readonly min: string;
      readonly max: string;
    }
  /** Two measurements of the same thing, side by side. */
  | {
      readonly kind: "compare";
      readonly left: CompareSide;
      readonly right: CompareSide;
    }
  /** Their problem in fresh words, offered back for correction. */
  | { readonly kind: "quote"; readonly text: string }
  /** Their sentence, then ours — the difference made legible. */
  | {
      readonly kind: "echo";
      readonly theirs: string;
      readonly ours: readonly Span[];
    }
  /** Where the answer came from. */
  | { readonly kind: "source"; readonly text: string }
  /** The resolution moment: the one unhurried beat in the conversation. */
  | {
      readonly kind: "sorted";
      readonly title: string;
      readonly detail: string | null;
    }
  /** How long the reply ahead will take to read. */
  | { readonly kind: "reading"; readonly text: string }
  /** Practice text or code, shown rather than described. */
  | { readonly kind: "sample"; readonly text: string };

export type CalloutTone = "note" | "warn" | "danger";

export type StepItem = {
  readonly where: string;
  /** The trailing clause, if the step had one: "Open Practice — from the top nav". */
  readonly hint: string | null;
};

export type CheckItem = {
  readonly done: boolean;
  readonly text: string;
  /** A trailing count, if the requirement had one: "21 / 21". */
  readonly met: string | null;
};

export type ToggleItem = { readonly name: string; readonly on: boolean };

export type CompareSide = { readonly value: string; readonly label: string };

/**
 * How many arrow-joined segments make a line a path rather than a
 * sentence containing an arrow. Three is deliberate: "Practice → Settings"
 * appears inside prose often enough that promoting it to a full rail would
 * interrupt the reading, and that case is served by the inline crumb.
 */
const PATH_MIN_SEGMENTS = 3;

/** Arrows Tab actually writes, plus the ASCII fallback. */
const ARROW = /\s*(?:→|->|›)\s*/;

/**
 * Words that cannot appear inside a control's name, and therefore mark
 * the point where a path stops and the sentence resumes. Shared by the
 * rail and the crumb so the two can never disagree about where a name
 * ends. Deliberately short: real KeyLearn settings do contain "the",
 * "on", "as" and "at" ("A rest day keeps the streak"), so only the
 * joining words are listed.
 *
 * `look`, `open` and `under` are here for the rail's sake: a chunked bubble
 * is one short line, and "Look under Account → Preferences → Language &
 * region for it." is a whole line that is *almost* a path. Without them
 * the rail took it and the customer got two caps reading "Look under
 * Account" and "Language & region for it".
 *
 * The list stops there on purpose. Every word added to it is a word that
 * can no longer start a control name, and KeyLearn has real screens called
 * "Using the app" and "Being measured" — an earlier draft of this list
 * included "using" and cut five live replies off at "Account →
 * Accessibility", leaving a bare arrow in the sentence.
 */
const CONNECTIVE_WORDS = [
  "and",
  "then",
  "so",
  "but",
  "because",
  "by",
  "from",
  "after",
  "before",
  "with",
  "for",
  "which",
  "that",
  "turn",
  "switch",
  "select",
  "choose",
  "tap",
  "click",
  "set",
  "find",
  "scroll",
  "to",
  "look",
  "open",
  "under",
];

const CONNECTIVES = CONNECTIVE_WORDS.join("|");

/**
 * Words that may not END the last segment of a path.
 *
 * The final segment is the one place a lowercase word has to be allowed
 * through, because the name this whole system was built around is "Show
 * typing speed as". That permission is what let a German sentence lose its
 * verb into the chip: "Schau unter Konto → Präferenzen → Sprache nach."
 * put "nach" inside the breadcrumb, so the customer read a path to a
 * screen called "Sprache nach" and the sentence lost the word that told
 * them what to do.
 *
 * This is the narrow answer rather than the general one. A word list
 * cannot decide, across every language, whether a trailing lowercase word
 * belongs to a control name — "Show typing speed as" and "Sprache nach"
 * are the same shape. What it CAN do is name the small set of separable
 * particles that never end a name in the languages KeyLearn ships, and
 * leave every other language exactly as permissive as it was. English
 * loses nothing: none of these can trail an English control name either.
 */
const TRAILING_PARTICLES = [
  // German and Dutch separable-verb particles — the ones that strand at
  // the end of a clause and land immediately after the object.
  "nach",
  "an",
  "auf",
  "aus",
  "ein",
  "mit",
  "vor",
  "zu",
  "ab",
  "um",
  "her",
  "hin",
  "los",
  "weg",
  "bei",
  "durch",
  "über",
  "unter",
  "aan",
  "uit",
  "mee",
  "toe",
  "af",
  "op",
  // Nordic and Romance clause tails that behave the same way.
  "till",
  "fram",
  "igen",
  "ned",
  "opp",
  "inn",
  "ci",
  "vi",
  "ne",
  "y",
  "en",
];

const TRAILING_PARTICLE = new RegExp(
  `\\s+(?:${TRAILING_PARTICLES.join("|")})$`,
  "iu",
);

/**
 * Trims a particle that ended up inside the last name. Applied only to the
 * final segment, and never when it would empty the segment.
 */
function trimTrailingParticle(segment: string): string {
  const trimmed = segment.replace(TRAILING_PARTICLE, "");
  return trimmed.trim() === "" ? segment : trimmed;
}

/**
 * The same words, spelled so a case-sensitive pattern still catches the
 * sentence-initial form. "Open Account → …" is the common shape, and a
 * lowercase-only alternation reads `Open` as the start of a name.
 */
const CONNECTIVES_ANY = CONNECTIVE_WORDS.map(
  (w) => `[${w[0]}${w[0]!.toUpperCase()}]${w.slice(1)}`,
).join("|");

/**
 * The one place either treatment decides "this word ended the name".
 * Built from the list above so the rail and the crumb cannot drift — they
 * did, for a while, and the rail's shorter list is what let it swallow
 * the sentence around a path.
 */
const CONNECTIVE = new RegExp(`\\b(?:${CONNECTIVES})\\b`, "i");

const ORDERED_ITEM = /^\s*(\d{1,2})[.)]\s+(.*)$/;

/** Splits a step into what to do and the aside explaining it. */
const STEP_HINT = /\s+[—–-]\s+(.+)$/;

/**
 * A control name is bold text. Kept short and single-line on purpose —
 * `**` around a whole sentence is emphasis, not a control, and rendering
 * a paragraph as a keycap would be worse than dropping the asterisks.
 */
const BOLD = /\*\*([^*\n]{1,60})\*\*/g;

/**
 * Bold that is NOT a control: too long to be a name, or spanning a line
 * break. It still has to lose its asterisks.
 *
 * Leaving them was the documented behaviour and it was wrong. "Unrecognised
 * syntax degrades to the text the customer would have read anyway" — and
 * the text they would have read is the sentence, not the sentence wearing
 * four asterisks. A reply that shows its own markup reads as broken, which
 * is the one failure this file exists to prevent.
 */
const BOLD_RESIDUE = /\*\*(?=\S)([^*]{1,400}?)\*\*/gs;

/** Everything a `**` can mean, resolved: emphasis stripped, strays dropped. */
function stripBold(text: string): string {
  return text.replace(BOLD_RESIDUE, "$1").replace(/\*\*/g, "");
}

function trimSegments(line: string): string[] {
  return line
    .split(ARROW)
    .map((s) => stripBold(s).trim())
    .filter((s) => s !== "");
}

/**
 * What a control name may start with, and what it may be made of.
 *
 * The start test used to be `[A-Z]`, which is a test for "written in
 * English". A German path passed on its capitals; Greek, Cyrillic, Tamil,
 * Devanagari, Arabic, Han, Hangul and Thai ones did not, so a translated
 * reply showed its path as grey prose with arrow glyphs in it — the exact
 * failure the rail exists to prevent, reserved for the customers least
 * able to absorb it.
 *
 * `\p{Lu}` covers every cased script and still keeps "settings → display"
 * out. `\p{Lo}` is the uncased letter category — Han, Kana, Hangul, Tamil,
 * Devanagari, Arabic, Hebrew, Thai — where there is no capital to ask for
 * and refusing the script outright was the only alternative.
 *
 * `&`, `+` and `/` are name characters because KeyLearn ships names that
 * contain them: "Language & region", "Email & notifications",
 * "Words/Letters".
 *
 * `\p{M}` is not decoration. In Tamil, Devanagari, Arabic and Thai the
 * vowel signs and viramas inside an ordinary word are combining marks, so
 * a class of letters alone matches the first syllable of "கணக்கு" and then
 * stops. Leaving it out meant the crumb silently found nothing in exactly
 * the scripts the uncased-letter rule above was added to serve.
 */
const NAME_HEAD = String.raw`[\p{Lu}\p{Lo}]`;
const NAME_CHAR = String.raw`[\p{L}\p{M}\p{N}'’&+/-]`;

/** Does this segment read as a name rather than a run of prose? */
function looksNamed(segment: string): boolean {
  return new RegExp(NAME_HEAD, "u").test(segment);
}

/**
 * Is this whole line a path, rather than a sentence that mentions one?
 *
 * Requires the line to be *only* the path: a trailing clause ("… → Display
 * and turn it off") means the sentence continued, and the rail would
 * swallow the instruction. That case falls through to the crumb.
 */
function pathLine(line: string): readonly string[] | null {
  const bare = line.trim().replace(/[.:;]$/, "");
  if (!ARROW.test(bare)) {
    return null;
  }
  const segments = trimSegments(bare);
  if (segments.length < PATH_MIN_SEGMENTS) {
    return null;
  }
  // Every segment has to look like a control name rather than a clause.
  //
  // "Title Case and short" is not enough on its own, and the cases that
  // slip through are the ones that matter: "Open Account → Accessibility →
  // Being measured and turn it on." and "That one lives under Practice →
  // Settings → Display, by the way." Both are sentences, both would have
  // rendered as rails, and the rail would have swallowed the instruction
  // at the end — leaving the customer a path and no idea what to do on
  // arrival. Three signals separate a name from a clause:
  //
  //   · The lead-in is short. A path opens with an area ("Practice",
  //     "Account"), not with five words of sentence.
  //   · No commas. A comma inside a segment means the sentence carried on.
  //   · No prose connectives. Real control names contain "the", "on",
  //     "as", "while" — KeyLearn has "A rest day keeps the streak" — so
  //     only the joining words that cannot appear in a name are banned.
  //     This uses the SAME list the crumb uses. It used to keep a shorter
  //     private one, which is how "Look under Account → Preferences →
  //     Language & region for it." reached a customer as a rail.
  //   · No sentence punctuation. A comma, colon or semicolon inside a
  //     segment means the sentence carried on: "German: Konto → …" is a
  //     label and a path, and the rail used to serve it as one cap
  //     reading "German: Konto".
  const looksLikeClause = (s: string): boolean =>
    /[,:;?!]/.test(s) ||
    CONNECTIVE.test(s) ||
    s.split(/\s+/).length > 6 ||
    s.length > 44;

  if (segments.some(looksLikeClause)) {
    return null;
  }
  if (segments[0]!.split(/\s+/).length > 3) {
    return null;
  }
  // A lowercase word before the first arrow is prose leading INTO the path,
  // not part of the first name — "Schau unter Konto → Präferenzen" is a
  // German sentence, and the connective list cannot be expected to hold
  // every preposition in every language KeyLearn ships in. Real first
  // segments are areas: "Practice", "Account", "Text Input".
  if (
    segments[0]!
      .split(/\s+/)
      .slice(1)
      .some((w) => /^\p{Ll}/u.test(w))
  ) {
    return null;
  }
  // A stranded particle at the end means this was a clause, not a path.
  // Refused rather than trimmed: on a line that is nothing but the path,
  // trimming would drop the word instead of returning it to a sentence,
  // and the crumb below keeps it.
  const lastSegment = segments[segments.length - 1]!;
  if (trimTrailingParticle(lastSegment) !== lastSegment) {
    return null;
  }
  return segments.every(looksNamed) ? segments : null;
}

/**
 * Where the inline crumbs are in one run of text.
 *
 * ── Why this is a scan and not a pattern ──
 *
 * It was a pattern: one regex matching a whole arrow chain, with a
 * quantifier over segments and a quantifier over words inside each segment
 * and an alternation inside that. Three nested quantifiers over text that
 * mostly does not match is the classic shape of catastrophic backtracking,
 * and it duly arrived — 853ms to parse a single support reply, on the main
 * thread, which is a chat window that stops responding.
 *
 * Arrows are unambiguous, so there is no need to search for the chain at
 * all. Split on them, and the only open questions are at the two ends:
 * where the first name starts, and where the last one stops. Both are one
 * anchored match against one short part, and the work is linear in the
 * length of the text.
 *
 * ── What a segment may be ──
 *
 * A name may open on any uppercase letter or on a caseless script, and may
 * continue through `&`, `+` and `/` — KeyLearn ships "Language & region",
 * "Email & notifications" and "Words/Letters".
 *
 * The two ends fail in opposite directions, so they have different rules.
 * A segment with an arrow after it can only be spoiled from the LEFT
 * ("Change it in Account → …" once produced a chip starting "Change it in
 * Account"), so its continuation words must themselves look like part of a
 * name. The final segment can only be spoiled from the RIGHT, and it has
 * to keep taking lowercase words, because the name this whole system was
 * built around is "Show typing speed as".
 */
type CrumbChain = {
  readonly start: number;
  readonly end: number;
  readonly segments: readonly string[];
};

const ARROW_SCAN = /\s*(?:→|->|›)\s*/g;

/** A name with an arrow after it: continuation words must look like a name. */
const SEG_MID_SRC = String.raw`(?!(?:${CONNECTIVES_ANY})\b)${NAME_HEAD}${NAME_CHAR}*(?:\s+(?:(?!(?:${CONNECTIVES_ANY})\b)${NAME_HEAD}${NAME_CHAR}*|[&+/]\s*${NAME_CHAR}+)){0,3}`;
/** The last name in a chain: lowercase continuations allowed. */
const SEG_END_SRC = String.raw`(?!(?:${CONNECTIVES_ANY})\b)${NAME_HEAD}${NAME_CHAR}*(?:\s+(?!(?:${CONNECTIVES_ANY})\b)${NAME_CHAR}+){0,3}`;

const WHOLE_MID = new RegExp(`^${SEG_MID_SRC}$`, "u");
const TAIL_MID = new RegExp(`(?:^|\\s)(${SEG_MID_SRC})$`, "u");
const HEAD_END = new RegExp(`^(${SEG_END_SRC})`, "u");

function crumbChains(raw: string): readonly CrumbChain[] {
  // Parts, and the arrow that followed each. No arrows, no crumbs, and no
  // work — which is the common case for a sentence.
  const parts: { text: string; start: number; end: number }[] = [];
  ARROW_SCAN.lastIndex = 0;
  let cut = 0;
  let m: RegExpExecArray | null;
  while ((m = ARROW_SCAN.exec(raw)) != null) {
    parts.push({ text: raw.slice(cut, m.index), start: cut, end: m.index });
    cut = m.index + m[0].length;
  }
  if (parts.length === 0) {
    return [];
  }
  parts.push({ text: raw.slice(cut), start: cut, end: raw.length });

  const chains: CrumbChain[] = [];
  let i = 0;
  while (i < parts.length - 1) {
    // The first segment is whatever name ENDS the part before the arrow.
    const head = TAIL_MID.exec(parts[i]!.text);
    if (head == null) {
      i++;
      continue;
    }
    const segments = [head[1]!];
    const start = parts[i]!.end - head[1]!.length;

    // Interior parts are taken whole or not at all — a part that is not
    // purely a name is where the chain stops and the sentence resumes.
    let j = i + 1;
    while (j < parts.length - 1 && WHOLE_MID.test(parts[j]!.text.trim())) {
      segments.push(parts[j]!.text.trim());
      j++;
    }

    // The last segment is whatever name STARTS the part after the arrow.
    const tail = HEAD_END.exec(parts[j]!.text);
    if (tail == null) {
      i = j;
      continue;
    }
    // A stranded particle is handed back to the sentence rather than kept
    // in the chip.
    const lastText = trimTrailingParticle(tail[1]!);
    segments.push(lastText);
    chains.push({
      start,
      end: parts[j]!.start + lastText.length,
      segments,
    });
    i = j;
  }
  return chains;
}

/** Spans inside one paragraph: bold controls, inline crumbs, plain text. */
function spansOf(text: string): readonly Span[] {
  const spans: Span[] = [];
  let cursor = 0;

  const pushText = (input: string): void => {
    // Emphasis that was not a control still loses its asterisks, and loses
    // them before the crumb scanner runs — so the scanner reads the same
    // string the customer will.
    const raw = stripBold(input);
    if (raw === "") {
      return;
    }
    let last = 0;
    for (const chain of crumbChains(raw)) {
      if (chain.start > last) {
        spans.push({ kind: "text", text: raw.slice(last, chain.start) });
      }
      spans.push({ kind: "crumb", segments: chain.segments });
      last = chain.end;
    }
    if (last < raw.length) {
      spans.push({ kind: "text", text: raw.slice(last) });
    }
  };

  /**
   * The two inline directives, run before the crumb scanner so a stat's
   * own words can never be mistaken for a control name.
   *
   *   [stat 78 | day streak]   a quantity from their account
   *   [keys Ctrl + ←]          keys pressed together
   *
   * Anything else in brackets is left exactly as written.
   */
  const pushInline = (raw: string): void => {
    const INLINE = /\[(stat|keys)\s+([^\][\n]{1,80})\]/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = INLINE.exec(raw)) != null) {
      const body = m[2]!.trim();
      const span: Span | null =
        m[1] === "stat"
          ? statSpan(body)
          : // A plus is how a combo is written, because the arrow means
            // "then" and teaching the wrong gesture is worse than plain text.
            {
              kind: "keys",
              keys: body
                .split("+")
                .map((k) => k.trim())
                .filter((k) => k !== ""),
            };
      if (span == null || (span.kind === "keys" && span.keys.length < 2)) {
        continue;
      }
      pushText(raw.slice(last, m.index));
      spans.push(span);
      last = m.index + m[0].length;
    }
    pushText(raw.slice(last));
  };

  BOLD.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BOLD.exec(text)) != null) {
    pushInline(text.slice(cursor, match.index));
    spans.push({ kind: "control", text: match[1]!.trim() });
    cursor = match.index + match[0].length;
  }
  pushInline(text.slice(cursor));
  return spans;
}

/** `78 | day streak` — the number and what it counts. */
function statSpan(body: string): Span | null {
  const [value, ...rest] = body.split("|");
  if (value == null || value.trim() === "") {
    return null;
  }
  return { kind: "stat", value: value.trim(), unit: rest.join("|").trim() };
}

/**
 * Reply text → blocks.
 *
 * Total: any input produces output, and text that matches nothing comes
 * back as paragraphs. A parser on the reply path must never be able to
 * lose a sentence — a dropped line is a customer missing the step that
 * would have fixed their problem.
 */
export function parseReply(reply: string): readonly Block[] {
  const blocks: Block[] = [];
  const text = reply.replace(/\r\n/g, "\n");

  // Fenced samples are lifted out whole before anything else touches the
  // string. Everything inside a fence is content, not markup — a path or a
  // bracket in a code sample is part of the sample.
  const chunks = splitFences(text);

  for (const chunk of chunks) {
    if (chunk.fenced) {
      if (chunk.text.trim() !== "") {
        blocks.push({ kind: "sample", text: chunk.text.replace(/\n+$/, "") });
      }
      continue;
    }

    for (const para of chunk.text.split(/\n{2,}/)) {
      const lines = para.split("\n").filter((l) => l.trim() !== "");
      if (lines.length === 0) {
        continue;
      }

      // A run of numbered lines is a step rail. Collected across the whole
      // paragraph so "1. …\n2. …\n3. …" stays one block.
      const numbered = lines.filter((l) => ORDERED_ITEM.test(l));
      if (numbered.length >= 2 && numbered.length === lines.length) {
        blocks.push({
          kind: "steps",
          items: numbered.map((line) => {
            const body = ORDERED_ITEM.exec(line)![2]!.trim();
            const hint = STEP_HINT.exec(body);
            return {
              where: stripBold(
                hint == null ? body : body.slice(0, hint.index),
              ).trim(),
              hint: hint == null ? null : stripBold(hint[1]!).trim(),
            };
          }),
        });
        continue;
      }

      // Directive lines are read as a run, so consecutive `[check]`s become
      // one checklist and consecutive `[on]`/`[off]`s one switch group —
      // four separate checklists of one item each is not a checklist.
      let i = 0;
      while (i < lines.length) {
        const consumed = readDirectiveRun(lines, i, blocks);
        if (consumed > 0) {
          i += consumed;
          continue;
        }
        const line = lines[i]!;
        const segments = pathLine(line);
        if (segments != null) {
          blocks.push({ kind: "path", segments });
        } else {
          blocks.push({ kind: "paragraph", spans: spansOf(line) });
        }
        i++;
      }
    }
  }

  // An empty reply is not a thing that should reach here, but if it does,
  // render nothing rather than an empty bubble.
  return blocks;
}

/** ``` fences, kept intact and marked. */
function splitFences(text: string): { fenced: boolean; text: string }[] {
  const out: { fenced: boolean; text: string }[] = [];
  const FENCE = /^[ \t]*```[^\n]*\n([\s\S]*?)^[ \t]*```[ \t]*$/gm;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = FENCE.exec(text)) != null) {
    out.push({ fenced: false, text: text.slice(last, m.index) });
    out.push({ fenced: true, text: m[1]! });
    last = m.index + m[0].length;
  }
  out.push({ fenced: false, text: text.slice(last) });
  return out;
}

/**
 * The closed list of block keywords. A bracket whose keyword is not here is
 * not a directive, and its line is read as ordinary prose — so a model that
 * invents `[banner]` produces the text "[banner]", never an element.
 */
const DIRECTIVE =
  /^\s*\[(note|warn|danger|check|todo|on|off|range|compare|quote|echo|source|sorted|reading)\b([^\][\n]*)\]\s*(.*)$/;

/** Splits a directive body on the pipe its arguments are separated by. */
function fields(body: string): string[] {
  return body.split("|").map((f) => f.trim());
}

/**
 * Reads one directive, or one run of the two that group, starting at
 * `from`. Returns how many lines were consumed — zero when the line is not
 * a directive at all.
 */
function readDirectiveRun(
  lines: readonly string[],
  from: number,
  out: Block[],
): number {
  const first = DIRECTIVE.exec(lines[from]!);
  if (first == null) {
    return 0;
  }
  const keyword = first[1]!;
  const args = first[2]!.trim();
  const rest = first[3]!.trim();

  // ── The two that group ──
  if (keyword === "check" || keyword === "todo") {
    const items: CheckItem[] = [];
    let n = from;
    for (; n < lines.length; n++) {
      const m = DIRECTIVE.exec(lines[n]!);
      if (m == null || (m[1] !== "check" && m[1] !== "todo")) break;
      const body = stripBold(m[3]!.trim());
      // A trailing "(21 / 21)" is the count, drawn quietly beside the text.
      const met = /\(([^()]{1,24})\)\s*$/.exec(body);
      items.push({
        done: m[1] === "check",
        text: (met == null ? body : body.slice(0, met.index)).trim(),
        met: met == null ? null : met[1]!.trim(),
      });
    }
    if (items.length === 0) return 0;
    out.push({ kind: "checklist", items });
    return n - from;
  }

  if (keyword === "on" || keyword === "off") {
    const items: ToggleItem[] = [];
    let n = from;
    for (; n < lines.length; n++) {
      const m = DIRECTIVE.exec(lines[n]!);
      if (m == null || (m[1] !== "on" && m[1] !== "off")) break;
      const name = stripBold(m[3]!.trim());
      if (name === "") break;
      items.push({ name, on: m[1] === "on" });
    }
    if (items.length === 0) return 0;
    out.push({ kind: "toggles", items });
    return n - from;
  }

  // ── One line, one block ──
  switch (keyword) {
    case "note":
    case "warn":
    case "danger": {
      if (rest === "") return 0;
      // A bold opening clause is the heading; the rest is the body.
      const head = /^\*\*([^*\n]{1,60})\*\*\s*/.exec(rest);
      const body = head == null ? rest : rest.slice(head[0].length);
      out.push({
        kind: "callout",
        tone: keyword,
        heading: head == null ? null : head[1]!.trim(),
        spans: spansOf(body),
      });
      return 1;
    }
    case "range": {
      const [value, min, max] = fields(args);
      if (rest === "" || value == null || value === "") return 0;
      out.push({
        kind: "range",
        name: stripBold(rest),
        value,
        min: min ?? "",
        max: max ?? "",
      });
      return 1;
    }
    case "compare": {
      const [lv, ll, rv, rl] = fields(args);
      if (lv == null || lv === "" || rv == null || rv === "") return 0;
      out.push({
        kind: "compare",
        left: { value: lv, label: ll ?? "" },
        right: { value: rv, label: rl ?? "" },
      });
      return 1;
    }
    case "quote": {
      if (rest === "") return 0;
      out.push({ kind: "quote", text: stripBold(rest) });
      return 1;
    }
    case "echo": {
      const [theirs, ...ours] = rest.split("|");
      const said = (theirs ?? "").trim();
      const back = ours.join("|").trim();
      if (said === "" || back === "") return 0;
      out.push({ kind: "echo", theirs: stripBold(said), ours: spansOf(back) });
      return 1;
    }
    case "source": {
      if (rest === "") return 0;
      out.push({ kind: "source", text: stripBold(rest) });
      return 1;
    }
    case "sorted": {
      if (rest === "") return 0;
      const [title, ...detail] = rest.split("|");
      out.push({
        kind: "sorted",
        title: stripBold((title ?? "").trim()),
        detail:
          detail.length === 0
            ? null
            : stripBold(detail.join("|").trim()) || null,
      });
      return 1;
    }
    case "reading": {
      const label = `${args} ${rest}`.trim();
      if (label === "") return 0;
      out.push({ kind: "reading", text: stripBold(label) });
      return 1;
    }
  }
  return 0;
}

/**
 * The plain-text reading of a parsed reply.
 *
 * Used by anything that must not render: notification previews, the email
 * copy, the handoff packet a human reads. Deriving it from the blocks
 * rather than the raw string means the fallback can never disagree with
 * what was displayed.
 */
export function plainText(blocks: readonly Block[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case "path":
          return b.segments.join(" → ");
        case "steps":
          return b.items
            .map(
              (s, i) =>
                `${i + 1}. ${s.where}${s.hint == null ? "" : ` — ${s.hint}`}`,
            )
            .join("\n");
        case "paragraph":
          return spansText(b.spans);
        case "callout":
          return b.heading == null
            ? spansText(b.spans)
            : `${b.heading} — ${spansText(b.spans)}`;
        case "checklist":
          // The mark carries the state. An email that lists four requirements
          // with no way to tell which are met is worse than no list.
          return b.items
            .map(
              (i) =>
                `${i.done ? "✓" : "○"} ${i.text}${i.met == null ? "" : ` (${i.met})`}`,
            )
            .join("\n");
        case "toggles":
          return b.items
            .map((i) => `${i.name}: ${i.on ? "on" : "off"}`)
            .join("\n");
        case "range":
          return `${b.name}: ${b.value}${b.min === "" && b.max === "" ? "" : ` (${b.min}–${b.max})`}`;
        case "compare":
          return `${b.left.value} ${b.left.label} vs ${b.right.value} ${b.right.label}`;
        case "quote":
          return `“${b.text}”`;
        case "echo":
          return `“${b.theirs}” — ${spansText(b.ours)}`;
        case "source":
          return b.text;
        case "sorted":
          return b.detail == null ? b.title : `${b.title} ${b.detail}`;
        case "reading":
          return b.text;
        case "sample":
          return b.text;
      }
    })
    .join("\n\n");
}

function spansText(spans: readonly Span[]): string {
  return spans
    .map((s) => {
      switch (s.kind) {
        case "crumb":
          return s.segments.join(" → ");
        case "keys":
          return s.keys.join(" + ");
        case "stat":
          return s.unit === "" ? s.value : `${s.value} ${s.unit}`;
        default:
          return s.text;
      }
    })
    .join("");
}
