import { Pages } from "@keylearn/pages-shared";
import { ConfirmDialog } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link as RouterLink, useParams } from "react-router";
import * as styles from "./AccountDetailPage.module.less";
import * as common from "./common.module.less";
import { DeskShell } from "./DeskShell.tsx";
import { type AccountDetails, SupportService } from "./service.ts";

const COUNTRY_NAMES: Record<string, string> = {
  IN: "India",
  US: "United States",
  GB: "United Kingdom",
  AU: "Australia",
  CA: "Canada",
  NZ: "New Zealand",
  IE: "Ireland",
  SG: "Singapore",
  ZA: "South Africa",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  BR: "Brazil",
  MX: "Mexico",
  NG: "Nigeria",
  PK: "Pakistan",
  PH: "Philippines",
  AE: "United Arab Emirates",
};

function countryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code;
}

function initials(name: string): string {
  const trimmed = name.trim();
  return trimmed === "" ? "?" : trimmed.charAt(0).toUpperCase();
}

export function AccountDetailPage(): ReactNode {
  return (
    <DeskShell active="accounts">
      <AccountDetail />
    </DeskShell>
  );
}

function AccountDetail(): ReactNode {
  const { formatMessage } = useIntl();
  const { id } = useParams<{ id: string }>();
  const accountId = Number(id);
  const [account, setAccount] = useState<AccountDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revealedEmail, setRevealedEmail] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [reason, setReason] = useState("");
  const [requireReason, setRequireReason] = useState(false);
  const [deletionReason, setDeletionReason] = useState("");
  const [deletionBusy, setDeletionBusy] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);

  useEffect(() => {
    SupportService.getSettings()
      .then((s) => setRequireReason(s.requireRevealReason))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!Number.isFinite(accountId)) {
      setError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setRevealedEmail(null);
    setReason("");
    SupportService.getAccount(accountId)
      .then((a) => {
        setAccount(a);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [accountId]);

  if (loading) {
    return (
      <p className={common.note}>
        <FormattedMessage id="staffDesk.loading" defaultMessage="Loading…" />
      </p>
    );
  }
  if (error || account == null) {
    return (
      <p className={common.note}>
        <FormattedMessage
          id="deskAccounts.notFound"
          defaultMessage="That account couldn't be found."
        />
      </p>
    );
  }

  const reveal = () => {
    setRevealing(true);
    SupportService.revealAccountEmail(account.id, reason.trim() || undefined)
      .then(setRevealedEmail)
      .catch(() => {})
      .finally(() => setRevealing(false));
  };

  const requestDeletion = () => {
    if (deletionReason.trim() === "") {
      return;
    }
    setDeletionBusy(true);
    setDeletionError(null);
    SupportService.requestAccountDeletion(account.id, deletionReason.trim())
      .then((deletionRequest) => {
        setAccount({ ...account, deletionRequest });
        setDeletionReason("");
      })
      .catch((err) =>
        setDeletionError(
          err instanceof Error
            ? err.message
            : "Couldn't schedule the deletion.",
        ),
      )
      .finally(() => setDeletionBusy(false));
  };

  const cancelDeletion = (cancelReason: string) => {
    setDeletionBusy(true);
    setDeletionError(null);
    SupportService.cancelAccountDeletion(account.id, cancelReason)
      .then((deletionRequest) => setAccount({ ...account, deletionRequest }))
      .catch((err) =>
        setDeletionError(
          err instanceof Error ? err.message : "Couldn't cancel the deletion.",
        ),
      )
      .finally(() => setDeletionBusy(false));
  };

  return (
    <>
      <RouterLink to={Pages.deskAccounts.path} className={styles.backLink}>
        <svg viewBox="0 0 24 24" aria-hidden={true}>
          <path d="M15 5 8 12l7 7" />
        </svg>
        <FormattedMessage
          id="deskAccounts.backToSearch"
          defaultMessage="Back to search"
        />
      </RouterLink>

      <div className={styles.head}>
        <span className={styles.who}>{initials(account.name)}</span>
        <div>
          <h1 className={styles.name}>{account.name}</h1>
          <p className={styles.sub}>
            <FormattedMessage
              id="deskAccounts.detail.sub"
              defaultMessage="Account #{id} · {verified}"
              values={{
                id: account.id,
                verified: account.emailVerified ? (
                  <FormattedMessage
                    id="deskAccounts.verified"
                    defaultMessage="verified"
                  />
                ) : (
                  <FormattedMessage
                    id="deskAccounts.unverified"
                    defaultMessage="unverified"
                  />
                ),
              }}
            />
          </p>
        </div>
      </div>

      <div className={common.split}>
        <div>
          <div className={common.card} style={{ marginBlockStart: 0 }}>
            <p className={common.micro}>
              <FormattedMessage
                id="deskAccounts.facts.title"
                defaultMessage="Account facts"
              />
            </p>
            <div className={common.facts}>
              <div className={common.fact}>
                <span className={common.factK}>
                  <FormattedMessage
                    id="deskThread.who.email"
                    defaultMessage="Email"
                  />
                </span>
                <span className={clsx(common.factV, common.factVMono)}>
                  {revealedEmail ?? account.email}
                </span>
              </div>
              <div className={common.fact}>
                <span className={common.factK}>
                  <FormattedMessage
                    id="deskAccounts.facts.registered"
                    defaultMessage="Registered"
                  />
                </span>
                <span className={common.factV}>
                  {new Date(account.createdAt).toLocaleString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className={common.fact}>
                <span className={common.factK}>
                  <FormattedMessage
                    id="deskThread.who.signIn"
                    defaultMessage="Sign-in"
                  />
                </span>
                <span className={common.factV}>{account.signInMethod}</span>
              </div>
              {account.signupCountry != null && (
                <div className={common.fact}>
                  <span className={common.factK}>
                    <FormattedMessage
                      id="deskAccounts.facts.signupFrom"
                      defaultMessage="Signed up from"
                    />
                  </span>
                  <span className={common.factV}>
                    {countryName(account.signupCountry)}
                  </span>
                </div>
              )}
              <div className={common.fact}>
                <span className={common.factK}>
                  <FormattedMessage
                    id="deskAccounts.facts.lastLogin"
                    defaultMessage="Last login"
                  />
                </span>
                <span className={common.factV}>
                  {account.lastLogin == null ? (
                    <FormattedMessage
                      id="deskAccounts.facts.noRecentLogin"
                      defaultMessage="No login in the last 30 days"
                    />
                  ) : (
                    new Date(account.lastLogin.at).toLocaleString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  )}
                </span>
              </div>
              {account.lastLogin != null &&
                (account.lastLogin.ip != null ||
                  account.lastLogin.userAgent != null) && (
                  <div className={common.fact}>
                    <span className={common.factK}>
                      <FormattedMessage
                        id="deskAccounts.facts.lastLoginFrom"
                        defaultMessage="Last login from"
                      />
                    </span>
                    <span className={clsx(common.factV, common.factVMono)}>
                      {[account.lastLogin.ip, account.lastLogin.userAgent]
                        .filter((v) => v != null)
                        .join(" · ")}
                    </span>
                  </div>
                )}
              {account.locale != null && (
                <div className={common.fact}>
                  <span className={common.factK}>
                    <FormattedMessage
                      id="deskAccounts.facts.language"
                      defaultMessage="Site language"
                    />
                  </span>
                  <span className={common.factV}>{account.locale}</span>
                </div>
              )}
              <div className={common.fact}>
                <span className={common.factK}>
                  <FormattedMessage
                    id="deskThread.who.profiles"
                    defaultMessage="Profiles"
                  />
                </span>
                <span className={common.factV}>{account.profileCount}</span>
              </div>
            </div>
            {revealedEmail == null && (
              <>
                {requireReason && (
                  <input
                    type="text"
                    className={common.field}
                    style={{ marginBlockStart: "0.7rem" }}
                    maxLength={200}
                    placeholder={formatMessage({
                      id: "deskAccounts.reveal.reasonPlaceholder",
                      defaultMessage: "Why do you need this address?",
                    })}
                    value={reason}
                    onChange={(ev) => setReason(ev.target.value)}
                  />
                )}
                <div className={common.btnRow}>
                  <button
                    type="button"
                    className={clsx(common.btn, common.ghost, common.small)}
                    disabled={
                      revealing || (requireReason && reason.trim() === "")
                    }
                    onClick={reveal}
                  >
                    <FormattedMessage
                      id="staffDesk.revealEmail"
                      defaultMessage="Reveal full email"
                    />
                  </button>
                </div>
              </>
            )}
            <p className={common.noteSmall}>
              <FormattedMessage
                id="deskThread.who.revealNote"
                defaultMessage="Revealing it is written to the audit log with your name against it."
              />
            </p>
          </div>
        </div>

        <div>
          <div className={common.card} style={{ marginBlockStart: 0 }}>
            <p className={common.micro}>
              <FormattedMessage
                id="deskAccounts.history.title"
                defaultMessage="Support history"
              />
            </p>
            {account.tickets.length === 0 ? (
              <p className={common.note}>
                <FormattedMessage
                  id="deskAccounts.history.empty"
                  defaultMessage="No tickets from this account."
                />
              </p>
            ) : (
              <div className={styles.ticketList}>
                {account.tickets.map((t) => (
                  <RouterLink
                    key={t.id}
                    to={`${Pages.deskThread.path}/${t.id}`}
                    className={styles.ticketRow}
                  >
                    <span className={clsx(styles.ticketSubj, common.truncate)}>
                      {t.subject}
                    </span>
                    <span className={styles.ticketWhen}>
                      {t.status} ·{" "}
                      {new Date(t.createdAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </RouterLink>
                ))}
              </div>
            )}
            <p className={common.noteSmall}>
              <FormattedMessage
                id="deskAccounts.history.note"
                defaultMessage="Ticket subjects and status only — opening one goes to the real thread, same as the Inbox."
              />
            </p>
          </div>
        </div>
      </div>

      <DeletionPanel
        account={account}
        reason={deletionReason}
        onReasonChange={setDeletionReason}
        busy={deletionBusy}
        error={deletionError}
        onRequest={requestDeletion}
        onCancel={cancelDeletion}
      />
    </>
  );
}

function DeletionPanel({
  account,
  reason,
  onReasonChange,
  busy,
  error,
  onRequest,
  onCancel,
}: {
  readonly account: AccountDetails;
  readonly reason: string;
  readonly onReasonChange: (value: string) => void;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onRequest: () => void;
  readonly onCancel: (cancelReason: string) => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [expanded, setExpanded] = useState(false);
  const [confirmingRequest, setConfirmingRequest] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonError, setCancelReasonError] = useState(false);
  const pending =
    account.deletionRequest != null &&
    account.deletionRequest.cancelledAt == null &&
    account.deletionRequest.completedAt == null;

  if (pending) {
    const request = account.deletionRequest!;
    return (
      <div className={clsx(common.card, common.cardDanger)}>
        <p className={clsx(common.micro, common.microDanger)}>
          <FormattedMessage
            id="deskAccounts.deletion.pendingTitle"
            defaultMessage="Deletion scheduled"
          />
        </p>
        <p className={common.note}>
          <FormattedMessage
            id="deskAccounts.deletion.pendingBody"
            defaultMessage="Set to delete on {date}. The account holder was emailed and can cancel it themselves; reason on file: {reason}"
            values={{
              date: new Date(request.executeAt).toLocaleString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
              reason: <i>{request.reason}</i>,
            }}
          />
        </p>
        {error != null && <p className={common.microDanger}>{error}</p>}
        <div className={common.btnRow}>
          <button
            type="button"
            className={clsx(common.btn, common.ghost, common.small)}
            disabled={busy}
            onClick={() => {
              setCancelReason("");
              setCancelReasonError(false);
              setConfirmingCancel(true);
            }}
          >
            <FormattedMessage
              id="deskAccounts.deletion.cancel"
              defaultMessage="Cancel deletion"
            />
          </button>
        </div>
        {confirmingCancel && (
          <ConfirmDialog
            title={formatMessage({
              id: "deskAccounts.deletion.cancelConfirmTitle",
              defaultMessage: "Cancel this deletion?",
            })}
            message={formatMessage({
              id: "deskAccounts.deletion.cancelConfirmMessage",
              defaultMessage:
                "The account stays as it is. A reason is required and goes to the audit log.",
            })}
            confirmLabel={formatMessage({
              id: "deskAccounts.deletion.cancel",
              defaultMessage: "Cancel deletion",
            })}
            extra={
              <>
                <input
                  type="text"
                  className={common.field}
                  autoFocus={true}
                  maxLength={500}
                  placeholder={formatMessage({
                    id: "deskAccounts.deletion.cancelReasonPlaceholder",
                    defaultMessage: "Why is this deletion being cancelled?",
                  })}
                  value={cancelReason}
                  onChange={(ev) => {
                    setCancelReason(ev.target.value);
                    setCancelReasonError(false);
                  }}
                />
                {cancelReasonError && (
                  <p className={common.microDanger}>
                    <FormattedMessage
                      id="deskAccounts.deletion.cancelReasonRequired"
                      defaultMessage="A reason is required."
                    />
                  </p>
                )}
              </>
            }
            onConfirm={() => {
              if (cancelReason.trim() === "") {
                setCancelReasonError(true);
                return;
              }
              setConfirmingCancel(false);
              onCancel(cancelReason.trim());
            }}
            onCancel={() => setConfirmingCancel(false)}
          />
        )}
      </div>
    );
  }

  if (!expanded) {
    return (
      <div className={clsx(common.card, common.cardDanger)}>
        <p className={clsx(common.micro, common.microDanger)}>
          <FormattedMessage
            id="deskAccounts.deletion.title"
            defaultMessage="Delete account"
          />
        </p>
        <div className={common.btnRow}>
          <button
            type="button"
            className={clsx(common.btn, common.danger, common.small)}
            onClick={() => setExpanded(true)}
          >
            <FormattedMessage
              id="deskAccounts.deletion.title"
              defaultMessage="Delete account"
            />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(common.card, common.cardDanger)}>
      <p className={clsx(common.micro, common.microDanger)}>
        <FormattedMessage
          id="deskAccounts.deletion.title"
          defaultMessage="Delete account"
        />
      </p>
      <p className={common.note}>
        <FormattedMessage
          id="deskAccounts.deletion.body"
          defaultMessage="Emails the account holder and, unless they cancel, permanently erases the account 48 hours from now. A reason is required and goes to the audit log."
        />
      </p>
      <input
        type="text"
        className={common.field}
        style={{ marginBlockStart: "0.7rem" }}
        maxLength={500}
        placeholder={formatMessage({
          id: "deskAccounts.deletion.reasonPlaceholder",
          defaultMessage: "Why is this account being deleted?",
        })}
        value={reason}
        onChange={(ev) => onReasonChange(ev.target.value)}
      />
      {error != null && <p className={common.microDanger}>{error}</p>}
      <div className={common.btnRow}>
        <button
          type="button"
          className={clsx(common.btn, common.ghost, common.small)}
          disabled={busy}
          onClick={() => setExpanded(false)}
        >
          <FormattedMessage id="t_Cancel" defaultMessage="Cancel" />
        </button>
        <button
          type="button"
          className={clsx(common.btn, common.danger, common.small)}
          disabled={busy || reason.trim() === ""}
          onClick={() => setConfirmingRequest(true)}
        >
          <FormattedMessage
            id="deskAccounts.deletion.request"
            defaultMessage="Request deletion"
          />
        </button>
      </div>
      {confirmingRequest && (
        <ConfirmDialog
          title={formatMessage({
            id: "deskAccounts.deletion.requestConfirmTitle",
            defaultMessage: "Delete this account?",
          })}
          message={formatMessage(
            {
              id: "deskAccounts.deletion.requestConfirmMessage",
              defaultMessage:
                "{name} will be emailed now and, unless they cancel it themselves, the account is permanently erased in 48 hours. Reason on file: “{reason}”",
            },
            { name: account.name, reason: reason.trim() },
          )}
          confirmLabel={formatMessage({
            id: "deskAccounts.deletion.request",
            defaultMessage: "Request deletion",
          })}
          danger={true}
          onConfirm={() => {
            setConfirmingRequest(false);
            onRequest();
          }}
          onCancel={() => setConfirmingRequest(false)}
        />
      )}
    </div>
  );
}
