import { lessonStamp, type StampMode } from "@keylearn/lesson";
import { NotificationBell } from "@keylearn/page-account";
// A deep import into icons.tsx rather than the package root: the root
// barrel also re-exports KidsPage.tsx, which pulls in the three.js-backed
// dino world — importing through it would ship that ~150KB (gzipped) to
// every page instead of only /kids, since Header renders everywhere.
import {
  GearIcon,
  MoonIcon,
  SoundIcon,
  SunIcon,
} from "@keylearn/page-kids/lib/icons.tsx";
import { useSettings } from "@keylearn/settings";
import { supportUrl } from "@keylearn/thirdparties";
import { IconButton, StrokeIcon } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import { NavLink, useLocation } from "react-router";
import coffeeCup from "../assets/coffee-cup.png";
import { AccountMenu } from "./AccountMenu.tsx";
import * as styles from "./Header.module.less";
import { ThemeSwitcher } from "./themes/ThemeSwitcher.tsx";

const toggleFocusMode = () => {
  window.dispatchEvent(new window.CustomEvent("keylearn:focus-mode"));
};

/**
 * What you are practising, stamped beside the wordmark.
 *
 * The lesson type is chosen once and then never restated on the page, so a
 * learner who set Book Text last week opens practice to prose with no idea
 * why it is not the guided course — and the setting that explains it is two
 * clicks deep. It rides here rather than in the telemetry island for the
 * same reason the "Kids" mark does: this is where the page says what it is,
 * and the island is for numbers.
 *
 * The header sits outside the practice page's view context, so the click
 * asks for the settings screen by event, the way the kids controls do.
 */
function PracticeStamp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings } = useSettings();
  const { mode, detail, detailIsMessage } = lessonStamp(settings);
  // Every id spelled out: the message extractor reads these literally, and a
  // computed one silently drops the string from the catalogue. The names are
  // the same ones the settings tiles use, so the stamp and the screen it
  // opens always agree.
  const names: Record<StampMode, string> = {
    guided: formatMessage({
      id: "t_Guided_lessons",
      defaultMessage: "Guided practice",
    }),
    curriculum: formatMessage({
      id: "lessonType.curriculum.name",
      defaultMessage: "Classic course",
    }),
    code: formatMessage({ id: "t_Source_code", defaultMessage: "Code craft" }),
    wordlist: formatMessage({
      id: "t_Common_words",
      defaultMessage: "Frequent words",
    }),
    books: formatMessage({ id: "t_Books", defaultMessage: "Book Text" }),
    quotes: formatMessage({
      id: "lessonType.quotes.name",
      defaultMessage: "Quotes",
    }),
    custom: formatMessage({
      id: "t_Custom_text",
      defaultMessage: "Your Own Text",
    }),
    numbers: formatMessage({
      id: "t_Numbers",
      defaultMessage: "Number Drills",
    }),
  };
  return (
    <button
      type="button"
      className={styles.stamp}
      title={formatMessage({
        id: "practice.stamp.description",
        defaultMessage: "What you are practising. Click to change it.",
      })}
      onClick={() => {
        window.dispatchEvent(
          new window.CustomEvent("keylearn:practice-settings"),
        );
      }}
    >
      <span className={styles.stampName}>{names[mode]}</span>
      {detail != null && (
        // A long book title ellipsises in the pill; the tooltip keeps it whole.
        <span
          className={styles.stampDetail}
          title={detailIsMessage ? undefined : detail}
        >
          {detailIsMessage
            ? formatMessage({
                id: "practice.stamp.ownWords",
                defaultMessage: "your words",
              })
            : detail}
        </span>
      )}
    </button>
  );
}

// The kids page moved its sound / day-night / settings controls up into the
// header. It publishes their state via keylearn:kids-state and acts on the
// header's keylearn:kids-toggle requests.
type KidsControlState = {
  readonly sounds: boolean;
  readonly night: boolean;
  readonly keys: number;
  /** Days practised in a row, for the little flame chip. */
  readonly streak?: number;
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

// A tiny flame for the streak chip, drawn in the same hand as the rest.
function KidFlameIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width={17} height={17} aria-hidden={true}>
      <path
        d="M12 3.5c1.2 2.4 4.8 4.6 4.8 8.6a4.8 4.8 0 0 1-9.6 0c0-1.6.7-2.9 1.6-4.2.2 1 .7 1.8 1.6 2.3-.3-2.5.4-4.9 1.6-6.7Z"
        fill="none"
        stroke="#6f675b"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
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
  onOpenSupport,
  showFocus = false,
  showBack = false,
  kids = false,
  practice = false,
  desk = false,
  hideAccount = false,
}: {
  readonly onOpenMenu: () => void;
  readonly onOpenSupport: () => void;
  readonly showFocus?: boolean;
  readonly showBack?: boolean;
  readonly kids?: boolean;
  /** On the practice page the wordmark is followed by the lesson stamp. */
  readonly practice?: boolean;
  /** The support desk owns its own left-nav and back/coffee/menu don't apply. */
  readonly desk?: boolean;
  /**
   * The staff sign-in door: a signed-out visitor there has nowhere useful
   * for the account chip to send them (it's not the general `/login`), so
   * it's dropped rather than offered.
   */
  readonly hideAccount?: boolean;
}): ReactNode {
  const { formatMessage } = useIntl();
  // The back button offers a return to practice, which is neither where a
  // braille learner came from nor a page their profile lists.
  const braille = useLocation().pathname.endsWith("/braille");
  const [streak, setStreak] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [typing, setTyping] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [dashboardAsOf, setDashboardAsOf] = useState<string | null>(null);
  const kidsState = useKidsControls();
  useEffect(() => {
    const onStreak = (ev: Event) => {
      setStreak((ev as CustomEvent<number>).detail ?? 0);
    };
    // The desk's Dashboard broadcasts its data timestamp rather than
    // rendering it itself — the header is the one place it stays visible
    // no matter how far down the page a staff member has scrolled, and it
    // clears the moment the Dashboard unmounts (see DashboardPage.tsx).
    const onDashboardAsOf = (ev: Event) => {
      setDashboardAsOf((ev as CustomEvent<string | null>).detail ?? null);
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
    window.addEventListener("keylearn:desk-dashboard-asof", onDashboardAsOf);
    return () => {
      window.removeEventListener("keylearn:streak", onStreak);
      window.removeEventListener("keylearn:focus-mode-state", onFocusMode);
      window.removeEventListener("keylearn:typing", onTyping);
      window.removeEventListener("keylearn:header-hide", onHide);
      window.removeEventListener(
        "keylearn:desk-dashboard-asof",
        onDashboardAsOf,
      );
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
    <header
      className={clsx(
        styles.header,
        desk && styles.deskSticky,
        hidden && styles.hidden,
      )}
    >
      <div className={styles.left}>
        {showBack && !kids && !braille && !desk && (
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
        {desk ? (
          // On the support desk, the wordmark is an identity mark only —
          // not a link back to practice, which would drop staff out of the
          // desk entirely.
          <span className={styles.wordmark} dir="ltr">
            <StrokeIcon
              className={clsx(styles.glyph, styles.glyphDesk)}
              name="headset"
            />
            <span className={styles.mark}>Q</span>
            <span className={styles.markAlt}>Desk</span>
            {/* The one app this desk currently manages — a static fact
                today (see SettingsPage's APPS registry), not yet a live
                selection, so it's just printed here rather than read from
                any switcher state. Carries KeyLearn's own glyph (the same
                "keyboard" mark its own wordmark uses below), not a generic
                app icon, so the badge reads as that app's own mark. */}
            <span className={styles.appBadge}>
              <StrokeIcon className={styles.appBadgeIcon} name="keyboard" />
              KeyLearn
            </span>
          </span>
        ) : (
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
        )}
        {practice && <PracticeStamp />}
      </div>
      <div className={clsx(styles.controls, typing && styles.controlsDimmed)}>
        {desk && dashboardAsOf != null && (
          <span className={styles.dashboardAsOf}>
            <FormattedMessage
              id="deskDashboard.asOf"
              defaultMessage="Last updated {time}"
              values={{
                time: new Date(dashboardAsOf).toLocaleString(undefined, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              }}
            />
          </span>
        )}
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
        {!hideAccount && !desk && <AccountMenu kids={kids} desk={desk} />}
        {kids && (
          <>
            {(kidsState.streak ?? 0) > 1 && (
              // Days in a row, said the way the other chips say things. Not a
              // button — there is nothing to press about having turned up.
              <span
                className={clsx(styles.kidsChip, styles.kidsChipWide)}
                style={{
                  background: "color-mix(in srgb, #b8b2a6 38%, #ffffff)",
                }}
                title={formatMessage(
                  defineMessage({
                    id: "kids.header.streak",
                    defaultMessage: "{days} days of practice in a row",
                  }),
                  { days: kidsState.streak },
                )}
              >
                <KidFlameIcon />
                <span className={styles.kidsChipCount}>{kidsState.streak}</span>
              </span>
            )}
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
        {!kids && !desk && supportUrl !== "" && (
          <button
            type="button"
            onClick={onOpenSupport}
            title={formatMessage(
              defineMessage({
                id: "footer.supportLink.text",
                defaultMessage: "Buy me a coffee",
              }),
            )}
          >
            <img className={styles.coffeeCup} src={coffeeCup} alt="" />
          </button>
        )}
        {!kids && <NotificationBell />}
        {!hideAccount && desk && <AccountMenu kids={kids} desk={desk} />}
        {desk ? null : kids ? (
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
