import { Avatar, Pages, usePageData } from "@keybr/pages-shared";
import { type AnchorProps, getBoundingBox, Popover } from "@keybr/widget";
import { type ReactNode, useImperativeHandle, useRef, useState } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import { NavLink, useNavigate } from "react-router";
import * as styles from "./AccountMenu.module.less";
import { useProfiles } from "./profiles/context.tsx";
import { ProfileAvatar } from "./profiles/ProfileAvatar.tsx";

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
          <Avatar user={signedIn ? publicUser : null} size="medium" />
        </AnchorButton>
      }
      offset={10}
    >
      <div className={styles.menu}>
        <ProfileSwitcher onNavigate={close} />
        {signedIn ? (
          <>
            <div className={styles.who}>
              <Avatar user={publicUser} size="medium" />
              <span className={styles.name}>{publicUser.name}</span>
            </div>
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

// The household profile switcher: the active learner, quick avatars to swap,
// and a link to manage. Local to this device, shown signed in or out.
function ProfileSwitcher({
  onNavigate,
}: {
  readonly onNavigate: () => void;
}): ReactNode {
  const navigate = useNavigate();
  const { publicUser } = usePageData();
  const { household, active, select } = useProfiles();
  const signedIn = publicUser.id != null;
  if (household.profiles.length === 0) {
    // Profiles need an account first, so point signed-out visitors at login.
    return (
      <NavLink
        className={styles.link}
        to={signedIn ? Pages.profiles.path : Pages.login.path}
        onClick={onNavigate}
      >
        {signedIn ? (
          <FormattedMessage
            id="nav.setUpProfiles"
            defaultMessage="Set up profiles"
          />
        ) : (
          <FormattedMessage
            id="nav.loginForProfiles"
            defaultMessage="Log in to add profiles"
          />
        )}
      </NavLink>
    );
  }
  const switchTo = (id: string, kind: "adult" | "kid") => {
    select(id);
    onNavigate();
    navigate(kind === "kid" ? "/kids" : "/");
  };
  return (
    <div className={styles.switcher}>
      <div className={styles.switcherLabel}>
        <FormattedMessage id="nav.learners" defaultMessage="Learners" />
      </div>
      <div className={styles.avatars}>
        {household.profiles.map((p) => (
          <button
            key={p.id}
            className={
              active?.id === p.id ? styles.avatarPickOn : styles.avatarPick
            }
            title={p.firstName}
            onClick={() => switchTo(p.id, p.kind)}
          >
            <ProfileAvatar avatar={p.avatar} name={p.firstName} size={34} />
          </button>
        ))}
      </div>
      <NavLink
        className={styles.linkGhost}
        to={Pages.profiles.path}
        onClick={onNavigate}
      >
        <FormattedMessage
          id="nav.manageProfiles"
          defaultMessage="Manage profiles"
        />
      </NavLink>
    </div>
  );
}
