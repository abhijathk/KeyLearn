import { BrailleAvatar, useProfiles } from "@keylearn/page-account";
import { Avatar, Pages, usePageData } from "@keylearn/pages-shared";
import { StrokeIcon } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode } from "react";
import { defineMessage, useIntl } from "react-intl";
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
}: {
  readonly kids?: boolean;
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
      {active != null ? (
        <>
          <span className={clsx(styles.avatarWrap, kids && styles.kidsAvatar)}>
            <BrailleAvatar
              avatar={active.avatar}
              name={active.firstName}
              size={29}
              braille={active.visionSupport}
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
      )}
    </span>
  );
}
