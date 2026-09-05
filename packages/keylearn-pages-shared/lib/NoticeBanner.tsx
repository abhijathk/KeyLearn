import { clsx } from "clsx";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./NoticeBanner.module.less";
import {
  type LearnerResponseState,
  type NoticeDetails,
  type NoticeKind,
} from "./types.ts";

/**
 * The one place a {@link NoticeDetails} becomes pixels — the real site-wide
 * banner (Template.tsx) and the desk's own "how it'll look" preview
 * (NoticesPage.tsx) both render this, so the two can't drift the way they
 * did while each kept its own copy of the icon/color/dismiss logic.
 *
 * Dismiss is deliberately not a caller decision: an Incident never gets a
 * close button, regardless of `notice.dismissible` — a person who dismissed
 * one and then hit the same failure again is exactly the ticket this banner
 * exists to prevent. Omit `onDismiss` for a static preview that shouldn't
 * be interactive at all.
 */
export function NoticeBanner({
  notice,
  onDismiss,
}: {
  readonly notice: NoticeDetails;
  readonly onDismiss?: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const showDismiss =
    onDismiss != null && notice.dismissible && notice.kind !== "incident";
  return (
    <div
      className={clsx(styles.banner, styles[KIND_CLASS[notice.kind]])}
      role="status"
    >
      <NoticeIcon kind={notice.kind} />
      <MarqueeText text={notice.message} />
      {showDismiss && (
        <button
          type="button"
          className={styles.close}
          aria-label={formatMessage({
            id: "notice.dismiss",
            defaultMessage: "Dismiss",
          })}
          onClick={onDismiss}
        >
          ✕
        </button>
      )}
    </div>
  );
}

/**
 * The banner's message: static and centered when it fits on one line, a
 * slow leftward scroll only when it doesn't — most notices are short enough
 * to never animate at all.
 */
function MarqueeText({ text }: { readonly text: string }): ReactNode {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const check = () => {
      const wrap = wrapRef.current;
      const inner = textRef.current;
      if (wrap == null || inner == null) {
        return;
      }
      setOverflowing(inner.scrollWidth > wrap.clientWidth);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [text]);

  return (
    <span
      ref={wrapRef}
      className={clsx(styles.textWrap, overflowing && styles.textWrapScrolling)}
    >
      <span className={clsx(styles.text, overflowing && styles.textScrolling)}>
        <span ref={textRef} className={styles.textCopy}>
          {text}
        </span>
        {overflowing && (
          <span className={styles.textCopy} aria-hidden={true}>
            {text}
          </span>
        )}
      </span>
    </span>
  );
}

/** Picks {@link NoticeBanner} or {@link NoticeWindow} per `notice.display` — the one call site every renderer should use. */
export function SiteNotice({
  notice,
  onDismiss,
  contained,
}: {
  readonly notice: NoticeDetails;
  readonly onDismiss?: () => void;
  /** True inside a preview box that isn't the real page — keeps the scrim from covering the whole viewport. */
  readonly contained?: boolean;
}): ReactNode {
  return notice.display === "window" ? (
    <NoticeWindow notice={notice} onDismiss={onDismiss} contained={contained} />
  ) : (
    <NoticeBanner notice={notice} onDismiss={onDismiss} />
  );
}

/**
 * The floating-window counterpart to {@link NoticeBanner} — a centered,
 * blocking card for the rare notice that actually needs someone to stop and
 * read it, rather than the thin strip everything else uses. Never trapping:
 * even an Incident gets one acknowledge button, just a single one instead of
 * the two other kinds offer — a modal with no way out is worse than the
 * banner it's replacing.
 */
export function NoticeWindow({
  notice,
  onDismiss,
  contained = false,
}: {
  readonly notice: NoticeDetails;
  readonly onDismiss?: () => void;
  /** True inside a preview box that isn't the real page — keeps the scrim from covering the whole viewport. */
  readonly contained?: boolean;
}): ReactNode {
  return (
    <div
      className={clsx(styles.scrim, contained && styles.scrimContained)}
      role="presentation"
    >
      <div
        className={clsx(
          styles.window,
          styles[`${KIND_CLASS[notice.kind]}Window`],
        )}
        role="alertdialog"
        aria-modal={true}
      >
        <div className={styles.windowBody}>
          <div className={styles.windowHead}>
            <NoticeIcon kind={notice.kind} />
            <span
              className={clsx(
                styles.windowStamp,
                styles[`${KIND_CLASS[notice.kind]}Stamp`],
              )}
            >
              <FormattedKind kind={notice.kind} />
            </span>
          </div>
          <p className={styles.windowText}>{notice.message}</p>
          <div
            className={clsx(
              styles.windowActions,
              notice.kind === "incident" && styles.single,
            )}
          >
            {notice.kind !== "incident" && (
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={onDismiss}
              >
                <FormattedMessage
                  id="notice.remindLater"
                  defaultMessage="Remind me later"
                />
              </button>
            )}
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={onDismiss}
            >
              {notice.kind === "incident" ? (
                <FormattedMessage
                  id="notice.acknowledge"
                  defaultMessage="I understand"
                />
              ) : (
                <FormattedMessage id="notice.gotIt" defaultMessage="Got it" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** What the learner sends back from a card. */
export type LearnerVoiceInput = {
  readonly choice?: number;
  readonly stars?: number;
  readonly text?: string;
};

/**
 * The learner-voice cards (spec §8, phase 3): a poll or a feedback card in
 * the corner of the page, never a scrim, always with an exit button. One
 * answer per account, changeable until the card closes. The desk's
 * preview and the real page render this same component.
 */
export function LearnerVoiceCard({
  notice,
  state,
  busy = false,
  error = null,
  onExit,
  onSubmit,
  contained = false,
}: {
  readonly notice: NoticeDetails;
  /** The account's own answer and the running result; null while loading or in a preview. */
  readonly state: LearnerResponseState | null;
  readonly busy?: boolean;
  readonly error?: string | null;
  readonly onExit?: () => void;
  readonly onSubmit?: (input: LearnerVoiceInput) => void;
  /** True inside a preview box that isn't the real page. */
  readonly contained?: boolean;
}): ReactNode {
  const { formatMessage } = useIntl();
  const poll = notice.display === "poll";
  return (
    <div
      className={clsx(styles.scrim, contained && styles.scrimContained)}
      role="presentation"
    >
      <div className={styles.window} role="dialog" aria-label={notice.message}>
        <div className={styles.windowBody}>
          <div className={styles.windowHead}>
            <NoticeIcon kind={notice.kind} />
            <span className={clsx(styles.windowStamp, styles.cardStamp)}>
              {poll ? (
                <FormattedMessage id="notice.card.poll" defaultMessage="Poll" />
              ) : (
                <FormattedMessage
                  id="notice.card.feedback"
                  defaultMessage="Feedback"
                />
              )}
            </span>
            <button
              type="button"
              className={styles.close}
              aria-label={formatMessage({
                id: "notice.card.exit",
                defaultMessage: "Close",
              })}
              onClick={onExit}
            >
              ✕
            </button>
          </div>
          <p className={styles.windowText}>{notice.message}</p>
          {poll ? (
            <PollBody
              notice={notice}
              state={state}
              busy={busy}
              onSubmit={onSubmit}
            />
          ) : (
            <FeedbackBody
              notice={notice}
              state={state}
              busy={busy}
              onSubmit={onSubmit}
            />
          )}
          {error != null && <p className={styles.cardError}>{error}</p>}
        </div>
      </div>
    </div>
  );
}

function PollBody({
  notice,
  state,
  busy,
  onSubmit,
}: {
  readonly notice: NoticeDetails;
  readonly state: LearnerResponseState | null;
  readonly busy: boolean;
  readonly onSubmit?: (input: LearnerVoiceInput) => void;
}): ReactNode {
  const options = notice.options ?? [];
  const chosen = state?.response?.choice ?? null;
  const results = chosen != null ? (state?.results ?? null) : null;
  const total = results?.count ?? 0;
  return (
    <>
      <div className={styles.options} role="radiogroup">
        {options.map((option, index) => {
          const votes = results?.choices[index] ?? 0;
          const pct = total === 0 ? 0 : Math.round((votes / total) * 100);
          return (
            <button
              key={index}
              type="button"
              role="radio"
              aria-checked={chosen === index}
              className={clsx(
                styles.option,
                chosen === index && styles.optionOn,
              )}
              disabled={busy}
              onClick={() => onSubmit?.({ choice: index })}
            >
              {results != null && (
                <span
                  className={styles.optionBar}
                  style={{ inlineSize: `${pct}%` }}
                  aria-hidden={true}
                />
              )}
              <span className={styles.optionLabel}>{option}</span>
              {results != null && (
                <span className={styles.optionPct}>{pct}%</span>
              )}
            </button>
          );
        })}
      </div>
      <p className={styles.cardNote}>
        {results != null ? (
          <FormattedMessage
            id="notice.poll.votes"
            defaultMessage="{count, plural, one {# vote} other {# votes}} so far. You can change yours until the poll closes."
            values={{ count: total }}
          />
        ) : chosen != null ? (
          <FormattedMessage
            id="notice.poll.thanks"
            defaultMessage="Thanks. You can change your answer until the poll closes."
          />
        ) : (
          <FormattedMessage
            id="notice.poll.hint"
            defaultMessage="One answer per account."
          />
        )}
      </p>
    </>
  );
}

function FeedbackBody({
  notice,
  state,
  busy,
  onSubmit,
}: {
  readonly notice: NoticeDetails;
  readonly state: LearnerResponseState | null;
  readonly busy: boolean;
  readonly onSubmit?: (input: LearnerVoiceInput) => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const sent = state?.response ?? null;
  const [stars, setStars] = useState<number>(sent?.stars ?? 0);
  const [text, setText] = useState<string>(sent?.text ?? "");
  const [seen, setSeen] = useState(sent?.updatedAt ?? null);
  if ((sent?.updatedAt ?? null) !== seen) {
    setSeen(sent?.updatedAt ?? null);
    setStars(sent?.stars ?? 0);
    setText(sent?.text ?? "");
  }
  const askComment = notice.askComment !== false;
  const results = sent != null ? (state?.results ?? null) : null;
  return (
    <>
      <div className={styles.stars} role="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={formatMessage(
              {
                id: "notice.feedback.star",
                defaultMessage: "{n, plural, one {# star} other {# stars}}",
              },
              { n },
            )}
            className={clsx(styles.star, n <= stars && styles.starOn)}
            disabled={busy}
            onClick={() => {
              setStars(n);
              if (!askComment) {
                onSubmit?.({ stars: n });
              }
            }}
          >
            ★
          </button>
        ))}
      </div>
      {askComment && (
        <textarea
          className={styles.comment}
          rows={2}
          maxLength={500}
          placeholder={formatMessage({
            id: "notice.feedback.placeholder",
            defaultMessage: "Anything you’d like to add? (optional)",
          })}
          value={text}
          disabled={busy}
          onChange={(ev) => setText(ev.target.value)}
        />
      )}
      {askComment && (
        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={busy || stars === 0}
            onClick={() => onSubmit?.({ stars, text: text.trim() })}
          >
            {sent != null ? (
              <FormattedMessage
                id="notice.feedback.update"
                defaultMessage="Update"
              />
            ) : (
              <FormattedMessage
                id="notice.feedback.send"
                defaultMessage="Send"
              />
            )}
          </button>
        </div>
      )}
      <p className={styles.cardNote}>
        {results != null && results.average != null ? (
          <FormattedMessage
            id="notice.feedback.average"
            defaultMessage="Thank you. {average} average from {count, plural, one {# rating} other {# ratings}}."
            values={{ average: results.average, count: results.count }}
          />
        ) : sent != null ? (
          <FormattedMessage
            id="notice.feedback.thanks"
            defaultMessage="Thank you. You can change your rating until the card closes."
          />
        ) : askComment ? (
          <FormattedMessage
            id="notice.feedback.where"
            defaultMessage="Comments are read by KeyLearn staff, kept for a year, and go with your account if you export or delete it. Please leave contact details out."
          />
        ) : (
          <FormattedMessage
            id="notice.feedback.hint"
            defaultMessage="One rating per account."
          />
        )}
      </p>
    </>
  );
}

function FormattedKind({ kind }: { readonly kind: NoticeKind }): ReactNode {
  if (kind === "incident") {
    return (
      <FormattedMessage
        id="deskNotices.kind.incident"
        defaultMessage="Incident"
      />
    );
  }
  if (kind === "maintenance") {
    return (
      <FormattedMessage
        id="deskNotices.kind.maintenance"
        defaultMessage="Maintenance"
      />
    );
  }
  return (
    <FormattedMessage id="deskNotices.kind.feature" defaultMessage="Feature" />
  );
}

const KIND_CLASS: Record<NoticeKind, "feature" | "maintenance" | "incident"> = {
  feature: "feature",
  maintenance: "maintenance",
  incident: "incident",
};

function NoticeIcon({ kind }: { readonly kind: NoticeKind }): ReactNode {
  if (kind === "feature") {
    return (
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden={true}>
        <path d="M12 3l2.2 5.6L20 10l-4.4 3.4L17 19l-5-3-5 3 1.4-5.6L4 10l5.8-1.4z" />
      </svg>
    );
  }
  if (kind === "maintenance") {
    return (
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden={true}>
        <path d="M12 3l9 16H3z" />
        <path d="M12 10v4" />
        <path d="M12 16.6v.1" />
      </svg>
    );
  }
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden={true}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.3v.1" />
    </svg>
  );
}
