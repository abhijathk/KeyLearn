import { Avatar, Pages, usePageData } from "@keybr/pages-shared";
import { Popover } from "@keybr/widget";
import { type ReactNode, useState } from "react";
import { defineMessage, useIntl } from "react-intl";
import { NavLink } from "react-router";
import * as styles from "./AccountMenu.module.less";

export function AccountMenu(): ReactNode {
  const { formatMessage } = useIntl();
  const { publicUser } = usePageData();
  const [open, setOpen] = useState(false);
  const signedIn = publicUser.id != null;
  return (
    <Popover
      open={open}
      anchor={
        <button
          className={styles.anchor}
          title={formatMessage(
            defineMessage({
              id: "nav.account",
              defaultMessage: "Your account",
            }),
          )}
          onClick={() => {
            setOpen(!open);
          }}
        >
          <Avatar user={signedIn ? publicUser : null} size="medium" />
        </button>
      }
      offset={10}
    >
      <div className={styles.menu}>
        {signedIn && (
          <div className={styles.who}>
            <Avatar user={publicUser} size="medium" />
            <span className={styles.name}>{publicUser.name}</span>
          </div>
        )}
        <NavLink
          className={styles.link}
          to={Pages.account.path}
          onClick={() => {
            setOpen(false);
          }}
        >
          {signedIn
            ? formatMessage(Pages.account.link.label)
            : formatMessage(
                defineMessage({
                  id: "t_Sing_In",
                  defaultMessage: "Sign-In",
                }),
              )}
        </NavLink>
      </div>
    </Popover>
  );
}
