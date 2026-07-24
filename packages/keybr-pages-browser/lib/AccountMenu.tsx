import { ProfileAvatar, useProfiles } from "@keybr/page-account";
import { Avatar, usePageData } from "@keybr/pages-shared";
import { type ReactNode } from "react";
import { defineMessage, useIntl } from "react-intl";
import * as styles from "./AccountMenu.module.less";

/**
 * The header avatar is a passive indicator of who is practicing — Account,
 * Log out and the learner switcher all live in the menu drawer. The face
 * follows the usual priority: active learner, then the admin account, then
 * anonymous.
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
        <ProfileAvatar
          avatar={active.avatar}
          name={active.firstName}
          size={29}
        />
      ) : (
        <Avatar user={signedIn ? publicUser : null} size="medium" />
      )}
    </span>
  );
}
