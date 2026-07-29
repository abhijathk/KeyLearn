import { ProfileAvatar, useProfiles } from "@keybr/page-account";
import { Avatar, Pages, usePageData } from "@keybr/pages-shared";
import { StrokeIcon } from "@keybr/widget";
import { clsx } from "clsx";
import { type ReactNode } from "react";
import { defineMessage, useIntl } from "react-intl";
import { NavLink } from "react-router";
import * as styles from "./AccountMenu.module.less";

/**
 * The header identity chip — a passive indicator of who is practising.
 * With an active learner it shows their avatar, first name and a K (kid) or
 * G (grown-up) badge; otherwise just the admin or anonymous avatar. Account,
 * Log out and the learner switcher all live in the menu drawer.
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
            <ProfileAvatar
              avatar={active.avatar}
              name={active.firstName}
              size={29}
            />
            <span
              className={styles.badge}
              data-kind={active.kind}
              title={
                active.kind === "kid"
                  ? formatMessage({ id: "profiles.kid", defaultMessage: "Kid" })
                  : formatMessage({
                      id: "profiles.adult",
                      defaultMessage: "Grown-up",
                    })
              }
            >
              {active.kind === "kid" ? "K" : "G"}
            </span>
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
