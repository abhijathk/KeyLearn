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

// The kids page moved its sound / day-night / settings controls up into the
// header. It publishes their state via keylearn:kids-state and acts on the
// header's keylearn:kids-toggle requests.
type KidsControlState = {
  readonly sounds: boolean;
  readonly night: boolean;
  readonly keys: number;
};

function useKidsControls(): KidsControlState {
  const [state, setState] = useState<KidsControlState>({
    sounds: false,
    night: false,
    keys: 0,
  });
  useEffect(() => {
    const onState = (ev: Event) => {
      setState((ev as CustomEvent<KidsControlState>).detail);
    };
    window.addEventListener("keylearn:kids-state", onState);
    return () => window.removeEventListener("keylearn:kids-state", onState);
  }, []);
  return state;
}

function kidsToggle(what: "sound" | "night" | "settings"): void {
  window.dispatchEvent(
    new window.CustomEvent("keylearn:kids-toggle", { detail: what }),
  );
}

function KidSoundIcon({ muted }: { readonly muted: boolean }): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden={true}
    >
      <path
        d="M4 9v6h4l5 4V5L8 9H4z"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {muted ? (
        <path d="M16 9l5 6M21 9l-5 6" strokeWidth="1.8" strokeLinecap="round" />
      ) : (
        <path
          d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function KidNightIcon({ night }: { readonly night: boolean }): ReactNode {
  return night ? (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden={true}
    >
      <circle cx="12" cy="12" r="4.5" strokeWidth="1.8" />
      <path
        d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden={true}
    >
      <path
        d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Header({
  onOpenMenu,
  showFocus = false,
  showBack = false,
  kids = false,
}: {
  readonly onOpenMenu: () => void;
  readonly showFocus?: boolean;
  readonly showBack?: boolean;
  readonly kids?: boolean;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [streak, setStreak] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [typing, setTyping] = useState(false);
  const kidsState = useKidsControls();
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
        <div
          className={styles.controls}
          onMouseDown={(ev) => {
            // Keep the focus in the text area: stealing it would blur the
            // practice and reset the lesson in progress.
            ev.preventDefault();
          }}
        >
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
        {showBack && !kids && (
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
        {kids && (
          <span className={styles.kidsTag}>
            <FormattedMessage id="header.kids" defaultMessage="Kids" />
            {kidsState.keys > 0 && (
              <em className={styles.kidsKeys}>
                <FormattedMessage
                  id="header.kids.keys"
                  defaultMessage="{n} keys"
                  values={{ n: kidsState.keys }}
                />
              </em>
            )}
          </span>
        )}
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
          <span
            onMouseDown={(ev) => {
              // Keep the focus in the text area so entering focus mode
              // doesn't blur the practice and reset the lesson.
              ev.preventDefault();
            }}
          >
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
          </span>
        )}
        {kids && (
          <>
            <IconButton
              icon={<KidSoundIcon muted={!kidsState.sounds} />}
              title={formatMessage(
                defineMessage({
                  id: "kids.header.sound",
                  defaultMessage: "Sounds on or off",
                }),
              )}
              onClick={() => kidsToggle("sound")}
            />
            <IconButton
              icon={<KidNightIcon night={kidsState.night} />}
              title={formatMessage(
                defineMessage({
                  id: "kids.header.night",
                  defaultMessage: "Day or night",
                }),
              )}
              onClick={() => kidsToggle("night")}
            />
            <IconButton
              icon={<StrokeIcon name="settings" />}
              title={formatMessage(
                defineMessage({
                  id: "kids.header.settings",
                  defaultMessage: "Settings",
                }),
              )}
              onClick={() => kidsToggle("settings")}
            />
          </>
        )}
        {!kids && <ThemeSwitcher />}
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
