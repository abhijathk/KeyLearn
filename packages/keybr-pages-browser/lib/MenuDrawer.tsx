import { ConfirmDialog, ProfileAvatar, useProfiles } from "@keybr/page-account";
import { Pages, usePageData } from "@keybr/pages-shared";
import { IconButton, StrokeIcon } from "@keybr/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import { Link as RouterLink, useNavigate } from "react-router";
import { LanguagePanel } from "./LanguagePanel.tsx";
import * as styles from "./MenuDrawer.module.less";
import { NavMenu } from "./NavMenu.tsx";

// Remembered so the ad slot (grown-ups only) and future visits know which
// side of the app the household uses.
function rememberMode(mode: "grown-ups" | "kids") {
  try {
    localStorage.setItem("keylearn.mode", mode);
  } catch {
    // Storage may be unavailable.
  }
}

export function MenuDrawer({
  open,
  onClose,
  path,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly path: string;
}): ReactNode {
  const { formatMessage } = useIntl();
  // A kid profile gets a locked-down drawer: navigation, settings, language
  // and the utility links are grown-ups only.
  const navigate = useNavigate();
  const { publicUser } = usePageData();
  const { household, active, select } = useProfiles();
  const signedIn = publicUser.id != null;
  const kidLock = active?.kind === "kid";
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Switching learners keeps the drawer open — parents often flip between
  // profiles to compare, and the panel survives the app remount underneath.
  const switchTo = (id: string, kind: "adult" | "kid") => {
    select(id);
    navigate(kind === "kid" ? Pages.kids.path : Pages.practice.path);
  };

  // The Grown-ups / Kids switch is only relevant when signed out or when the
  // account has no profiles yet — once profiles exist, the learner switcher
  // above covers every destination. (The provider presents an empty
  // household while signed out, so that case is covered too.)
  const showModeSwitch = household.profiles.length === 0;

  // The who's-practicing switch also swaps the active profile: Grown-ups
  // picks an adult profile (or none, showing the admin avatar); Kids picks a
  // kid profile when one exists.
  const toGrownUps = () => {
    if (active?.kind !== "adult") {
      const adult = household.profiles.find((p) => p.kind === "adult");
      select(adult?.id ?? null);
    }
    rememberMode("grown-ups");
    onClose();
  };
  const toKids = () => {
    if (active?.kind !== "kid") {
      const kid = household.profiles.find((p) => p.kind === "kid");
      if (kid != null) {
        select(kid.id);
      }
    }
    rememberMode("kids");
    onClose();
  };
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);
  return (
    <>
      <div
        className={clsx(styles.scrim, open && styles.open)}
        onClick={onClose}
      />
      <aside
        className={clsx(styles.panel, open && styles.open)}
        aria-hidden={!open}
      >
        <div className={styles.head}>
          <StrokeIcon className={styles.headIcon} name="keyboard" />
          <span className={styles.title}>KeyLearn</span>
          <IconButton
            icon={<StrokeIcon name="close" />}
            title={formatMessage(
              defineMessage({
                id: "nav.closeMenu",
                defaultMessage: "Close navigation",
              }),
            )}
            onClick={onClose}
          />
        </div>
        {open && (
          <>
            {household.profiles.length > 0 ? (
              <>
                <div className={styles.label}>
                  <FormattedMessage
                    id="nav.learners"
                    defaultMessage="Learners"
                  />
                </div>
                <div className={styles.learners}>
                  {household.profiles.map((p) => (
                    <button
                      key={p.id}
                      className={clsx(
                        styles.learner,
                        active?.id === p.id && styles.learnerOn,
                      )}
                      title={p.firstName}
                      onClick={() => switchTo(p.id, p.kind)}
                    >
                      <ProfileAvatar
                        avatar={p.avatar}
                        name={p.firstName}
                        size={36}
                      />
                      <span className={styles.learnerName}>{p.firstName}</span>
                      <span className={styles.learnerKind}>
                        {p.kind === "kid" ? (
                          <FormattedMessage
                            id="profiles.kid"
                            defaultMessage="Kid"
                          />
                        ) : (
                          <FormattedMessage
                            id="profiles.adult"
                            defaultMessage="Grown-up"
                          />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              signedIn && (
                <RouterLink
                  className={styles.setupLink}
                  to={Pages.account.path}
                  onClick={onClose}
                >
                  <FormattedMessage
                    id="nav.setUpProfiles"
                    defaultMessage="Set up profiles"
                  />
                </RouterLink>
              )
            )}
            {showModeSwitch && (
              <>
                <div className={styles.label}>
                  <FormattedMessage
                    id="drawer.who"
                    defaultMessage="Who's practicing"
                  />
                </div>
                <div className={styles.seg}>
                  <RouterLink
                    className={clsx(
                      styles.segBtn,
                      path !== Pages.kids.path && styles.segOn,
                    )}
                    to={Pages.practice.path}
                    onClick={toGrownUps}
                  >
                    <FormattedMessage
                      id="drawer.grownUps"
                      defaultMessage="Grown-ups"
                    />
                  </RouterLink>
                  <RouterLink
                    className={clsx(
                      styles.segBtn,
                      path === Pages.kids.path && styles.segOn,
                    )}
                    to={Pages.kids.path}
                    onClick={toKids}
                  >
                    <FormattedMessage id="drawer.kids" defaultMessage="Kids" />
                  </RouterLink>
                </div>
              </>
            )}
            {kidLock && (
              <div className={styles.lockNote}>
                <FormattedMessage
                  id="drawer.kidLock"
                  defaultMessage="Grown-ups only — switch to a grown-up profile to use these."
                />
              </div>
            )}
            <div
              className={clsx(kidLock && styles.locked)}
              aria-disabled={kidLock}
              // Inert blocks clicks and keyboard focus for the whole zone.
              inert={kidLock}
            >
              <div className={styles.label}>
                <FormattedMessage id="drawer.goTo" defaultMessage="Explore" />
              </div>
              <NavMenu currentPath={path} onNavigate={onClose} />
              <div className={styles.label}>
                <FormattedMessage
                  id="drawer.language"
                  defaultMessage="Site language"
                />
              </div>
              <LanguagePanel currentPath={path} />
            </div>
            <div
              className={clsx(styles.account, kidLock && styles.locked)}
              aria-disabled={kidLock}
              inert={kidLock}
            >
              <div className={styles.util}>
                <RouterLink to={Pages.about.path} onClick={onClose}>
                  <StrokeIcon className={styles.utilIcon} name="help" />
                  {formatMessage(Pages.about.link.label)}
                </RouterLink>
                {signedIn ? (
                  <RouterLink to={Pages.account.path} onClick={onClose}>
                    <StrokeIcon className={styles.utilIcon} name="user" />
                    {formatMessage(Pages.account.link.label)}
                  </RouterLink>
                ) : (
                  <>
                    <RouterLink to={Pages.login.path} onClick={onClose}>
                      <StrokeIcon className={styles.utilIcon} name="user" />
                      <FormattedMessage id="t_Log_In" defaultMessage="Log In" />
                    </RouterLink>
                    <RouterLink to={Pages.register.path} onClick={onClose}>
                      <StrokeIcon className={styles.utilIcon} name="people" />
                      <FormattedMessage
                        id="t_Register"
                        defaultMessage="Register"
                      />
                    </RouterLink>
                  </>
                )}
                <RouterLink to={Pages.termsOfService.path} onClick={onClose}>
                  <StrokeIcon className={styles.utilIcon} name="doc" />
                  {formatMessage(Pages.termsOfService.link.label)}
                </RouterLink>
                <RouterLink to={Pages.privacyPolicy.path} onClick={onClose}>
                  <StrokeIcon className={styles.utilIcon} name="shield" />
                  {formatMessage(Pages.privacyPolicy.link.label)}
                </RouterLink>
                {signedIn && (
                  <a
                    className={styles.logout}
                    href="/auth/logout"
                    onClick={(ev) => {
                      ev.preventDefault();
                      setConfirmLogout(true);
                    }}
                  >
                    <StrokeIcon className={styles.utilIcon} name="back" />
                    <FormattedMessage
                      id="nav.logOut"
                      defaultMessage="Log out"
                    />
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </aside>
      {confirmLogout && (
        <ConfirmDialog
          title={formatMessage(
            defineMessage({
              id: "drawer.logout.title",
              defaultMessage: "Log out?",
            }),
          )}
          message={formatMessage(
            defineMessage({
              id: "drawer.logout.message",
              defaultMessage:
                "Practice history stays on this device and on your account. You can log back in any time.",
            }),
          )}
          confirmLabel={formatMessage(
            defineMessage({
              id: "nav.logOut",
              defaultMessage: "Log out",
            }),
          )}
          onConfirm={() => {
            window.location.href = "/auth/logout";
          }}
          onCancel={() => setConfirmLogout(false)}
        />
      )}
    </>
  );
}
