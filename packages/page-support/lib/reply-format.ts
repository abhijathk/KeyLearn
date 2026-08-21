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
 * become markup in someone's browser. This reads exactly four things and
 * treats everything else as plain text, which makes the attack surface the
 * whole story rather than a mitigation.
 *
 * ── What it recognises ──
 *
 *   **Bold**                        → a named control
 *   A → B → C  (own line, 3+)       → a path rail
 *   A → B  (inside a sentence)      → an inline crumb
 *   1. … 2. …                       → ordered steps
 *
 * Anything else is a paragraph. Unrecognised syntax degrades to the text
 * the customer would have read anyway.
 */

export type Span =
  | { readonly kind: "text"; readonly text: string }
  /** A control named on its own — rendered as a single keycap. */
  | { readonly kind: "control"; readonly text: string }
  /** A path mentioned mid-sentence — rendered as an inline crumb. */
  | { readonly kind: "crumb"; readonly segments: readonly string[] };

export type Block =
  | { readonly kind: "paragraph"; readonly spans: readonly Span[] }
  /** A path on its own line — rendered as the keycap rail. */
  | { readonly kind: "path"; readonly segments: readonly string[] }
  /** Ordered actions — rendered as the step rail. */
  | { readonly kind: "steps"; readonly items: readonly StepItem[] };

export type StepItem = {
  readonly where: string;
  /** The trailing clause, if the step had one: "Open Practice — from the top nav". */
  readonly hint: string | null;
};

/**
 * How many arrow-joined segments make a line a path rather than a
 * sentence containing an arrow. Three is deliberate: "Practice → Settings"
 * appears inside prose often enough that promoting it to a full rail would
 * interrupt the reading, and that case is served by the inline crumb.
 */
const PATH_MIN_SEGMENTS = 3;

/** Arrows Tab actually writes, plus the ASCII fallback. */
const ARROW = /\s*(?:→|->|›)\s*/;

const ORDERED_ITEM = /^\s*(\d{1,2})[.)]\s+(.*)$/;

/** Splits a step into what to do and the aside explaining it. */
const STEP_HINT = /\s+[—–-]\s+(.+)$/;

/**
 * A control name is bold text. Kept short and single-line on purpose —
 * `**` around a whole sentence is emphasis, not a control, and rendering
 * a paragraph as a keycap would be worse than leaving the asterisks in.
 */
const BOLD = /\*\*([^*\n]{1,60})\*\*/g;

function trimSegments(line: string): string[] {
  return line
    .split(ARROW)
    .map((s) => s.replace(/\*\*/g, "").trim())
    .filter((s) => s !== "");
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
  const CONNECTIVE = /\b(?:and|then|so|but|because|by|from|after|before)\b/i;
  const looksLikeClause = (s: string): boolean =>
    s.includes(",") ||
    CONNECTIVE.test(s) ||
    s.split(/\s+/).length > 6 ||
    s.length > 44;

  if (segments.some(looksLikeClause)) {
    return null;
  }
  if (segments[0]!.split(/\s+/).length > 3) {
    return null;
  }
  return segments.every((s) => /[A-Z]/.test(s)) ? segments : null;
}

/** Spans inside one paragraph: bold controls, inline crumbs, plain text. */
function spansOf(text: string): readonly Span[] {
  const spans: Span[] = [];
  let cursor = 0;

  const pushText = (raw: string): void => {
    if (raw === "") {
      return;
    }
    // Inline crumbs: a short arrow chain sitting inside a sentence.
    let last = 0;
    const inline =
      /(?:[A-Z][\w'’ ]{0,30})(?:\s*(?:→|->|›)\s*[A-Z][\w'’ ]{0,30}){1,5}/g;
    let m: RegExpExecArray | null;
    while ((m = inline.exec(raw)) != null) {
      if (m.index > last) {
        spans.push({ kind: "text", text: raw.slice(last, m.index) });
      }
      spans.push({ kind: "crumb", segments: trimSegments(m[0]) });
      last = m.index + m[0].length;
    }
    if (last < raw.length) {
      spans.push({ kind: "text", text: raw.slice(last) });
    }
  };

  BOLD.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BOLD.exec(text)) != null) {
    pushText(text.slice(cursor, match.index));
    spans.push({ kind: "control", text: match[1]!.trim() });
    cursor = match.index + match[0].length;
  }
  pushText(text.slice(cursor));
  return spans;
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
  const paragraphs = reply.replace(/\r\n/g, "\n").split(/\n{2,}/);

  for (const para of paragraphs) {
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
            where: (hint == null ? body : body.slice(0, hint.index))
              .replace(/\*\*/g, "")
              .trim(),
            hint: hint == null ? null : hint[1]!.replace(/\*\*/g, "").trim(),
          };
        }),
      });
      continue;
    }

    for (const line of lines) {
      const segments = pathLine(line);
      if (segments != null) {
        blocks.push({ kind: "path", segments });
      } else {
        blocks.push({ kind: "paragraph", spans: spansOf(line) });
      }
    }
  }

  // An empty reply is not a thing that should reach here, but if it does,
  // render nothing rather than an empty bubble.
  return blocks;
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
          return b.spans
            .map((s) => (s.kind === "crumb" ? s.segments.join(" → ") : s.text))
            .join("");
      }
    })
    .join("\n\n");
}
