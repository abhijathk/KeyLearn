import {
  type AnyUser,
  Avatar,
  isPremiumUser,
  Pages,
  usePageData,
  type UserDetails,
} from "@keybr/pages-shared";
import { Button, CheckBox, Icon, StrokeIcon } from "@keybr/widget";
import { mdiCreditCard } from "@mdi/js";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { NavLink, useNavigate } from "react-router";
import * as styles from "./AccountPage.module.less";
import { AccountPricePreview } from "./AccountPricePreview.tsx";
import { useAccountActions } from "./actions.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { ProfilesManager } from "./profiles/ProfilesManager.tsx";

export function AccountPage() {
  const { user, publicUser } = usePageData();
  if (user != null) {
    return <SignedIn user={user} publicUser={publicUser} />;
  }
  return <SignedOut />;
}

// The account floats over the app like the settings window — a dimmed,
// blurred backdrop and a centred panel in the road design language.
function FloatingShell({
  title,
  children,
}: {
  readonly title: ReactNode;
  readonly children: ReactNode;
}): ReactNode {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const close = () => navigate("/");
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) {
          close();
        }
      }}
    >
      <div className={styles.window} role="dialog" aria-modal={true}>
        <div className={styles.windowHead}>
          <span className={styles.windowTitle}>{title}</span>
          <button
            className={styles.windowClose}
            title={formatMessage({
              id: "account.close",
              defaultMessage: "Close and return to practice",
            })}
            onClick={close}
          >
            <StrokeIcon name="close" />
          </button>
        </div>
        <div className={styles.windowBody}>{children}</div>
      </div>
    </div>
  );
}

function SignedIn(props: { user: UserDetails; publicUser: AnyUser }) {
  const { formatMessage } = useIntl();
  const { user, publicUser, actions } = useAccountActions(props);
  const premium = isPremiumUser(publicUser);
  const [confirm, setConfirm] = useState<"logout" | "delete" | null>(null);

  return (
    <FloatingShell
      title={<FormattedMessage id="t_Account" defaultMessage="Account" />}
    >
      <div className={styles.page}>
        <div className={styles.identity}>
          <Avatar user={publicUser} size="large" />
          <div className={styles.identityText}>
            <span className={styles.displayName}>{publicUser.name}</span>
            <span className={styles.email}>{user.email}</span>
          </div>
        </div>

        {/* ── Profiles now live right inside the account ── */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>
              <FormattedMessage
                id="account.section.profiles"
                defaultMessage="Learner profiles"
              />
            </span>
          </div>
          <p className={styles.cardNote}>
            <FormattedMessage
              id="account.profiles.note"
              defaultMessage="Add a profile for each person in your household. Kids get the dino game; each profile keeps its own progress on this device."
            />
          </p>
          <ProfilesManager />
        </section>

        {/* ── Identity / privacy ── */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>
              <FormattedMessage
                id="account.section.settings"
                defaultMessage="Account"
              />
            </span>
          </div>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowLabel}>
                <FormattedMessage
                  id="account.anonymize.label"
                  defaultMessage="Hide my identity"
                />
              </span>
              <span className={styles.rowSub}>
                <FormattedMessage
                  id="account.anonymize.sub"
                  defaultMessage="Show a generated name and picture on leaderboards and multiplayer instead of your own."
                />
              </span>
            </div>
            <CheckBox
              checked={user.anonymized}
              onChange={() => {
                actions.patchAccount({ anonymized: !user.anonymized });
              }}
            />
          </div>
          <button
            className={styles.dangerLink}
            onClick={() => setConfirm("logout")}
          >
            <FormattedMessage id="nav.logOut" defaultMessage="Log out" />
          </button>
        </section>

        {/* ── Premium ── */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>
              <FormattedMessage
                id="t_Premium_account"
                defaultMessage="Premium membership"
              />
            </span>
          </div>
          {premium ? (
            <p className={styles.cardNote}>
              <FormattedMessage
                id="account.premium.thanks"
                defaultMessage="Thanks for going premium — enjoy the ad-free, tracker-free experience."
              />
            </p>
          ) : (
            <>
              <ul className={styles.perks}>
                <li>
                  <FormattedMessage
                    id="account.perk.ads"
                    defaultMessage="No ads, ever."
                  />
                </li>
                <li>
                  <FormattedMessage
                    id="account.perk.trackers"
                    defaultMessage="No trackers — full privacy."
                  />
                </li>
                <li>
                  <FormattedMessage
                    id="account.perk.speed"
                    defaultMessage="Faster pages. One-time purchase, lifetime access."
                  />
                </li>
              </ul>
              <AccountPricePreview />
              <Button
                size={16}
                icon={<Icon shape={mdiCreditCard} />}
                label={formatMessage({
                  id: "t_Buy_a_premium_",
                  defaultMessage: "Upgrade to premium",
                })}
                onClick={() => actions.checkout()}
              />
            </>
          )}
        </section>

        {/* ── Danger zone ── */}
        <section className={`${styles.card} ${styles.danger}`}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>
              <FormattedMessage
                id="account.section.danger"
                defaultMessage="Delete account"
              />
            </span>
          </div>
          <p className={styles.cardNote}>
            <FormattedMessage
              id="account.delete.note"
              defaultMessage="Permanently erases your name and email from our servers. This can't be undone. Your learner profiles stay on this device."
            />
          </p>
          <button
            className={styles.dangerLink}
            onClick={() => setConfirm("delete")}
          >
            <FormattedMessage
              id="t_Delete_account"
              defaultMessage="Delete account"
            />
          </button>
        </section>

        {confirm === "logout" && (
          <ConfirmDialog
            title={formatMessage({
              id: "account.logout.confirmTitle",
              defaultMessage: "Log out?",
            })}
            message={formatMessage({
              id: "account.logout.confirmMessage",
              defaultMessage:
                "You'll need to log back in to sync your progress. Learner profiles stay on this device.",
            })}
            confirmLabel={formatMessage({
              id: "nav.logOut",
              defaultMessage: "Log out",
            })}
            onConfirm={() => actions.logout()}
            onCancel={() => setConfirm(null)}
          />
        )}

        {confirm === "delete" && (
          <ConfirmDialog
            title={formatMessage({
              id: "account.delete.confirmTitle",
              defaultMessage: "Delete your account?",
            })}
            message={formatMessage({
              id: "account.deleteAccount.message",
              defaultMessage:
                "This permanently erases your name and email from our servers and can't be undone. You're always welcome to create a new account later.",
            })}
            confirmLabel={formatMessage({
              id: "t_Delete_account",
              defaultMessage: "Delete account",
            })}
            danger={true}
            onConfirm={() => actions.deleteAccount()}
            onCancel={() => setConfirm(null)}
          />
        )}
      </div>
    </FloatingShell>
  );
}

function SignedOut(): ReactNode {
  return (
    <FloatingShell
      title={<FormattedMessage id="t_Account" defaultMessage="Account" />}
    >
      <div className={styles.signedOut}>
        <h1 className={styles.welcomeTitle}>
          <FormattedMessage
            id="account.welcome.title"
            defaultMessage="Your KeyLearn account"
          />
        </h1>
        <p className={styles.cardNote}>
          <FormattedMessage
            id="account.welcome.note"
            defaultMessage="Create an account to back up your progress and set up a profile for each learner in your household. Or skip it — your progress stays on this device."
          />
        </p>
        <div className={styles.ctaRow}>
          <NavLink className={styles.ctaPrimary} to={Pages.register.path}>
            <FormattedMessage id="t_Register" defaultMessage="Register" />
          </NavLink>
          <NavLink className={styles.ctaGhost} to={Pages.login.path}>
            <FormattedMessage id="t_Log_In" defaultMessage="Log In" />
          </NavLink>
        </div>
      </div>
    </FloatingShell>
  );
}
