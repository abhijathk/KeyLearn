import {
  type AnyUser,
  Avatar,
  isPremiumUser,
  Pages,
  PROFILE_NAME_MAX,
  usePageData,
  type UserDetails,
} from "@keylearn/pages-shared";
import { Button, Icon, TextField } from "@keylearn/widget";
import { confirmStyles as dlg } from "@keylearn/widget";
import { ConfirmDialog } from "@keylearn/widget";
import { mdiCreditCard } from "@mdi/js";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { NavLink } from "react-router";
import * as styles from "./AccountPage.module.less";
import { AccountPricePreview } from "./AccountPricePreview.tsx";
import { type AccountActions, useAccountActions } from "./actions.ts";
import { Toggle } from "./controls.tsx";
import { CoursePane } from "./course/CoursePane.tsx";
import { FloatingShell } from "./FloatingShell.tsx";
import { AppearancePane, PreferencesPane } from "./PreferencesPane.tsx";
import { ProfilesManager } from "./profiles/ProfilesManager.tsx";
import { SecurityCard } from "./SecurityCard.tsx";
import { AccountService } from "./service.ts";

type Pane =
  | "account"
  | "learners"
  | "course"
  | "security"
  | "appearance"
  | "prefs"
  | "premium";

/**
 * Whether the premium pane and its upsell are shown.
 *
 * Off until the paid tier actually exists. What shipped here offered "no ads,
 * no trackers, one-time, lifetime" — the app carries no advertising, the tier
 * gated only extra learner profiles, and lifetime is no longer the plan. Rather
 * than sell that, the entrance is closed until there is something behind it.
 *
 * See docs/premium-and-ai.md. Turn this on with F1 (tier structure).
 */
const PREMIUM_VISIBLE = false;

const PANES: readonly Pane[] = [
  "account",
  "learners",
  "course",
  "security",
  "appearance",
  "prefs",
  ...(PREMIUM_VISIBLE ? (["premium"] as const) : []),
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
    "logout" | "delete" | "delete2" | null
  >(null);
  // Lifted, because the confirmation has to say which of the two logouts is
  // about to happen — the wider one is not undoable by logging back in here.
  const [alsoEverywhere, setAlsoEverywhere] = useState(false);
  // Which factor will confirm the deletion, chosen on the first dialog and
  // carried into the second, plus the other factors this account holds.
  const [deleteMethod, setDeleteMethod] = useState<DeleteMethod>("email");
  const [deleteOthers, setDeleteOthers] = useState<readonly DeleteMethod[]>([]);

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
            on={pane === "course"}
            onClick={() => setPane("course")}
            icon={<CourseIcon />}
            label={
              <FormattedMessage
                id="account.rail.course"
                defaultMessage="Course"
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
            on={pane === "appearance"}
            onClick={() => setPane("appearance")}
            icon={<PaletteIcon />}
            label={
              <FormattedMessage
                id="account.rail.appearance"
                defaultMessage="Appearance"
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

          {PREMIUM_VISIBLE && (
            <div
              className={clsx(
                styles.promo,
                pane === "premium" && styles.promoOn,
              )}
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
          )}

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
              alsoEverywhere={alsoEverywhere}
              onAlsoEverywhere={setAlsoEverywhere}
              onLogout={() => setConfirm("logout")}
              onDelete={() => setConfirm("delete")}
              onRename={(name) => actions.patchAccount({ name })}
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

          {pane === "course" && (
            <div className={styles.paneScroll}>
              <CoursePane />
            </div>
          )}

          {pane === "appearance" && <AppearancePane />}

          {pane === "prefs" && <PreferencesPane />}

          {PREMIUM_VISIBLE && pane === "premium" && (
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
          message={
            alsoEverywhere
              ? formatMessage({
                  id: "account.logout.confirmMessageAll",
                  defaultMessage:
                    "This device and every other phone, tablet or computer logged in to this account will be logged out. You’ll need to log back in to sync your progress. Learner profiles stay on this device.",
                })
              : formatMessage({
                  id: "account.logout.confirmMessage",
                  defaultMessage:
                    "You’ll need to log back in to sync your progress. Learner profiles stay on this device.",
                })
          }
          confirmLabel={formatMessage({
            id: "nav.logOut",
            defaultMessage: "Log out",
          })}
          onConfirm={async () => {
            // Everywhere else first: once this device's session is gone the
            // request that revokes the others has nothing left to authorise.
            if (alsoEverywhere) {
              await AccountService.signOutEverywhere().catch(() => {});
            }
            await actions.logout();
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
          // How to confirm is chosen HERE, before the next step — otherwise
          // opening that step emails a code to somebody who meant to use their
          // passkey all along.
          extra={
            <DeleteMethodChooser
              actions={actions}
              method={deleteMethod}
              onChange={setDeleteMethod}
              onMethods={setDeleteOthers}
            />
          }
          onConfirm={() => setConfirm("delete2")}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm === "delete2" && (
        <DeleteAccountDialog
          email={user.email}
          actions={actions}
          method={deleteMethod}
          others={deleteOthers}
          onChangeMethod={setDeleteMethod}
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
  alsoEverywhere,
  onAlsoEverywhere,
  onLogout,
  onDelete,
  onRename,
}: {
  readonly user: UserDetails;
  readonly publicUser: AnyUser;
  readonly onAnonymize: () => void;
  readonly onPublicProfile: () => void;
  readonly alsoEverywhere: boolean;
  readonly onAlsoEverywhere: (on: boolean) => void;
  readonly onLogout: () => void;
  readonly onDelete: () => void;
  readonly onRename: (name: string) => void;
}): ReactNode {
  return (
    <div className={styles.paneScroll}>
      <div className={styles.identity}>
        <Avatar user={publicUser} size="large" />
        <div className={styles.identityText}>
          {/* The handle leaderboards, a public profile and the wordmark
              show. It was set once at sign-up — and for an account created
              through a provider it was set to whatever that provider called
              them, surname and all, with no way back to it. */}
          <NameEditor
            name={publicUser.name}
            onRename={onRename}
            verified={user.emailVerified || user.externalId.length > 0}
          />
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

      {/* One action, with the wider reach as an option on it. Two separate
          "Log out" buttons a row apart, both labelled the same, asked the
          reader to tell them apart by the sentence beside them — and the
          worse mistake of the two was silent. */}
      <div className={styles.prefCard}>
        <div className={styles.miniRow}>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={alsoEverywhere}
              onChange={(e) => onAlsoEverywhere(e.target.checked)}
            />
            <span>
              <FormattedMessage
                id="account.signOutAll"
                defaultMessage="Log out of all other devices"
              />
            </span>
          </label>
          <button className={styles.subtleBtnWarn} onClick={onLogout}>
            <FormattedMessage id="nav.logOut" defaultMessage="Log out" />
          </button>
        </div>
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

// The final, strongest delete step. An emailed code is the default because
// every account has an address, but somebody who has lost access to their inbox
// can confirm with any other factor the account actually holds — so the other
// methods appear only when they are set up, tucked behind "other ways".
type DeleteMethod = "email" | "totp" | "password" | "passkey";

// How each factor is named where the account holder picks it.
function MethodName({ method }: { readonly method: DeleteMethod }): ReactNode {
  switch (method) {
    case "email":
      return (
        <FormattedMessage
          id="account.delete.methodEmail"
          defaultMessage="A code emailed to me"
        />
      );
    case "passkey":
      return (
        <FormattedMessage
          id="account.delete.methodPasskey"
          defaultMessage="My passkey"
        />
      );
    case "totp":
      return (
        <FormattedMessage
          id="account.delete.methodTotp"
          defaultMessage="My authenticator app"
        />
      );
    case "password":
      return (
        <FormattedMessage
          id="account.delete.methodPassword"
          defaultMessage="My password"
        />
      );
  }
}

// The same four factors, phrased as a change of mind partway through.
function MethodSwitchLabel({
  method,
}: {
  readonly method: DeleteMethod;
}): ReactNode {
  switch (method) {
    case "email":
      return (
        <FormattedMessage
          id="account.delete.useEmail"
          defaultMessage="Use an emailed code instead"
        />
      );
    case "passkey":
      return (
        <FormattedMessage
          id="account.delete.usePasskey"
          defaultMessage="Use my passkey instead"
        />
      );
    case "totp":
      return (
        <FormattedMessage
          id="account.delete.useTotp"
          defaultMessage="Use my authenticator app instead"
        />
      );
    case "password":
      return (
        <FormattedMessage
          id="account.delete.usePassword"
          defaultMessage="Use my password instead"
        />
      );
  }
}

/**
 * Picks the factor that will confirm the deletion, on the first dialog. An
 * emailed code is the default because every account has an address; the rest
 * appear only when the account actually holds them, and only on request.
 */
function DeleteMethodChooser({
  actions,
  method,
  onChange,
  onMethods,
}: {
  readonly actions: AccountActions;
  readonly method: DeleteMethod;
  readonly onChange: (method: DeleteMethod) => void;
  readonly onMethods: (others: readonly DeleteMethod[]) => void;
}): ReactNode {
  const [choices, setChoices] = useState<readonly DeleteMethod[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    actions
      .deleteAccountMethods()
      .then((m) => {
        const rest: DeleteMethod[] = [];
        if (m.passkey) {
          rest.push("passkey");
        }
        if (m.totp) {
          rest.push("totp");
        }
        if (m.password) {
          rest.push("password");
        }
        onMethods(rest);
        setChoices(m.email ? ["email", ...rest] : rest);
        // An account with no address has no default to fall back on.
        if (!m.email && rest.length > 0) {
          onChange(rest[0]);
          setOpen(true);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nothing to choose between: say nothing rather than show a menu of one.
  if (choices.length < 2) {
    return null;
  }

  return (
    <div className={styles.methodChoice}>
      <p className={styles.methodLabel}>
        <FormattedMessage
          id="account.delete.howConfirm"
          defaultMessage="Confirm with:"
        />{" "}
        <strong>
          <MethodName method={method} />
        </strong>
      </p>
      {open ? (
        <div className={styles.methodList}>
          {choices.map((m) => (
            <label key={m} className={styles.methodOption}>
              <input
                type="radio"
                name="delete-method"
                checked={m === method}
                onChange={() => onChange(m)}
              />
              <MethodName method={m} />
            </label>
          ))}
        </div>
      ) : (
        <button
          type="button"
          className={styles.link}
          onClick={() => setOpen(true)}
        >
          <FormattedMessage
            id="account.delete.otherWays"
            defaultMessage="Other ways to confirm"
          />
        </button>
      )}
    </div>
  );
}

function DeleteAccountDialog({
  email,
  actions,
  method,
  others,
  onChangeMethod,
  onCancel,
}: {
  readonly email: string;
  readonly actions: AccountActions;
  readonly method: DeleteMethod;
  readonly others: readonly DeleteMethod[];
  readonly onChangeMethod: (method: DeleteMethod) => void;
  readonly onCancel: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [code, setCode] = useState("");
  const [totp, setTotp] = useState("");
  const [password, setPassword] = useState("");
  const [keepStats, setKeepStats] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showSwitch, setShowSwitch] = useState(false);
  // Every factor this account holds except the one in use. "email" is always a
  // possibility to switch back to when the account has an address.
  const switchable = (
    email !== "" ? (["email", ...others] as DeleteMethod[]) : [...others]
  ).filter((m) => m !== method);
  // Resending is silent otherwise — the same screen, the same empty box, no
  // sign anything happened. Confirm it, and hold the link shut briefly so a
  // second impatient click doesn't invalidate the code that just arrived.
  const [sentAt, setSentAt] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  const sendCode = (initial: boolean) => {
    setErr(null);
    actions
      .sendDeleteAccountCode()
      .then(() => {
        if (!initial) {
          setSentAt(Date.now());
        }
        setCooldown(30);
      })
      .catch(() => {
        setErr(
          formatMessage({
            id: "account.delete.sendError",
            defaultMessage: "Couldn’t send the code. Try again in a moment.",
          }),
        );
      });
  };

  // A code is emailed only if that is the chosen method — an account holder who
  // picked their passkey on the previous step never triggers one.
  useEffect(() => {
    if (method === "email") {
      sendCode(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (cooldown === 0) {
      return;
    }
    const id = window.setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  // The "sent" confirmation is a moment's reassurance, not a permanent label.
  useEffect(() => {
    if (sentAt === 0) {
      return;
    }
    const id = window.setTimeout(() => setSentAt(0), 6000);
    return () => window.clearTimeout(id);
  }, [sentAt]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Enough to submit? A passkey needs nothing typed — the browser prompt is
  // the whole of it.
  const ready =
    (method === "email" && code.trim().length === 6) ||
    (method === "totp" && totp.trim().length > 0) ||
    (method === "password" && password.length > 0) ||
    method === "passkey";

  const confirm = () => {
    if (!ready || busy) {
      return;
    }
    setBusy(true);
    setErr(null);
    const proof =
      method === "passkey"
        ? actions.deleteAccountPasskeyProof()
        : Promise.resolve(
            method === "email"
              ? { code: code.trim() }
              : method === "totp"
                ? { totp: totp.trim() }
                : { password },
          );
    proof
      .then((p) => actions.deleteAccount(p, keepStats))
      .catch((e) => {
        setErr(
          e?.message ??
            formatMessage({
              id: "account.delete.confirmError",
              defaultMessage: "That confirmation is incorrect or has expired.",
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
          {method === "email" && (
            <FormattedMessage
              id="account.delete.codeMessage"
              defaultMessage="Enter the 6-digit code we emailed to {email} to permanently delete your account. There is no undo."
              values={{ email: <strong>{email}</strong> }}
            />
          )}
          {method === "totp" && (
            <FormattedMessage
              id="account.delete.totpMessage"
              defaultMessage="Enter the current code from your authenticator app to permanently delete your account. A recovery code works too. There is no undo."
            />
          )}
          {method === "password" && (
            <FormattedMessage
              id="account.delete.passwordMessage"
              defaultMessage="Enter your password to permanently delete your account. There is no undo."
            />
          )}
          {method === "passkey" && (
            <FormattedMessage
              id="account.delete.passkeyMessage"
              defaultMessage="Confirm with your passkey to permanently delete your account. There is no undo."
            />
          )}
        </p>
        {method === "email" && (
          <>
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
            <div className={styles.resendRow}>
              <button
                type="button"
                className={styles.link}
                disabled={cooldown > 0}
                onClick={() => sendCode(false)}
              >
                {cooldown > 0 ? (
                  <FormattedMessage
                    id="account.delete.resendIn"
                    defaultMessage="Resend the code in {seconds}s"
                    values={{ seconds: cooldown }}
                  />
                ) : (
                  <FormattedMessage
                    id="account.delete.resend"
                    defaultMessage="Resend the code"
                  />
                )}
              </button>
              {sentAt > 0 && (
                <span className={styles.sentNote} role="status">
                  <CheckIcon />
                  <FormattedMessage
                    id="account.delete.resent"
                    defaultMessage="New code sent"
                  />
                </span>
              )}
            </div>
          </>
        )}
        {method === "totp" && (
          <TextField
            size="full"
            type="text"
            autoComplete="one-time-code"
            autoFocus={true}
            maxLength={32}
            placeholder={formatMessage({
              id: "account.delete.totpPlaceholder",
              defaultMessage: "Authenticator or recovery code",
            })}
            value={totp}
            onChange={setTotp}
          />
        )}
        {method === "password" && (
          <TextField
            size="full"
            type="password"
            autoComplete="current-password"
            autoFocus={true}
            placeholder={formatMessage({
              id: "t_Password",
              defaultMessage: "Password",
            })}
            value={password}
            onChange={setPassword}
          />
        )}
        {/* Changing your mind here shouldn't mean starting over. */}
        {switchable.length > 0 &&
          (showSwitch ? (
            <div className={styles.methodList}>
              {switchable.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={styles.link}
                  onClick={() => {
                    setErr(null);
                    onChangeMethod(m);
                  }}
                >
                  <MethodSwitchLabel method={m} />
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              className={styles.link}
              onClick={() => setShowSwitch(true)}
            >
              <FormattedMessage
                id="account.delete.otherWays"
                defaultMessage="Other ways to confirm"
              />
            </button>
          ))}
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
            disabled={!ready || busy}
            onClick={confirm}
          >
            {method === "passkey" ? (
              <FormattedMessage
                id="account.delete.finalPasskey"
                defaultMessage="Confirm and delete forever"
              />
            ) : (
              <FormattedMessage
                id="account.delete.final"
                defaultMessage="Delete forever"
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// A Twitter/X-style verified seal: a scalloped badge with a checkmark, shown
// inline right after the account holder's name.
function VerifiedBadge(): ReactNode {
  const { formatMessage } = useIntl();
  return (
    <svg
      className={styles.verifiedBadge}
      viewBox="0 0 24 24"
      role="img"
      aria-label={formatMessage({
        id: "account.verified",
        defaultMessage: "Verified",
      })}
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

function PaletteIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={styles.railIcon}>
      <path
        d="M12 3a9 9 0 1 0 0 18c1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.1 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.3-9-7.3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="9.5" cy="8" r="1.2" fill="currentColor" />
      <circle cx="14" cy="7" r="1.2" fill="currentColor" />
      <circle cx="17.5" cy="10" r="1.2" fill="currentColor" />
    </svg>
  );
}

/** A mortarboard, in the same hairline stroke as the rest of the rail. */
function CourseIcon() {
  return (
    <svg className={styles.railIcon} viewBox="0 0 24 24">
      <path d="M12 4 22 9l-10 5L2 9z" />
      <path d="M6 11.5V16c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4.5" />
      <path d="M22 9v5" />
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

/**
 * Change the handle the app shows publicly.
 *
 * Inline rather than a window: it is one short field, and a dialog for a
 * rename is more ceremony than the decision deserves. Empty is refused
 * silently by not offering the save — an account with no name has nowhere
 * sensible to fall back to, and an error message for a field somebody has
 * simply not finished typing is noise.
 */
function NameEditor({
  name,
  verified,
  onRename,
}: {
  readonly name: string;
  readonly verified: boolean;
  readonly onRename: (name: string) => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const tidy = draft.trim();
  const changed = tidy !== "" && tidy !== name;

  if (!editing) {
    return (
      <span className={styles.displayName}>
        {name}
        {/* SSO accounts are verified by the provider, so treat a connected
            sign-in method as verified too. */}
        {verified && <VerifiedBadge />}
        <button
          type="button"
          className={styles.renameIcon}
          title={formatMessage({
            id: "account.rename.action",
            defaultMessage: "Change display name",
          })}
          aria-label={formatMessage({
            id: "account.rename.action",
            defaultMessage: "Change display name",
          })}
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden={true}>
            <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
            <path d="M14.5 7.5 16.5 9.5" />
          </svg>
        </button>
      </span>
    );
  }

  return (
    <span className={styles.renameRow}>
      <input
        className={styles.renameField}
        type="text"
        autoFocus={true}
        maxLength={PROFILE_NAME_MAX}
        value={draft}
        onChange={(ev) => setDraft(ev.target.value)}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" && changed) {
            onRename(tidy);
            setEditing(false);
          }
          if (ev.key === "Escape") {
            setEditing(false);
          }
        }}
      />
      <button
        type="button"
        className={styles.subtleBtn}
        disabled={!changed}
        onClick={() => {
          onRename(tidy);
          setEditing(false);
        }}
      >
        <FormattedMessage id="account.rename.save" defaultMessage="Save" />
      </button>
      <button
        type="button"
        className={styles.subtleBtn}
        onClick={() => setEditing(false)}
      >
        <FormattedMessage id="account.rename.cancel" defaultMessage="Cancel" />
      </button>
    </span>
  );
}
