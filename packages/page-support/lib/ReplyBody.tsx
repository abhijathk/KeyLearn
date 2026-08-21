import { renderMessageText } from "@keylearn/widget";
import { type ReactNode } from "react";
import { type Block, parseReply, type Span } from "./reply-format.ts";
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
  }
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
    case "text":
      return <>{renderMessageText(span.text, undefined, locale)}</>;
  }
}
