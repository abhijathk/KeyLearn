import {
  type AnyUser,
  Avatar,
  isPremiumUser,
  Pages,
  usePageData,
  type UserDetails,
} from "@keybr/pages-shared";
import { Button, Icon, TextField } from "@keybr/widget";
import { mdiCreditCard } from "@mdi/js";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { NavLink } from "react-router";
import * as styles from "./AccountPage.module.less";
import { AccountPricePreview } from "./AccountPricePreview.tsx";
import { type AccountActions, useAccountActions } from "./actions.ts";
import * as dlg from "./ConfirmDialog.module.less";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { Toggle } from "./controls.tsx";
import { FloatingShell } from "./FloatingShell.tsx";
import { PreferencesPane } from "./PreferencesPane.tsx";
import { ProfilesManager } from "./profiles/ProfilesManager.tsx";
import { SecurityCard } from "./SecurityCard.tsx";
import { AccountService } from "./service.ts";

type Pane = "account" | "learners" | "security" | "prefs" | "premium";

const PANES: readonly Pane[] = [
  "account",
  "learners",
  "security",
  "prefs",
  "premium",
];

// The window can be deep-linked to a pane via the URL hash, e.g.
// "/account#learners" (used by the nav drawer's "Manage" shortcut).
function initialPane(): Pane {
  if (typeof window === "undefined") {
    return "account";
  }
  const hash = window.location.hash.replace(/^#/, "");
  return PANES.includes(hash as Pane) ? (hash as Pane) : "account";
}

export function AccountPage() {
  const { user, publicUser } = usePageData();
  if (user != null) {
    return <SignedIn user={user} publicUser={publicUser} />;
  }
  return <SignedOut />;
}

function SignedIn(props: { user: UserDetails; publicUser: AnyUser }) {
  const { formatMessage } = useIntl();
  const { user, publicUser, actions } = useAccountActions(props);
  const premium = isPremiumUser(publicUser);
  const [pane, setPaneState] = useState<Pane>(initialPane);
  const setPane = (next: Pane) => {
    setPaneState(next);
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", `${Pages.account.path}#${next}`);
    }
  };

  // The browser's own back and forward buttons should move between panes too,
  // since that is what the URL now implies.
  useEffect(() => {
    const onPop = () => setPaneState(initialPane());
    window.addEventListener("hashchange", onPop);
    return () => window.removeEventListener("hashchange", onPop);
  }, []);
  const [confirm, setConfirm] = useState<
    "logout" | "delete" | "delete2" | "signout-all" | null
  >(null);
  const [signedOutAll, setSignedOutAll] = useState(false);

  return (
    <FloatingShell
      flush={true}
      title={<FormattedMessage id="t_Account" defaultMessage="Account" />}
    >
      <div className={styles.b5}>
        {/* ── Left rail ── */}
        <nav className={styles.rail}>
          <button
            className={clsx(styles.who, pane === "account" && styles.whoOn)}
            onClick={() => setPane("account")}
          >
            <Avatar user={publicUser} size="normal" />
            {/* Name only here — the address is shown in the content pane, and
                repeating it in a narrow rail just truncated it. */}
            <span className={styles.whoText}>
              <span className={styles.whoName}>{publicUser.name}</span>
            </span>
          </button>

          <RailItem
            on={pane === "learners"}
            onClick={() => setPane("learners")}
            icon={<LearnersIcon />}
            label={
              <FormattedMessage
                id="account.rail.learners"
                defaultMessage="Learners"
              />
            }
          />
          <RailItem
            on={pane === "security"}
            onClick={() => setPane("security")}
            icon={<ShieldIcon />}
            label={
              <FormattedMessage
                id="account.rail.security"
                defaultMessage="Security"
              />
            }
          />
          <RailItem
            on={pane === "prefs"}
            onClick={() => setPane("prefs")}
            icon={<GearIcon />}
            label={
              <FormattedMessage
                id="account.rail.prefs"
                defaultMessage="Preferences"
              />
            }
          />

          <div
            className={clsx(styles.promo, pane === "premium" && styles.promoOn)}
            role="button"
            tabIndex={0}
            onClick={() => setPane("premium")}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                setPane("premium");
              }
            }}
          >
            <span className={styles.promoTitle}>
              {premium ? (
                <FormattedMessage
                  id="account.rail.premiumOn"
                  defaultMessage="Premium"
                />
              ) : (
                <FormattedMessage
                  id="account.rail.premium"
                  defaultMessage="Go Premium"
                />
              )}
            </span>
            {!premium && (
              <>
                <span className={styles.promoSub}>
                  <FormattedMessage
                    id="account.rail.premiumSub"
                    defaultMessage="No ads, no trackers. One-time, lifetime."
                  />
                </span>
                <span className={styles.promoBtn}>
                  <FormattedMessage
                    id="account.rail.upgrade"
                    defaultMessage="Upgrade"
                  />
                </span>
              </>
            )}
          </div>

          <button
            className={styles.railLogout}
            onClick={() => setConfirm("logout")}
          >
            <LogoutIcon />
            <FormattedMessage id="nav.logOut" defaultMessage="Log out" />
          </button>
        </nav>

        {/* ── Right content pane ── */}
        <div className={styles.pane}>
          {pane === "account" && (
            <AccountPane
              user={user}
              publicUser={publicUser}
              onAnonymize={() =>
                actions.patchAccount({ anonymized: !user.anonymized })
              }
              onPublicProfile={() =>
                actions.patchAccount({ publicProfile: !user.publicProfile })
              }
              onLogout={() => setConfirm("logout")}
              onSignOutAll={() => setConfirm("signout-all")}
              onDelete={() => setConfirm("delete")}
              signedOutAll={signedOutAll}
            />
          )}

          {pane === "learners" && (
            <div className={styles.paneScroll}>
              <h2 className={styles.paneTitle}>
                <FormattedMessage
                  id="account.section.profiles"
                  defaultMessage="Learner profiles"
                />
              </h2>
              <p className={styles.cardNote}>
                <FormattedMessage
                  id="account.profiles.note"
                  defaultMessage="Add a profile for each person in your household. Kids get the dino game; each profile keeps its own progress on this device."
                />
              </p>
              <ProfilesManager />
            </div>
          )}

          {pane === "security" && (
            <div className={styles.paneScroll}>
              <SecurityCard
                user={user}
                onChanged={() => {
                  // The 2FA and PIN flags live on the account record, so pull a
                  // fresh copy rather than guessing the new state client-side.
                  actions.patchAccount({});
                }}
              />
            </div>
          )}

          {pane === "prefs" && <PreferencesPane />}

          {pane === "premium" && (
            <div className={styles.paneScroll}>
              <PremiumPane
                premium={premium}
                onCheckout={() => actions.checkout()}
              />
            </div>
          )}
        </div>
      </div>

      {confirm === "logout" && (
        <ConfirmDialog
          title={formatMessage({
            id: "account.logout.confirmTitle",
            defaultMessage: "Log out?",
          })}
          message={formatMessage({
            id: "account.logout.confirmMessage",
            defaultMessage:
              "You’ll need to log back in to sync your progress. Learner profiles stay on this device.",
          })}
          confirmLabel={formatMessage({
            id: "nav.logOut",
            defaultMessage: "Log out",
          })}
          onConfirm={() => actions.logout()}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm === "signout-all" && (
        <ConfirmDialog
          title={formatMessage({
            id: "account.signOutAll.confirmTitle",
            defaultMessage: "Log out of all other devices?",
          })}
          message={formatMessage({
            id: "account.signOutAll.confirmMessage",
            defaultMessage:
              "Every other phone, tablet or computer logged in to this account will be logged out. This device stays logged in.",
          })}
          confirmLabel={formatMessage({
            id: "account.signOutAll",
            defaultMessage: "Log out of all other devices",
          })}
          onConfirm={() => {
            AccountService.signOutEverywhere()
              .then(() => setSignedOutAll(true))
              .catch(() => {});
            setConfirm(null);
          }}
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
              "This permanently erases your name and email from our servers and can’t be undone. You’re always welcome to create a new account later.",
          })}
          confirmLabel={formatMessage({
            id: "account.delete.continue",
            defaultMessage: "Continue",
          })}
          danger={true}
          onConfirm={() => setConfirm("delete2")}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm === "delete2" && (
        <DeleteAccountDialog
          email={user.email}
          actions={actions}
          onCancel={() => setConfirm(null)}
        />
      )}
    </FloatingShell>
  );
}

function AccountPane({
  user,
  publicUser,
  onAnonymize,
  onPublicProfile,
  onLogout,
  onSignOutAll,
  onDelete,
  signedOutAll,
}: {
  readonly user: UserDetails;
  readonly publicUser: AnyUser;
  readonly onAnonymize: () => void;
  readonly onPublicProfile: () => void;
  readonly onLogout: () => void;
  readonly onSignOutAll: () => void;
  readonly onDelete: () => void;
  readonly signedOutAll: boolean;
}): ReactNode {
  return (
    <div className={styles.paneScroll}>
      <div className={styles.identity}>
        <Avatar user={publicUser} size="large" />
        <div className={styles.identityText}>
          <span className={styles.displayName}>
            {publicUser.name}
            {/* SSO accounts are verified by the provider, so treat a connected
                sign-in method as verified too. */}
            {(user.emailVerified || user.externalId.length > 0) && (
              <VerifiedBadge />
            )}
          </span>
          <span className={styles.email}>{user.email}</span>
        </div>
      </div>

      <div className={styles.prefCard}>
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
          <Toggle on={user.anonymized} onChange={onAnonymize} />
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowLabel}>
              <FormattedMessage
                id="account.publicProfile"
                defaultMessage="Public profile page"
              />
            </span>
            <span className={styles.rowSub}>
              <FormattedMessage
                id="account.publicProfile.sub"
                defaultMessage="Let anyone with your profile link see your typing history. Off by default — profile links are guessable, so this makes your history public to everyone."
              />
            </span>
          </div>
          <Toggle on={user.publicProfile} onChange={onPublicProfile} />
        </div>
      </div>

      <div className={styles.prefCard}>
        <div className={styles.miniRow}>
          <span>
            <FormattedMessage id="nav.logOut" defaultMessage="Log out" />
          </span>
          <button className={styles.subtleBtnWarn} onClick={onLogout}>
            <FormattedMessage id="nav.logOut" defaultMessage="Log out" />
          </button>
        </div>
        <div className={styles.hr} />
        <div className={styles.miniRow}>
          <span>
            <FormattedMessage
              id="account.signOutAll"
              defaultMessage="Log out of all other devices"
            />
          </span>
          <button className={styles.subtleBtnWarn} onClick={onSignOutAll}>
            <FormattedMessage id="nav.logOut" defaultMessage="Log out" />
          </button>
        </div>
        {signedOutAll && (
          <p className={styles.cardNote}>
            <FormattedMessage
              id="account.signOutAll.done"
              defaultMessage="Logged out everywhere else. This device is still logged in."
            />
          </p>
        )}
      </div>

      <div className={clsx(styles.prefCard, styles.dangerCard)}>
        <div className={clsx(styles.prefSect, styles.dangerSect)}>
          <FormattedMessage
            id="account.section.danger"
            defaultMessage="Delete account"
          />
        </div>
        <p className={styles.cardNote}>
          <FormattedMessage
            id="account.delete.note"
            defaultMessage="Permanently erases your name and email from our servers. This can’t be undone. Your learner profiles stay on this device."
          />
        </p>
        <button className={styles.dangerBtn} onClick={onDelete}>
          <FormattedMessage
            id="t_Delete_account"
            defaultMessage="Delete account"
          />
        </button>
      </div>
    </div>
  );
}

function PremiumPane({
  premium,
  onCheckout,
}: {
  readonly premium: boolean;
  readonly onCheckout: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  return (
    <>
      <h2 className={styles.paneTitle}>
        <FormattedMessage
          id="t_Premium_account"
          defaultMessage="Premium membership"
        />
      </h2>
      {premium ? (
        <p className={styles.cardNote}>
          <FormattedMessage
            id="account.premium.thanks"
            defaultMessage="Thanks for going premium — enjoy the ad-free, tracker-free experience."
          />
        </p>
      ) : (
        <div className={styles.prefCard}>
          <div className={styles.perkRow}>
            <CheckIcon />
            <FormattedMessage
              id="account.perk.ads"
              defaultMessage="No ads, ever."
            />
          </div>
          <div className={styles.perkRow}>
            <CheckIcon />
            <FormattedMessage
              id="account.perk.trackers"
              defaultMessage="No trackers — full privacy."
            />
          </div>
          <div className={styles.perkRow}>
            <CheckIcon />
            <FormattedMessage
              id="account.perk.speed"
              defaultMessage="Faster pages. One-time purchase, lifetime access."
            />
          </div>
          <div className={styles.hr} />
          <AccountPricePreview />
          <Button
            size={16}
            icon={<Icon shape={mdiCreditCard} />}
            label={formatMessage({
              id: "t_Buy_a_premium_",
              defaultMessage: "Upgrade to premium",
            })}
            onClick={onCheckout}
          />
        </div>
      )}
    </>
  );
}

function CheckIcon(): ReactNode {
  return (
    <svg className={styles.checkIcon} viewBox="0 0 24 24">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// The final, strongest delete step: a 6-digit code is emailed to the account's
// registered address and must be entered to permanently delete it.
function DeleteAccountDialog({
  email,
  actions,
  onCancel,
}: {
  readonly email: string;
  readonly actions: AccountActions;
  readonly onCancel: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [code, setCode] = useState("");
  const [keepStats, setKeepStats] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Email the code as soon as the dialog opens.
  useEffect(() => {
    actions.sendDeleteAccountCode().catch(() => {
      setErr(
        formatMessage({
          id: "account.delete.sendError",
          defaultMessage: "Couldn’t send the code. Try again in a moment.",
        }),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const confirm = () => {
    if (code.trim().length !== 6 || busy) {
      return;
    }
    setBusy(true);
    setErr(null);
    actions.deleteAccount(code.trim(), keepStats).catch((e) => {
      setErr(
        e?.message ??
          formatMessage({
            id: "account.delete.codeError",
            defaultMessage: "That code is incorrect or has expired.",
          }),
      );
      setBusy(false);
    });
  };

  return (
    <div
      className={dlg.scrim}
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className={dlg.dialog} role="alertdialog" aria-modal={true}>
        <h2 className={dlg.title}>
          <FormattedMessage
            id="account.delete.finalTitle"
            defaultMessage="Last step — this is permanent"
          />
        </h2>
        <p className={dlg.message}>
          <FormattedMessage
            id="account.delete.codeMessage"
            defaultMessage="Enter the 6-digit code we emailed to {email} to permanently delete your account. There is no undo."
            values={{ email: <strong>{email}</strong> }}
          />
        </p>
        <TextField
          size="full"
          type="text"
          autoComplete="one-time-code"
          autoFocus={true}
          maxLength={6}
          placeholder={formatMessage({
            id: "auth.verify.codePlaceholder",
            defaultMessage: "6-digit code",
          })}
          value={code}
          onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
        />
        <button
          type="button"
          className={styles.link}
          onClick={() => {
            setErr(null);
            actions.sendDeleteAccountCode().catch(() => {});
          }}
        >
          <FormattedMessage
            id="account.delete.resend"
            defaultMessage="Resend the code"
          />
        </button>
        <label className={styles.keepStats}>
          <input
            type="checkbox"
            checked={keepStats}
            onChange={(ev) => setKeepStats(ev.target.checked)}
          />
          <span>
            <FormattedMessage
              id="account.delete.keepStats"
              defaultMessage="Help improve KeyLearn — keep my anonymous typing stats. No name, email, or child data; this can’t identify you."
            />
          </span>
        </label>
        {err != null && <p className={styles.secErr}>{err}</p>}
        <div className={dlg.actions}>
          <button className={clsx(dlg.btn, dlg.cancel)} onClick={onCancel}>
            <FormattedMessage id="t_Cancel" defaultMessage="Cancel" />
          </button>
          <button
            className={clsx(dlg.btn, dlg.confirm, dlg.confirmDanger)}
            disabled={code.trim().length !== 6 || busy}
            onClick={confirm}
          >
            <FormattedMessage
              id="account.delete.final"
              defaultMessage="Delete forever"
            />
          </button>
        </div>
      </div>
    </div>
  );
}

// A Twitter/X-style verified seal: a scalloped badge with a checkmark, shown
// inline right after the account holder's name.
function VerifiedBadge(): ReactNode {
  return (
    <svg
      className={styles.verifiedBadge}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Verified"
    >
      <path
        className={styles.verifiedSeal}
        d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
      />
      <path
        className={styles.verifiedCheck}
        d="M9.8 17.3l-4.2-4.1L7 11.8l2.8 2.7L17 7.4l1.4 1.5z"
      />
    </svg>
  );
}

function RailItem({
  on,
  onClick,
  icon,
  label,
}: {
  readonly on: boolean;
  readonly onClick: () => void;
  readonly icon: ReactNode;
  readonly label: ReactNode;
}): ReactNode {
  return (
    <button className={clsx(styles.nav, on && styles.navOn)} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

// ── Rail icons (stroked, matching the account mock) ──

function LearnersIcon(): ReactNode {
  return (
    <svg className={styles.railIcon} viewBox="0 0 24 24">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 3-5.5 6-5.5s6 2.2 6 5.5" />
    </svg>
  );
}

function ShieldIcon(): ReactNode {
  return (
    <svg className={styles.railIcon} viewBox="0 0 24 24">
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
    </svg>
  );
}

function GearIcon(): ReactNode {
  return (
    <svg className={styles.railIcon} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a7.9 7.9 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1l-.4-2.6h-4l-.4 2.6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4L4.6 11a7.9 7.9 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7 7 0 0 0 1.7-1l2.3 1 2-3.4z" />
    </svg>
  );
}

function LogoutIcon(): ReactNode {
  return (
    <svg className={styles.railIcon} viewBox="0 0 24 24">
      <path d="M16 17l5-5-5-5M21 12H9M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7" />
    </svg>
  );
}

function SignedOut(): ReactNode {
  return (
    <FloatingShell
      compact={true}
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
