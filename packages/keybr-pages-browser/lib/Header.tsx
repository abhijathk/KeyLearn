import { IconButton, StrokeIcon } from "@keybr/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import { NavLink } from "react-router";
import { AccountMenu } from "./AccountMenu.tsx";
import * as styles from "./Header.module.less";
import { ThemeSwitcher } from "./themes/ThemeSwitcher.tsx";

const toggleFocusMode = () => {
  window.dispatchEvent(new window.CustomEvent("keylearn:focus-mode"));
};

export function Header({
  onOpenMenu,
  showFocus = false,
  showBack = false,
}: {
  readonly onOpenMenu: () => void;
  readonly showFocus?: boolean;
  readonly showBack?: boolean;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [streak, setStreak] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const onStreak = (ev: Event) => {
      setStreak((ev as CustomEvent<number>).detail ?? 0);
    };
    // The practice screen owns focus mode and broadcasts its state; the
    // header just follows, so the two can never drift apart.
    const onFocusMode = (ev: Event) => {
      setFocusMode(Boolean((ev as CustomEvent<boolean>).detail));
    };
    // While keys are landing, the header controls step back too (the logo
    // stays put).
    const onTyping = (ev: Event) => {
      setTyping(Boolean((ev as CustomEvent<boolean>).detail));
    };
    window.addEventListener("keylearn:streak", onStreak);
    window.addEventListener("keylearn:focus-mode-state", onFocusMode);
    window.addEventListener("keylearn:typing", onTyping);
    return () => {
      window.removeEventListener("keylearn:streak", onStreak);
      window.removeEventListener("keylearn:focus-mode-state", onFocusMode);
      window.removeEventListener("keylearn:typing", onTyping);
    };
  }, []);

  // In focus mode nothing but the keyboard, the practice text, and a single
  // button to leave should remain — so the header collapses to just that.
  if (focusMode && showFocus) {
    return (
      <header className={clsx(styles.header, styles.focusBar)}>
        <div className={styles.controls}>
          <IconButton
            icon={<StrokeIcon name="expand" />}
            title={formatMessage(
              defineMessage({
                id: "practice.widget.focusMode.exit",
                defaultMessage: "Leave focus mode.",
              }),
            )}
            onClick={toggleFocusMode}
          />
        </div>
      </header>
    );
  }

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {showBack && (
          <NavLink
            to="/"
            className={styles.back}
            title={formatMessage(
              defineMessage({
                id: "nav.backToPractice",
                defaultMessage: "Back to practice",
              }),
            )}
          >
            <StrokeIcon name="back" />
          </NavLink>
        )}
        <NavLink to="/" className={styles.wordmark}>
          <StrokeIcon className={styles.glyph} name="keyboard" />
          <span className={styles.mark}>Key</span>
          <span className={styles.markAlt}>Learn</span>
        </NavLink>
      </div>
      <div className={clsx(styles.controls, typing && styles.controlsDimmed)}>
        {streak > 0 && (
          <span
            className={styles.streak}
            title={formatMessage(
              defineMessage({
                id: "header.streak.description",
                defaultMessage:
                  "Days in a row with at least one completed lesson.",
              }),
            )}
          >
            <svg
              className={styles.flame}
              viewBox="0 0 24 24"
              aria-hidden={true}
            >
              <path d="M12 3.5c.6 2.8-1.3 4.6-2.5 6.2-1.2 1.6-2 3.2-2 5a6.5 6.5 0 0 0 13 0c0-1.4-.4-2.7-1.1-3.8-.9 1.1-2 1.4-2.9.9.9-2.4.1-5.8-4.5-8.3z" />
            </svg>
            <FormattedMessage
              id="practice.streak.days"
              defaultMessage="{days} {days, plural, =1 {day} other {days}}"
              values={{ days: streak }}
            />
          </span>
        )}
        {showFocus && (
          <IconButton
            icon={<StrokeIcon name="focus" />}
            title={formatMessage(
              defineMessage({
                id: "practice.widget.focusMode.enter",
                defaultMessage:
                  "Focus mode: just you, the words, nothing else.",
              }),
            )}
            onClick={() => {
              window.dispatchEvent(
                new window.CustomEvent("keylearn:focus-mode"),
              );
            }}
          />
        )}
        <ThemeSwitcher />
        <AccountMenu />
        <IconButton
          icon={<StrokeIcon name="menu" />}
          title={formatMessage(
            defineMessage({
              id: "nav.openMenu",
              defaultMessage: "Open navigation",
            }),
          )}
          onClick={onOpenMenu}
        />
      </div>
    </header>
  );
}
