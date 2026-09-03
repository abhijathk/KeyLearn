import { type ReactNode, useEffect, useRef } from "react";
import * as styles from "./WhyThisAd.module.less";

/**
 * "Why am I seeing this?", as a window over the page.
 *
 * It used to be a link to a page of its own, which meant a reader who
 * wanted one question answered lost the lesson they were in the middle of.
 * Somebody asking why an advertisement is in front of them is owed an
 * answer, not a navigation — the advertisement was already one imposition
 * and taking their place away would be a second.
 *
 * The page at /why-this-ad still exists and still says the same things: it
 * is what a search engine, a shared link or a reader with JavaScript off
 * gets, and the window links to it for the full policy.
 */
export function WhyThisAd({
  advertiser,
  destination,
  onClose,
}: {
  readonly advertiser: string;
  /** The host the line points at, for the "where it goes" row. */
  readonly destination?: string | null;
  readonly onClose: () => void;
}): ReactNode {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus lands on the way out, and Escape takes it — a window that traps
  // somebody who only wanted to read one paragraph is worse than the link
  // it replaced.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className={styles.scrim}
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={styles.window}
        role="dialog"
        aria-modal={true}
        aria-label="Why am I seeing this advertisement?"
      >
        <div className={styles.head}>
          <h2 className={styles.title}>Why am I seeing this?</h2>
          <button
            ref={closeRef}
            type="button"
            className={styles.close}
            aria-label="Close"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <p className={styles.lede}>
          Because somebody paid for that line at the top of the page, and for no
          other reason. Nothing about you decided it.
        </p>

        <dl className={styles.facts}>
          <div>
            <dt>Paid for by</dt>
            <dd>{advertiser}</dd>
          </div>
          <div>
            <dt>Shown to</dt>
            <dd>All adult readers for the duration of the booking</dd>
          </div>
          <div>
            <dt>Selected by</dt>
            <dd>Their booking for this period, and no other criterion.</dd>
          </div>
          {destination != null && destination !== "" && (
            <div>
              <dt>Where it goes</dt>
              <dd>{destination}</dd>
            </div>
          )}
        </dl>

        <p className={styles.section}>What we did not do</p>
        <ul className={styles.list}>
          <li>
            <b>We did not target you.</b> Every adult reader sees the same line
            this week. There is no audience, no segment and no interest
            category.
          </li>
          <li>
            <b>We did not use your practice data.</b> Your speed, your lessons,
            your mistakes and your certificates play no part in what appears.
          </li>
          <li>
            <b>The advertiser learns nothing about you.</b> They receive a
            weekly count of views and clicks. Not who, not where, not when you
            practise.
          </li>
          <li>
            <b>Nothing of theirs runs on this page.</b> No script, no tracking
            pixel, no embedded frame. We build the line ourselves from words and
            colours they send us.
          </li>
          <li>
            <b>Clicking is counted, not followed.</b> A click adds one to a
            number on our own server. It carries nothing about you to them.
          </li>
          <li>
            <b>Children never see advertising here.</b> Not on a child&rsquo;s
            profile, not in the kids world, not on a school account. That has no
            exception.
          </li>
        </ul>

        <p className={styles.section}>If you would rather not see it</p>
        <ul className={styles.list}>
          <li>
            <b>Close it.</b> The cross on the right hides it until you next load
            a page.
          </li>
          <li>
            <b>Go premium.</b> A subscription will remove advertising
            completely, along with more learner places and printable
            certificates. It is not on sale yet.
          </li>
        </ul>

        <div className={styles.actions}>
          {/* Premium is not built yet, so the way out of advertising is
              announced rather than offered: a control that looks live and
              goes nowhere is worse than one that says it is not ready.
              When subscriptions ship, this becomes a link to /account. */}
          <button type="button" className={styles.btn} disabled={true}>
            See premium
            <span className={styles.soon}>Coming soon</span>
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnQuiet}`}
            onClick={onClose}
          >
            Back to practice
          </button>
          <a
            className={`${styles.btn} ${styles.btnQuiet}`}
            href="/why-this-ad"
            target="_blank"
            rel="noreferrer"
          >
            The full policy
          </a>
        </div>

        <p className={styles.foot}>
          Every line is approved by a person here before it runs. Nothing
          discriminatory, nothing abusive, nothing with a second meaning, no
          gambling, alcohol, vaping or weight loss, nothing aimed at children,
          and nothing dressed up to look like a message from us.
        </p>
      </div>
    </div>
  );
}
