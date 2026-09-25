import { renderMessageText } from "@keylearn/widget";
import { type CSSProperties, type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import { replyAccentStyle, useReplyAccent } from "./reply-accent.ts";
import {
  type Block,
  type CalloutTone,
  parseReply,
  type Span,
} from "./reply-format.ts";
import * as styles from "./ReplyBody.module.less";

/**
 * A support reply, rendered.
 *
 * Tab names a path in most of its answers, and as plain text that path is
 * a grey sentence the eye slides off — read by somebody holding a phone in
 * one hand and hunting a screen with the other. It is the single most
 * operational thing in the message and it looked like prose.
 *
 * So a path becomes keycaps. Not generic chips: this is a typing tutor,
 * the app already draws a keyboard on screen and presses its keys, and the
 * customer has spent a week looking at exactly that shape. The visual
 * language is one they already learned from the product.
 *
 * ── Why this exists on both sides ──
 *
 * QDesk renders the same reply for the staff member reading the thread. If
 * only one side understood the markup the other would show
 * `**Pause cursor on mistakes**` with the asterisks visible — worse than
 * plain, because it looks broken. The parse is shared (`reply-format.ts`,
 * a twin of the file in QDesk, tested against the same fixtures); only
 * this presentation layer is local.
 *
 * ── Why only agent replies ──
 *
 * Applied to what the desk writes, never to what the customer writes. A
 * customer who types asterisks or an arrow means asterisks and an arrow,
 * and promoting their own words into product chrome would put KeyLearn's
 * voice in their mouth.
 *
 * Text still passes through {@link renderMessageText}, so date markers and
 * emoji keep working exactly as before — this adds structure around that
 * rather than replacing it.
 *
 * ── The [ask] buttons ──
 *
 * `onAsk` fires with the option's own text — the caller sends it through
 * exactly the same path a typed reply takes (no new endpoint). This stays
 * presentational: whether the buttons are live at all is the caller's
 * call (`askLive`), because that depends on the position of this message
 * in the whole thread and on the outbox, neither of which this component
 * can see. `askAnswer` is the customer's own next message, if there is
 * one, so an inert question can still show which option they picked.
 */
export function ReplyBody({
  text,
  locale,
  onAsk,
  askLive = false,
  askAnswer = null,
}: {
  readonly text: string;
  readonly locale?: string;
  /** Called with the option's text when a live [ask] button is tapped. */
  readonly onAsk?: (option: string) => void;
  /** Whether an [ask] block in this particular reply may still be answered. */
  readonly askLive?: boolean;
  /** The customer's next message after this one, if any — for marking which
   *  option they chose once the question is no longer live. */
  readonly askAnswer?: string | null;
}): ReactNode {
  // Read before the early return below: a hook must run on every render,
  // whatever the parser made of this particular reply.
  const accent = useReplyAccent();
  const blocks = parseReply(text);
  // Nothing recognised, or nothing there: fall all the way back. A reply
  // must always render, whatever the parser made of it.
  if (blocks.length === 0) {
    return renderMessageText(text, undefined, locale);
  }
  return (
    // The control centre's reply accent (Settings → Replies), as CSS
    // custom properties every block below reads — see
    // ReplyBody.module.less for `--reply-accent`/`--reply-accent-ink`.
    // dir="auto": the words' own script decides, not the page's — an English
    // reply in an Arabic page otherwise ends ". …look further".
    <div
      className={styles.root}
      dir="auto"
      data-accent={accent}
      style={replyAccentStyle(accent)}
    >
      {renderBlocks(blocks, { locale, onAsk, askLive, askAnswer })}
    </div>
  );
}

type BlockContext = {
  readonly locale?: string;
  readonly onAsk?: (option: string) => void;
  readonly askLive: boolean;
  readonly askAnswer: string | null;
};

/**
 * Blocks in order, with one lookahead: a `nope` immediately followed by a
 * `path` or `steps` absorbs it as "the closest thing" rather than letting
 * it repeat right below as its own, unlabelled rail — the pairing the
 * parser leaves to the renderer to notice, since the block stream itself
 * has no concept of "belongs to the refusal above it".
 */
function renderBlocks(
  blocks: readonly Block[],
  ctx: BlockContext,
): readonly ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i]!;
    if (block.kind === "nope") {
      const next = blocks[i + 1];
      const nested =
        next != null && (next.kind === "path" || next.kind === "steps")
          ? next
          : null;
      out.push(
        <NopeCard key={i} block={block} nested={nested} locale={ctx.locale} />,
      );
      i += nested != null ? 2 : 1;
      continue;
    }
    out.push(<BlockView key={i} block={block} {...ctx} />);
    i += 1;
  }
  return out;
}

function BlockView({
  block,
  locale,
  onAsk,
  askLive,
  askAnswer,
}: {
  readonly block: Block;
} & BlockContext): ReactNode {
  switch (block.kind) {
    case "path":
      return <PathRail segments={block.segments} />;

    case "steps":
      return <StepsList block={block} />;

    case "paragraph":
      return (
        <p className={styles.para}>
          {block.spans.map((span, i) => (
            <SpanView key={i} span={span} locale={locale} />
          ))}
        </p>
      );

    // ── The three weights of note ───────────────────────────────────
    // Not interchangeable. `danger` is reserved for what cannot be undone;
    // spent anywhere else it stops working on the day it matters.
    case "callout":
      return (
        <div
          className={`${styles.callout} ${CALLOUT_CLASS[block.tone]}`}
          role={block.tone === "note" ? undefined : "note"}
        >
          <CalloutIcon tone={block.tone} />
          <p className={styles.calloutBody}>
            {block.heading != null && (
              <span className={styles.calloutHead}>{block.heading}</span>
            )}
            {block.tone === "danger" && (
              <span className={styles.calloutTag}>
                <FormattedMessage
                  id="support.reply.cantBeUndone"
                  defaultMessage="Can’t be undone"
                />
              </span>
            )}
            {block.spans.map((span, i) => (
              <SpanView key={i} span={span} locale={locale} />
            ))}
          </p>
        </div>
      );

    // A ring for how far along, so the count lands before the list is even
    // read; ticked items fade back so the next one stands out.
    case "checklist": {
      const done = block.items.filter((item) => item.done).length;
      return (
        <div className={styles.checklistRow}>
          <ChecklistRing done={done} total={block.items.length} />
          <ul className={styles.checklist}>
            {block.items.map((item, i) => (
              <li
                key={i}
                className={
                  item.done
                    ? `${styles.check} ${styles.checkDone}`
                    : styles.check
                }
              >
                <span className={styles.checkBox} aria-hidden={true}>
                  {item.done && (
                    <TickGlyph
                      viewBox="0 0 12 12"
                      d="M2.5 6.2 4.8 8.5 9.5 3.8"
                    />
                  )}
                </span>
                <span className={styles.checkText}>
                  {item.text}
                  {item.met != null && (
                    <span className={styles.checkMet}>{item.met}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    // A switch shown at the state it should be in — never one to press
    // here. A control that looks operable and is not is a small betrayal.
    // The word carries the state: On/Off in text, never colour alone.
    case "toggles":
      return (
        <div className={styles.toggles}>
          {block.items.map((item, i) => (
            <div className={styles.toggleRow} key={i}>
              <span className={styles.toggleName}>{item.name}</span>
              <span className={styles.toggleState}>
                <span
                  className={
                    item.on
                      ? `${styles.switch} ${styles.switchOn}`
                      : styles.switch
                  }
                  aria-hidden={true}
                />
                <span className={styles.switchLabel}>
                  {item.on ? (
                    <FormattedMessage
                      id="support.reply.on"
                      defaultMessage="On"
                    />
                  ) : (
                    <FormattedMessage
                      id="support.reply.off"
                      defaultMessage="Off"
                    />
                  )}
                </span>
              </span>
            </div>
          ))}
        </div>
      );

    case "range":
      return <RangeView block={block} />;

    case "compare":
      return <CompareView block={block} />;

    case "quote":
      return <p className={styles.quoteBack}>{block.text}</p>;

    // Their sentence, then ours. Showing both is what makes the difference
    // between reading a message and receiving one legible.
    case "echo":
      return (
        <div className={styles.echo}>
          <p className={styles.echoTheirs}>{`“${block.theirs}”`}</p>
          <p className={styles.echoOurs}>
            {block.ours.map((span, i) => (
              <SpanView key={i} span={span} locale={locale} />
            ))}
          </p>
        </div>
      );

    case "source":
      return (
        <span className={styles.sourceChip}>
          <svg viewBox="0 0 16 16" aria-hidden={true} focusable={false}>
            <path
              d="M4 2.5h5.5L12 5v8.5H4zM9.5 2.5V5H12"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            />
          </svg>
          {block.text}
        </span>
      );

    // The end of a conversation is what gets remembered, so it is the one
    // place a little warmth is spent freely — and nothing is asked after it.
    case "sorted":
      return (
        <div className={styles.sorted}>
          <span className={styles.sortedTick} aria-hidden={true}>
            <TickGlyph viewBox="0 0 16 16" d="M3.6 8.4 6.6 11.4 12.4 5" />
          </span>
          <span className={styles.sortedText}>
            <b>{block.title}</b>
            {block.detail != null && <span>{block.detail}</span>}
          </span>
        </div>
      );

    case "reading":
      return (
        <span className={styles.readTime}>
          <svg viewBox="0 0 16 16" aria-hidden={true} focusable={false}>
            <circle
              cx="8"
              cy="8"
              r="6"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            />
            <path
              d="M8 4.6V8l2.4 1.6"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            />
          </svg>
          {block.text}
        </span>
      );

    // Shown, not described. `white-space: pre` in the stylesheet, so the
    // indentation the sample depends on survives.
    case "sample":
      return <pre className={styles.sample}>{block.text}</pre>;

    // A run of diagnosis lines: what might be true, and what to do.
    case "causes":
      return (
        <ol className={styles.causes}>
          {block.items.map((item, i) => (
            <li key={i} className={styles.causeRow}>
              <span className={styles.causeLetter} aria-hidden={true}>
                {String.fromCharCode(65 + (i % 26))}
              </span>
              <div>
                <span className={styles.causeWhen}>{item.when}</span>
                {item.fix != null && (
                  <span className={styles.causeFix}>
                    {item.fix.map((span, j) => (
                      <SpanView key={j} span={span} locale={locale} />
                    ))}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      );

    // Intercepted by `renderBlocks` above, which pairs it with a following
    // route or step list. This is only reached if a `nope` ever arrives at
    // `BlockView` directly — kept so the switch stays exhaustive and any
    // future caller that skips `renderBlocks` still gets a real card.
    case "nope":
      return <NopeCard block={block} nested={null} locale={locale} />;

    // Progress through a fixed sequence of stages: done stages ticked, the
    // current one ringed and in the reply accent.
    case "status": {
      return (
        <div className={styles.status}>
          <ol
            className={styles.statusStages}
            style={{ "--status-count": block.stages.length } as CSSProperties}
          >
            {block.stages.map((stage, i) => {
              const state =
                i < block.current
                  ? "done"
                  : i === block.current
                    ? "now"
                    : "next";
              return (
                <li
                  key={i}
                  className={
                    state === "done"
                      ? `${styles.statusStage} ${styles.statusDone}`
                      : state === "now"
                        ? `${styles.statusStage} ${styles.statusNow}`
                        : styles.statusStage
                  }
                >
                  <span className={styles.statusDot} aria-hidden={true}>
                    {state === "done" && (
                      <TickGlyph
                        viewBox="0 0 16 16"
                        d="M3.6 8.4 6.6 11.4 12.4 5"
                      />
                    )}
                  </span>
                  <b className={styles.statusLabel}>{stage.label}</b>
                  {stage.when != null && (
                    <small className={styles.statusWhen}>{stage.when}</small>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      );
    }

    // A multiple-choice question handed back — live only on the thread's
    // newest desk message, per `askLive`/`askAnswer` from the caller.
    case "ask":
      return (
        <AskCard
          block={block}
          live={askLive}
          answer={askAnswer}
          onAsk={onAsk}
        />
      );

    // What happened, what's happening, what's next.
    case "timeline":
      return (
        <ol className={styles.timeline}>
          {block.items.map((item, i) => (
            <li
              key={i}
              className={
                item.state === "past"
                  ? `${styles.timelineRow} ${styles.timelinePast}`
                  : item.state === "now"
                    ? `${styles.timelineRow} ${styles.timelineNow}`
                    : styles.timelineRow
              }
            >
              <span className={styles.timelineWhen}>{item.when}</span>
              <span className={styles.timelineDot} aria-hidden={true} />
              <div>
                <b className={styles.timelineTitle}>{item.title}</b>
                {item.detail != null && (
                  <p className={styles.timelineDetail}>{item.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      );

    // A run of people to reach, and what each can do.
    case "contacts":
      return (
        <div className={styles.contacts}>
          <span className={styles.contactsLabel}>
            <FormattedMessage
              id="support.reply.whoCanHelp"
              defaultMessage="Who can help"
            />
          </span>
          {block.items.map((item, i) => (
            <div key={i} className={styles.contact}>
              <span className={styles.contactIcon} aria-hidden={true}>
                <svg viewBox="0 0 16 16" focusable={false}>
                  <circle
                    cx="6"
                    cy="5.5"
                    r="2.3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  />
                  <path
                    d="M1.8 13.2c.6-2.2 2.2-3.4 4.2-3.4s3.6 1.2 4.2 3.4M11 3.6a2.1 2.1 0 0 1 0 4M12.3 9.8c1 .5 1.7 1.5 2 3.1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <div>
                <b className={styles.contactWho}>{item.who}</b>
                <p className={styles.contactDetail}>
                  {item.detail.map((span, j) => (
                    <SpanView key={j} span={span} locale={locale} />
                  ))}
                </p>
              </div>
            </div>
          ))}
        </div>
      );
  }
}

/** The route rail — its own component because a `nope` card also draws one
 *  as "the closest thing" underneath the refusal. */
function PathRail({
  segments,
}: {
  readonly segments: readonly string[];
}): ReactNode {
  return (
    // The whole rail is one label to assistive tech: read as a route, not
    // as four unrelated buttons with arrows between them.
    <span
      className={styles.rail}
      role="group"
      aria-label={segments.join(", then ")}
    >
      {segments.map((segment, i) => (
        <span key={i} className={styles.railItem}>
          {i > 0 && (
            <svg
              className={styles.arrow}
              viewBox="0 0 12 12"
              aria-hidden={true}
              focusable={false}
            >
              <path
                d="M3.5 2L7.5 6L3.5 10"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {/* One accent per rail: only the destination is tinted, so the
              eye lands where the finger has to go. */}
          <span
            className={
              i === segments.length - 1
                ? `${styles.cap} ${styles.capDest}`
                : styles.cap
            }
          >
            {segment}
          </span>
        </span>
      ))}
    </span>
  );
}

/** The numbered step rail — its own component for the same reason as
 *  {@link PathRail}. */
function StepsList({
  block,
}: {
  readonly block: Extract<Block, { kind: "steps" }>;
}): ReactNode {
  return (
    <ol className={styles.steps}>
      {block.items.map((step, i) => (
        <li key={i} className={styles.step}>
          <span className={styles.stepWhere}>{step.where}</span>
          {step.hint != null && (
            <span className={styles.stepHint}>
              <svg viewBox="0 0 16 16" aria-hidden={true} focusable={false}>
                <path
                  d="M8 14.5s4.5-4.2 4.5-7.8a4.5 4.5 0 0 0-9 0c0 3.6 4.5 7.8 4.5 7.8Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.4}
                />
                <circle cx="8" cy="6.7" r="1.4" fill="currentColor" />
              </svg>
              {step.hint}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** A refusal, said plainly. When the block right after a `[nope]` in the
 *  reply is a route or a step list, the renderer nests it here as "the
 *  closest thing" instead of leaving it to repeat below, unlabelled. */
function NopeCard({
  block,
  nested,
  locale,
}: {
  readonly block: Extract<Block, { kind: "nope" }>;
  readonly nested: Extract<Block, { kind: "path" | "steps" }> | null;
  readonly locale?: string;
}): ReactNode {
  return (
    <div className={styles.nope}>
      <div className={styles.nopeHead}>
        <span className={styles.nopeIcon} aria-hidden={true}>
          <svg viewBox="0 0 16 16" focusable={false}>
            <circle
              cx="8"
              cy="8"
              r="5.6"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
            />
            <path
              d="M4.2 11.8 11.8 4.2"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          </svg>
        </span>
        <div>
          <b className={styles.nopeHeading}>{block.heading}</b>
          {block.body.length > 0 && (
            <p className={styles.nopeBody}>
              {block.body.map((span, i) => (
                <SpanView key={i} span={span} locale={locale} />
              ))}
            </p>
          )}
        </div>
      </div>
      {nested != null && (
        <div className={styles.nopeAlt}>
          <span className={styles.nopeAltLabel}>
            <FormattedMessage
              id="support.reply.closestThing"
              defaultMessage="The closest thing"
            />
          </span>
          {nested.kind === "path" ? (
            <PathRail segments={nested.segments} />
          ) : (
            <StepsList block={nested} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A multiple-choice question handed back to the customer.
 *
 * `live` decides which of two very different things this renders: a row of
 * real, keyboard-reachable buttons that send an option as the customer's
 * own reply, or — once the moment has passed — a row of inert labels that
 * still shows which one (if any) they picked. The component never decides
 * `live` itself: that depends on this message's position in the whole
 * thread, which only the caller can see.
 */
function AskCard({
  block,
  live,
  answer,
  onAsk,
}: {
  readonly block: Extract<Block, { kind: "ask" }>;
  readonly live: boolean;
  readonly answer: string | null;
  readonly onAsk?: (option: string) => void;
}): ReactNode {
  return (
    <div className={styles.ask}>
      <span className={styles.askIcon} aria-hidden={true}>
        <svg viewBox="0 0 16 16" focusable={false}>
          <path
            d="M5.8 6a2.3 2.3 0 1 1 3.2 2.1c-.7.3-1 .8-1 1.5v.3"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
          />
          <circle cx="8" cy="12.6" r="1.1" fill="currentColor" />
        </svg>
      </span>
      <div>
        <b className={styles.askQuestion}>{block.question}</b>
        <div
          className={styles.askOptions}
          role="group"
          aria-label={block.question}
        >
          {block.options.map((opt, i) => {
            if (live) {
              return (
                <button
                  key={i}
                  type="button"
                  className={styles.askOption}
                  onClick={() => onAsk?.(opt)}
                >
                  {opt}
                </button>
              );
            }
            const chosen = answer != null && answer.trim() === opt.trim();
            return (
              <span
                key={i}
                className={
                  chosen
                    ? `${styles.askOption} ${styles.askOptionInert} ${styles.askOptionChosen}`
                    : `${styles.askOption} ${styles.askOptionInert}`
                }
              >
                {chosen && (
                  <TickGlyph viewBox="0 0 16 16" d="M3.6 8.4 6.6 11.4 12.4 5" />
                )}
                {opt}
              </span>
            );
          })}
        </div>
        {live && (
          <p className={styles.askHint}>
            <FormattedMessage
              id="support.reply.askHint"
              defaultMessage="Tap one to send it as your reply, or write your own."
            />
          </p>
        )}
      </div>
    </div>
  );
}

/** A small ring showing how many of a checklist's items are done. */
function ChecklistRing({
  done,
  total,
}: {
  readonly done: number;
  readonly total: number;
}): ReactNode {
  const r = 19;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? done / total : 0;
  return (
    <span className={styles.ring}>
      <svg viewBox="0 0 44 44" aria-hidden={true} focusable={false}>
        <circle
          className={styles.ringTrack}
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth={5}
        />
        <circle
          className={styles.ringFill}
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <span className={styles.ringLabel}>
        {done}
        <small>/{total}</small>
      </span>
    </span>
  );
}

/** The one tick mark drawn in three places (checklist items, a done status
 *  stage, the sorted moment) — sized per caller, since each sits in a
 *  differently-proportioned circle. */
function TickGlyph({
  viewBox,
  d,
}: {
  readonly viewBox: string;
  readonly d: string;
}): ReactNode {
  return (
    <svg viewBox={viewBox} focusable={false}>
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const CALLOUT_CLASS: Record<CalloutTone, string> = {
  note: styles.calloutNote,
  warn: styles.calloutWarn,
  danger: styles.calloutDanger,
};

function CalloutIcon({ tone }: { readonly tone: CalloutTone }): ReactNode {
  const path =
    tone === "note"
      ? "M8 7.2v4M8 4.9h.01"
      : tone === "warn"
        ? "M8 6.4v3.1M8 11.4h.01"
        : "M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8";
  return (
    <svg
      className={styles.calloutIcon}
      viewBox="0 0 16 16"
      aria-hidden={true}
      focusable={false}
    >
      {tone === "warn" ? (
        <path
          d="M8 2.2 14.4 13.4H1.6z"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        />
      ) : (
        <circle
          cx="8"
          cy="8"
          r="6.2"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        />
      )}
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * A number on a range, with the ends named.
 *
 * The fill is computed only when both ends parse as numbers; a value like
 * "1.4×" against ends "slower"/"faster" is still worth drawing, just
 * without a position claim the data cannot support.
 */
function RangeView({
  block,
}: {
  readonly block: Extract<Block, { kind: "range" }>;
}): ReactNode {
  const lo = leadingNumber(block.min);
  const hi = leadingNumber(block.max);
  const at = leadingNumber(block.value);
  const pct =
    lo != null && hi != null && at != null && hi > lo
      ? Math.min(100, Math.max(0, ((at - lo) / (hi - lo)) * 100))
      : null;
  return (
    <div className={styles.rangeRow}>
      <span className={styles.rangeTop}>
        <span className={styles.rangeName}>{block.name}</span>
        <span className={styles.rangeValue}>{block.value}</span>
      </span>
      {/* No track without a position to put the knob at. A "1.4×" between
          ends named "slower" and "faster" is worth showing, but an empty
          groove reads as a slider that failed to load. */}
      {pct != null && (
        <span className={styles.track} aria-hidden={true}>
          <span className={styles.fill} style={{ inlineSize: `${pct}%` }} />
          <span
            className={styles.knob}
            style={{ insetInlineStart: `${pct}%` }}
          />
        </span>
      )}
      {(block.min !== "" || block.max !== "") && (
        <span className={styles.rangeEnds}>
          <span>{block.min}</span>
          <span>{block.max}</span>
        </span>
      )}
    </div>
  );
}

/**
 * Two readings of one thing.
 *
 * The block only ever carries a value and a label per side — no separate
 * percentage or delta field. Where both values parse as numbers, the two
 * bars share one scale and the chip between them is a signed delta; where
 * they don't (two names, not two numbers — "Practice" vs "Speed Test"),
 * the bars are left off and the chip is a plain arrow, for the same reason
 * {@link RangeView} leaves its own knob off rather than guess a position.
 */
function CompareView({
  block,
}: {
  readonly block: Extract<Block, { kind: "compare" }>;
}): ReactNode {
  const lv = leadingNumber(block.left.value);
  const rv = leadingNumber(block.right.value);
  const max =
    lv != null && rv != null ? Math.max(Math.abs(lv), Math.abs(rv), 1) : null;
  const delta = lv != null && rv != null ? rv - lv : null;
  const deltaLabel =
    delta == null
      ? "→"
      : `${delta > 0 ? "+" : ""}${Math.round(delta * 100) / 100}`;
  return (
    <div className={styles.compare}>
      <CompareSide
        value={block.left.value}
        label={block.left.label}
        pct={max != null && lv != null ? (Math.abs(lv) / max) * 100 : null}
      />
      <span className={styles.compareDelta} aria-hidden={true}>
        {deltaLabel}
      </span>
      <CompareSide
        now={true}
        value={block.right.value}
        label={block.right.label}
        pct={max != null && rv != null ? (Math.abs(rv) / max) * 100 : null}
      />
    </div>
  );
}

function CompareSide({
  value,
  label,
  pct,
  now = false,
}: {
  readonly value: string;
  readonly label: string;
  readonly pct: number | null;
  readonly now?: boolean;
}): ReactNode {
  return (
    <span className={now ? `${styles.side} ${styles.sideNow}` : styles.side}>
      <span className={styles.sideValue}>{value}</span>
      {label !== "" && <span className={styles.sideLabel}>{label}</span>}
      {pct != null && (
        <span className={styles.compareBar} aria-hidden={true}>
          <span
            className={styles.compareBarFill}
            style={{ inlineSize: `${pct}%` }}
          />
        </span>
      )}
    </span>
  );
}

/** The number a value string opens with, ignoring any trailing unit —
 *  `"38 wpm"` → `38`, `"slower"` → `null`. Shared by the range and the
 *  compare block, which both only draw a bar or a knob when the data
 *  actually supports the position they'd claim. */
function leadingNumber(s: string): number | null {
  const n = Number.parseFloat(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function SpanView({
  span,
  locale,
}: {
  readonly span: Span;
  readonly locale?: string;
}): ReactNode {
  switch (span.kind) {
    case "control":
      // A control named in a sentence is a flat tinted chip (the approved
      // v3 mock). Keycaps are for keys you press and the path rail.
      return <span className={styles.control}>{span.text}</span>;
    case "crumb":
      return (
        <span
          className={styles.crumb}
          aria-label={span.segments.join(", then ")}
        >
          {span.segments.map((segment, i) => (
            <span key={i}>
              {i > 0 && (
                <span className={styles.crumbSep} aria-hidden={true}>
                  ›
                </span>
              )}
              {segment}
            </span>
          ))}
        </span>
      );
    // A quantity from their own account. Specificity is what stops an
    // acknowledgment reading as a script.
    case "stat":
      return (
        <span className={styles.stat}>
          <span className={styles.statValue}>{span.value}</span>
          {span.unit !== "" && (
            <span className={styles.statUnit}>{span.unit}</span>
          )}
        </span>
      );

    // Joined by a plus, never by an arrow: the arrow means "then", and
    // getting that wrong teaches the wrong gesture.
    case "keys":
      return (
        <span className={styles.combo}>
          {span.keys.map((key, i) => (
            <span key={i}>
              {i > 0 && (
                <span className={styles.plus} aria-hidden={true}>
                  +
                </span>
              )}
              <span className={styles.cap}>{key}</span>
            </span>
          ))}
        </span>
      );

    case "text":
      return <>{renderMessageText(span.text, undefined, locale)}</>;
  }
}
