import { ProfileAvatar, useProfiles } from "@keybr/page-account";
import { Avatar, Pages, usePageData } from "@keybr/pages-shared";
import { type ReactNode } from "react";
import { defineMessage, useIntl } from "react-intl";
import { useNavigate } from "react-router";
import * as styles from "./AccountMenu.module.less";

/**
 * The header avatar. Account and Log out live at the bottom of the menu
 * drawer, so the avatar itself is a direct door: the account page when
 * signed in, the login page otherwise. The face shown follows the usual
 * priority — active learner, then the admin account, then anonymous.
 */
export function AccountMenu(): ReactNode {
  const { formatMessage } = useIntl();
  const { publicUser } = usePageData();
  const { active } = useProfiles();
  const navigate = useNavigate();
  const signedIn = publicUser.id != null;
  return (
    <button
      className={styles.anchor}
      title={formatMessage(
        defineMessage({
          id: "nav.account",
          defaultMessage: "Your account",
        }),
      )}
      onClick={() => {
        navigate(signedIn ? Pages.account.path : Pages.login.path);
      }}
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
    </button>
  );
}
