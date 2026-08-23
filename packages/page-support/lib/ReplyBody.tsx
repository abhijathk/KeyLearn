import { renderMessageText } from "@keylearn/widget";
import { type ReactNode } from "react";
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
 */
export function ReplyBody({
  text,
  locale,
}: {
  readonly text: string;
  readonly locale?: string;
}): ReactNode {
  const blocks = parseReply(text);
  // Nothing recognised, or nothing there: fall all the way back. A reply
  // must always render, whatever the parser made of it.
  if (blocks.length === 0) {
    return renderMessageText(text, undefined, locale);
  }
  return (
    <>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} locale={locale} />
      ))}
    </>
  );
}

function BlockView({
  block,
  locale,
}: {
  readonly block: Block;
  readonly locale?: string;
}): ReactNode {
  switch (block.kind) {
    case "path":
      return (
        // The whole rail is one label to assistive tech: read as a route,
        // not as four unrelated buttons with arrows between them.
        <span
          className={styles.rail}
          role="group"
          aria-label={block.segments.join(", then ")}
        >
          {block.segments.map((segment, i) => (
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
              {/* One accent per rail: only the destination is tinted, so
                  the eye lands where the finger has to go. */}
              <span
                className={
                  i === block.segments.length - 1
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

    case "steps":
      return (
        <ol className={styles.steps}>
          {block.items.map((step, i) => (
            <li key={i} className={styles.step}>
              <span className={styles.stepWhere}>{step.where}</span>
              {step.hint != null && (
                <span className={styles.stepHint}>{step.hint}</span>
              )}
            </li>
          ))}
        </ol>
      );

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
            {block.spans.map((span, i) => (
              <SpanView key={i} span={span} locale={locale} />
            ))}
          </p>
        </div>
      );

    // Showing what is already done is half the reason this works.
    case "checklist":
      return (
        <ul className={styles.checklist}>
          {block.items.map((item, i) => (
            <li
              key={i}
              className={
                item.done ? `${styles.check} ${styles.checkDone}` : styles.check
              }
            >
              <span className={styles.checkBox} aria-hidden={true}>
                {item.done && (
                  <svg viewBox="0 0 12 12" focusable={false}>
                    <path
                      d="M2.5 6.2 4.8 8.5 9.5 3.8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
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
      );

    // A switch shown at the state it should be in — never one to press
    // here. A control that looks operable and is not is a small betrayal.
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
                  {item.on ? "On" : "Off"}
                </span>
              </span>
            </div>
          ))}
        </div>
      );

    case "range":
      return <RangeView block={block} />;

    case "compare":
      return (
        <div className={styles.compare}>
          <span className={styles.side}>
            <span className={styles.sideValue}>{block.left.value}</span>
            <span className={styles.sideLabel}>{block.left.label}</span>
          </span>
          <span className={styles.vs} aria-hidden={true}>
            vs
          </span>
          <span className={`${styles.side} ${styles.sideNow}`}>
            <span className={styles.sideValue}>{block.right.value}</span>
            <span className={styles.sideLabel}>{block.right.label}</span>
          </span>
        </div>
      );

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
            <svg viewBox="0 0 16 16" focusable={false}>
              <path
                d="M3.6 8.4 6.6 11.4 12.4 5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
  }
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
  const num = (s: string) => {
    const n = Number.parseFloat(s.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const lo = num(block.min);
  const hi = num(block.max);
  const at = num(block.value);
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

function SpanView({
  span,
  locale,
}: {
  readonly span: Span;
  readonly locale?: string;
}): ReactNode {
  switch (span.kind) {
    case "control":
      return <span className={styles.cap}>{span.text}</span>;
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
