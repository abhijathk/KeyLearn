import { BrailleAvatar, useProfiles } from "@keylearn/page-account";
import {
  accessibilityActive,
  Avatar,
  logout,
  Pages,
  usePageData,
} from "@keylearn/pages-shared";
import { ConfirmDialog, StrokeIcon } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import { NavLink } from "react-router";
import * as styles from "./AccountMenu.module.less";

/**
 * The header identity chip — a passive indicator of who is practising.
 * With an active learner it shows their avatar and first name; otherwise just
 * the admin or anonymous avatar. Account, Log out and the learner switcher all
 * live in the menu drawer.
 *
 * The only badge left is a B for a learner on braille and audio. Kid and
 * grown-up carried K / G bubbles here, but the profile list now sorts them and
 * gives each their own colour chip, so repeating it in the header was noise on
 * every page. Vision support changes how the app behaves, not just who is
 * using it, so it stays visible.
 *
 * On the kids page the header speaks a different, playful visual language
 * (pastel rounded chips), so `kids` swaps in matching styles for both the
 * signed-out log-in chip and the signed-in identity.
 */
export function AccountMenu({
  kids = false,
  desk = false,
}: {
  readonly kids?: boolean;
  readonly desk?: boolean;
}): ReactNode {
  const { formatMessage } = useIntl();
  const { publicUser } = usePageData();
  const { active } = useProfiles();
  const signedIn = publicUser.id != null;

  // Signed out: a shortcut to log in, drawn to match the other header control
  // chips exactly (same rounded square, same glyph size) — no oversized avatar.
  // On the kids page it takes the pastel kid-chip look instead.
  if (!signedIn) {
    return (
      <NavLink
        to={Pages.login.path}
        className={kids ? styles.kidsLoginChip : styles.loginChip}
        title={formatMessage(
          defineMessage({
            id: "t_Log_In",
            defaultMessage: "Log In",
          }),
        )}
      >
        <StrokeIcon name="user" />
      </NavLink>
    );
  }

  const identity =
    active != null ? (
      <>
        <span className={clsx(styles.avatarWrap, kids && styles.kidsAvatar)}>
          <BrailleAvatar
            avatar={active.avatar}
            name={active.firstName}
            size={29}
            braille={active.visionSupport}
            accessible={accessibilityActive(active.id)}
          />
        </span>
        <span className={clsx(styles.name, kids && styles.kidsName)}>
          {active.firstName}
        </span>
      </>
    ) : (
      <span className={clsx(styles.avatarWrap, kids && styles.kidsAvatar)}>
        <Avatar user={publicUser} size="normal" />
      </span>
    );

  // On the support desk there's no menu drawer to reach a log-out control
  // from (the burger menu is hidden there — see Header.tsx), so the
  // identity chip itself becomes the log-out trigger: click to reveal, then
  // confirm, same as any other console with access to every customer's
  // ticket thread. Avatar only, never the name — the header is not the
  // place to broadcast which staff member is signed in.
  if (desk) {
    return (
      <DeskAccountMenu>
        <span className={styles.avatarWrap}>
          {active != null ? (
            <BrailleAvatar
              avatar={active.avatar}
              name={active.firstName}
              size={29}
              braille={active.visionSupport}
              accessible={accessibilityActive(active.id)}
            />
          ) : (
            <Avatar user={publicUser} size="normal" />
          )}
        </span>
      </DeskAccountMenu>
    );
  }

  return (
    <span
      className={clsx(styles.anchor, kids && styles.kidsIdentity)}
      title={formatMessage(
        defineMessage({
          id: "nav.account",
          defaultMessage: "Your account",
        }),
      )}
    >
      {identity}
    </span>
  );
}

function DeskAccountMenu({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onClick = (ev: MouseEvent) => {
      if (!ref.current?.contains(ev.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className={styles.deskWrap} ref={ref}>
      <button
        type="button"
        className={styles.deskTrigger}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {children}
      </button>
      {open && (
        <div className={styles.deskDropdown}>
          <button
            type="button"
            className={styles.deskSignOut}
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
          >
            <FormattedMessage id="deskNav.logOut" defaultMessage="Log out" />
          </button>
        </div>
      )}
      {confirming && (
        <ConfirmDialog
          title={formatMessage({
            id: "deskNav.logoutConfirmTitle",
            defaultMessage: "Log out of the support desk?",
          })}
          message={formatMessage({
            id: "deskNav.logoutConfirmMessage",
            defaultMessage:
              "You'll need to sign in again to get back to the desk.",
          })}
          confirmLabel={formatMessage({
            id: "deskNav.logOut",
            defaultMessage: "Log out",
          })}
          onConfirm={() => void logout(Pages.deskSignin.path, true)}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
