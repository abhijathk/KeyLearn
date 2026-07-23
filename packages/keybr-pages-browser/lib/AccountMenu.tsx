import { ProfileAvatar, useProfiles } from "@keybr/page-account";
import { Avatar, Pages, usePageData } from "@keybr/pages-shared";
import { type AnchorProps, getBoundingBox, Popover } from "@keybr/widget";
import { type ReactNode, useImperativeHandle, useRef, useState } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import { NavLink } from "react-router";
import * as styles from "./AccountMenu.module.less";

// The Popover injects an `anchor` ref and measures it with getBoundingBox();
// a plain <button> drops that ref, so the anchor must forward it.
function AnchorButton({
  anchor,
  title,
  onClick,
  children,
}: AnchorProps & {
  readonly title: string;
  readonly onClick: () => void;
  readonly children: ReactNode;
}): ReactNode {
  const element = useRef<HTMLButtonElement>(null);
  useImperativeHandle(anchor, () => ({
    getBoundingBox() {
      return getBoundingBox(element.current!);
    },
  }));
  return (
    <button
      ref={element}
      className={styles.anchor}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function AccountMenu(): ReactNode {
  const { formatMessage } = useIntl();
  const { publicUser } = usePageData();
  const { active } = useProfiles();
  const [open, setOpen] = useState(false);
  const signedIn = publicUser.id != null;
  const close = () => setOpen(false);
  return (
    <Popover
      open={open}
      anchor={
        <AnchorButton
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
          {active != null ? (
            // The selected learner fronts the menu; the admin avatar shows
            // for a credentials-only login, the anonymous face otherwise.
            <ProfileAvatar
              avatar={active.avatar}
              name={active.firstName}
              size={29}
            />
          ) : (
            <Avatar user={signedIn ? publicUser : null} size="medium" />
          )}
        </AnchorButton>
      }
      offset={10}
    >
      <div className={styles.menu}>
        {signedIn ? (
          <>
            <NavLink
              className={styles.link}
              to={Pages.account.path}
              onClick={close}
            >
              {formatMessage(Pages.account.link.label)}
            </NavLink>
            <a className={styles.link} href="/auth/logout">
              <FormattedMessage id="nav.logOut" defaultMessage="Log out" />
            </a>
          </>
        ) : (
          <>
            <NavLink
              className={styles.link}
              to={Pages.login.path}
              onClick={close}
            >
              <FormattedMessage id="t_Log_In" defaultMessage="Log In" />
            </NavLink>
            <NavLink
              className={styles.linkGhost}
              to={Pages.register.path}
              onClick={close}
            >
              <FormattedMessage id="t_Register" defaultMessage="Register" />
            </NavLink>
          </>
        )}
      </div>
    </Popover>
  );
}
