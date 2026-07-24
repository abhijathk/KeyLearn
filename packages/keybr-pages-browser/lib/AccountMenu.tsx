import { ProfileAvatar, useProfiles } from "@keybr/page-account";
import { Avatar, usePageData } from "@keybr/pages-shared";
import { type ReactNode } from "react";
import { defineMessage, useIntl } from "react-intl";
import * as styles from "./AccountMenu.module.less";

/**
 * The header identity chip — a passive indicator of who is practising.
 * With an active learner it shows their avatar, first name and a K (kid) or
 * G (grown-up) badge; otherwise just the admin or anonymous avatar. Account,
 * Log out and the learner switcher all live in the menu drawer.
 */
export function AccountMenu(): ReactNode {
  const { formatMessage } = useIntl();
  const { publicUser } = usePageData();
  const { active } = useProfiles();
  const signedIn = publicUser.id != null;
  return (
    <span
      className={styles.anchor}
      title={formatMessage(
        defineMessage({
          id: "nav.account",
          defaultMessage: "Your account",
        }),
      )}
    >
      {active != null ? (
        <>
          <span className={styles.avatarWrap}>
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
          <span className={styles.name}>{active.firstName}</span>
        </>
      ) : (
        <Avatar user={signedIn ? publicUser : null} size="medium" />
      )}
    </span>
  );
}
