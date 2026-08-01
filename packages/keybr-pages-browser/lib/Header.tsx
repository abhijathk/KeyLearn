import { GearIcon, MoonIcon, SoundIcon, SunIcon } from "@keybr/page-kids";
import { IconButton, StrokeIcon } from "@keybr/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import { NavLink, useLocation } from "react-router";
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

// A playful hamburger drawn to sit among the kids chip buttons.
function KidMenuIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width={19} height={19} aria-hidden={true}>
      <path
        d="M5 7h14M5 12h14M5 17h14"
        fill="none"
        stroke="#3f7a1f"
        strokeWidth={2.2}
        strokeLinecap="round"
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
  // The back button offers a return to practice, which is neither where a
  // braille learner came from nor a page their profile lists.
  const braille = useLocation().pathname.endsWith("/braille");
  const [streak, setStreak] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [typing, setTyping] = useState(false);
  const [hidden, setHidden] = useState(false);
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
    // Opt-in auto-hide: the practice presenter asks the header to slide away
    // while typing and to return once the learner has been idle a while.
    const onHide = (ev: Event) => {
      setHidden(Boolean((ev as CustomEvent<boolean>).detail));
    };
    window.addEventListener("keylearn:streak", onStreak);
    window.addEventListener("keylearn:focus-mode-state", onFocusMode);
    window.addEventListener("keylearn:typing", onTyping);
    window.addEventListener("keylearn:header-hide", onHide);
    return () => {
      window.removeEventListener("keylearn:streak", onStreak);
      window.removeEventListener("keylearn:focus-mode-state", onFocusMode);
      window.removeEventListener("keylearn:typing", onTyping);
      window.removeEventListener("keylearn:header-hide", onHide);
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
    <header className={clsx(styles.header, hidden && styles.hidden)}>
      <div className={styles.left}>
        {showBack && !kids && !braille && (
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
        <NavLink
          to={kids ? "/kids" : "/"}
          className={styles.wordmark}
          // "KeyLearn" is a brand wordmark built from two spans; pin it LTR so
          // right-to-left locales (Arabic, Hebrew…) don't reorder it to
          // "LearnKey".
          dir="ltr"
          title={formatMessage(
            defineMessage({
              id: "nav.home",
              defaultMessage: "KeyLearn home",
            }),
          )}
        >
          <StrokeIcon className={styles.glyph} name="keyboard" />
          <span className={styles.mark}>Key</span>
          <span className={styles.markAlt}>Learn</span>
          {kids && <span className={styles.kidsMark}>Kids</span>}
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
        <AccountMenu kids={kids} />
        {kids && (
          <>
            <button
              type="button"
              className={styles.kidsChip}
              style={{
                background: "color-mix(in srgb, #f2c94c 34%, #ffffff)",
              }}
              title={formatMessage(
                defineMessage({
                  id: "kids.header.sound",
                  defaultMessage: "Sounds on or off",
                }),
              )}
              onClick={() => kidsToggle("sound")}
            >
              <SoundIcon muted={!kidsState.sounds} />
            </button>
            <button
              type="button"
              className={styles.kidsChip}
              style={{
                background: "color-mix(in srgb, #5fc9a7 34%, #ffffff)",
              }}
              title={formatMessage(
                defineMessage({
                  id: "kids.header.night",
                  defaultMessage: "Day or night",
                }),
              )}
              onClick={() => kidsToggle("night")}
            >
              {kidsState.night ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              type="button"
              className={styles.kidsChip}
              style={{
                background: "color-mix(in srgb, #3aa0ff 28%, #ffffff)",
              }}
              title={formatMessage(
                defineMessage({
                  id: "kids.header.settings",
                  defaultMessage: "Settings",
                }),
              )}
              onClick={() => kidsToggle("settings")}
            >
              <GearIcon />
            </button>
          </>
        )}
        {/* Focus mode rides beside the day/night switch. */}
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
        {!kids && <ThemeSwitcher />}
        {kids ? (
          <button
            type="button"
            className={styles.kidsChip}
            style={{ background: "color-mix(in srgb, #8bc34a 30%, #ffffff)" }}
            title={formatMessage(
              defineMessage({
                id: "nav.openMenu",
                defaultMessage: "Open navigation",
              }),
            )}
            onClick={onOpenMenu}
          >
            <KidMenuIcon />
          </button>
        ) : (
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
        )}
      </div>
    </header>
  );
}
