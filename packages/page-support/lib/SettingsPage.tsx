import {
  type SavedReplyDetails,
  type StaffRosterEntry,
  type StaffSettingsDetails,
} from "@keylearn/pages-shared";
import { Button, confirmStyles as dlg, TextField } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as common from "./common.module.less";
import { DeskShell } from "./DeskShell.tsx";
import { relativeTime } from "./relativeTime.ts";
import { SupportService } from "./service.ts";
import * as styles from "./SettingsPage.module.less";

const CONFIDENCE_STEPS = [70, 85, 95] as const;
const OVERDUE_STEPS = [24, 48, 72] as const;

export function SettingsPage(): ReactNode {
  return (
    <DeskShell active="settings">
      <Settings />
    </DeskShell>
  );
}

function Settings(): ReactNode {
  const { formatMessage } = useIntl();
  const [settings, setSettings] = useState<StaffSettingsDetails | null>(null);
  const [signature, setSignature] = useState("");

  useEffect(() => {
    SupportService.getSettings().then((s) => {
      setSettings(s);
      setSignature(s.signature ?? "");
    });
  }, []);

  const patch = (input: Partial<StaffSettingsDetails>) => {
    SupportService.updateSettings(input).then(setSettings);
  };

  if (settings == null) {
    return (
      <p className={common.note}>
        <FormattedMessage id="staffDesk.loading" defaultMessage="Loading…" />
      </p>
    );
  }

  return (
    <>
      <AutomationStatus />
      <div className={common.split}>
        <div>
          <div className={common.card} style={{ marginBlockStart: 0 }}>
            <p className={common.micro}>
              <FormattedMessage
                id="deskSettings.yours.title"
                defaultMessage="Yours — nobody else sees these"
              />
            </p>

            <span className={common.lbl}>
              <FormattedMessage
                id="deskSettings.signature"
                defaultMessage="Sign replies as"
              />
            </span>
            <TextField
              type="text"
              size="full"
              maxLength={500}
              placeholder={formatMessage({
                id: "deskSettings.signaturePlaceholder",
                defaultMessage: "KeyLearn",
              })}
              value={signature}
              onChange={setSignature}
              onBlur={() =>
                patch({
                  signature: signature.trim() === "" ? null : signature.trim(),
                })
              }
            />
            <p className={common.noteSmall}>
              <FormattedMessage
                id="deskSettings.signatureNote"
                defaultMessage="Your own name reads warmer and is fine. It's a name on an email, not an identity claim."
              />
            </p>

            <div className={styles.switchRow}>
              <Switch
                on={settings.notifyNew}
                onToggle={() => patch({ notifyNew: !settings.notifyNew })}
              />
              <span>
                <FormattedMessage
                  id="deskSettings.notify"
                  defaultMessage="Email me when something arrives"
                />
              </span>
            </div>
            <div className={styles.switchRow}>
              <Switch
                on={settings.quietFrom != null && settings.quietTo != null}
                onToggle={() =>
                  patch(
                    settings.quietFrom != null
                      ? { quietFrom: null, quietTo: null }
                      : { quietFrom: "21:00", quietTo: "07:00" },
                  )
                }
              />
              <span>
                <FormattedMessage
                  id="deskSettings.quietHours"
                  defaultMessage="Not between {from} and {to}"
                  values={{
                    from: settings.quietFrom ?? "21:00",
                    to: settings.quietTo ?? "07:00",
                  }}
                />
              </span>
            </div>
            {settings.quietFrom != null && (
              <div
                className={styles.dateGrid}
                style={{ marginBlockStart: "0.5rem" }}
              >
                <input
                  type="time"
                  className={styles.timeField}
                  value={settings.quietFrom}
                  onChange={(ev) => patch({ quietFrom: ev.target.value })}
                />
                <input
                  type="time"
                  className={styles.timeField}
                  value={settings.quietTo ?? "07:00"}
                  onChange={(ev) => patch({ quietTo: ev.target.value })}
                />
              </div>
            )}

            <span className={common.lbl}>
              <FormattedMessage
                id="deskSettings.awayUntil"
                defaultMessage="Away until"
              />
            </span>
            <input
              type="date"
              className={styles.dateField}
              value={settings.awayUntil ?? ""}
              onChange={(ev) =>
                patch({
                  awayUntil: ev.target.value === "" ? null : ev.target.value,
                })
              }
            />
            <p className={common.noteSmall}>
              <FormattedMessage
                id="deskSettings.awayNote"
                defaultMessage="Sets an away line on every new ticket and clears itself on the date. Nothing to remember to switch off."
              />
            </p>
          </div>

          <div className={common.card}>
            <p className={common.micro}>
              <FormattedMessage
                id="deskSettings.behaviour.title"
                defaultMessage="How the desk behaves"
              />
            </p>

            <span className={common.lbl}>
              <FormattedMessage
                id="deskSettings.confidence"
                defaultMessage="Confident means at least"
              />
            </span>
            <div className={common.tabs}>
              {CONFIDENCE_STEPS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={clsx(
                    common.tab,
                    settings.confidenceThreshold === n && common.tabOn,
                  )}
                  onClick={() => patch({ confidenceThreshold: n })}
                >
                  {n}%
                </button>
              ))}
            </div>

            <span className={common.lbl}>
              <FormattedMessage
                id="deskSettings.overdue"
                defaultMessage="Flag a ticket as overdue after"
              />
            </span>
            <div className={common.tabs}>
              {OVERDUE_STEPS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={clsx(
                    common.tab,
                    settings.overdueHours === n && common.tabOn,
                  )}
                  onClick={() => patch({ overdueHours: n })}
                >
                  {n}h
                </button>
              ))}
            </div>
            <p className={common.noteSmall}>
              <FormattedMessage
                id="deskSettings.behaviourNote"
                defaultMessage="Changing either is written to the audit log. They're safe settings, but they change what users receive, so they leave a trace."
              />
            </p>
          </div>

          <SavedRepliesManager />
        </div>

        <div>
          <StaffRoster />
          <AccountsSettings settings={settings} patch={patch} />
        </div>
      </div>
    </>
  );
}

function AccountsSettings({
  settings,
  patch,
}: {
  readonly settings: StaffSettingsDetails;
  readonly patch: (input: Partial<StaffSettingsDetails>) => void;
}): ReactNode {
  return (
    <div className={common.card}>
      <p className={common.micro}>
        <FormattedMessage
          id="deskSettings.accounts.title"
          defaultMessage="Accounts lookup"
        />
      </p>
      <div className={styles.switchRow}>
        <Switch
          on={settings.requireRevealReason}
          onToggle={() =>
            patch({ requireRevealReason: !settings.requireRevealReason })
          }
        />
        <span>
          <FormattedMessage
            id="deskSettings.accounts.requireReason"
            defaultMessage="Require a reason to reveal an email"
          />
        </span>
      </div>
      <p className={common.noteSmall}>
        <FormattedMessage
          id="deskSettings.accounts.requireReasonNote"
          defaultMessage="A short free-text reason, shown next to the reveal in the audit log — the same log, not a new one."
        />
      </p>
      <div className={styles.switchRow}>
        <Switch
          on={settings.showLastLoginLocation}
          onToggle={() =>
            patch({ showLastLoginLocation: !settings.showLastLoginLocation })
          }
        />
        <span>
          <FormattedMessage
            id="deskSettings.accounts.showLocation"
            defaultMessage="Show last-login location"
          />
        </span>
      </div>
      <p className={common.noteSmall}>
        <FormattedMessage
          id="deskSettings.accounts.showLocationNote"
          defaultMessage="City-level, from the IP on their most recent sign-in. Off hides the “from” line on every account, not per-account."
        />
      </p>
      <p className={common.noteSmall}>
        <FormattedMessage
          id="deskSettings.accounts.alwaysLogged"
          defaultMessage="Opening an account and revealing an email are always written to the audit log — that part isn't a setting."
        />
      </p>
    </div>
  );
}

function AutomationStatus(): ReactNode {
  const [status, setStatus] = useState<{
    readonly pausedSince: string | null;
    readonly pausedModel: string | null;
    readonly enabled: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    SupportService.getQuotaStatus().then(setStatus);
  }, []);

  if (status == null) {
    return null;
  }

  const toggle = () => {
    if (busy) {
      return;
    }
    setBusy(true);
    SupportService.setAutomationEnabled(!status.enabled)
      .then(({ enabled }) => setStatus({ ...status, enabled }))
      .finally(() => setBusy(false));
  };

  return (
    <>
      <div className={clsx(common.card, common.cardDanger)}>
        <p className={clsx(common.micro, common.microDanger)}>
          <FormattedMessage
            id="deskSettings.automation.title"
            defaultMessage="Automation — off switches everything below"
          />
        </p>
        <div className={styles.switchRow}>
          <Switch on={status.enabled} onToggle={toggle} />
          <span>
            <span className={common.lbl} style={{ display: "block" }}>
              <FormattedMessage
                id="deskSettings.automation.agentActive"
                defaultMessage="Agent is active"
              />
            </span>
            <span className={common.noteSmall}>
              <FormattedMessage
                id="deskSettings.automation.agentActiveNote"
                defaultMessage="Off routes every ticket to the human queue immediately — nothing in flight is lost, it just stops picking up new ones."
              />
            </span>
          </span>
        </div>
      </div>
      {status.pausedSince != null && (
        <div className={clsx(common.card, common.cardDanger)}>
          <p className={clsx(common.micro, common.microDanger)}>
            <FormattedMessage
              id="deskSettings.automation.pausedTitle"
              defaultMessage="Tab is paused — quota reached on {model}"
              values={{ model: status.pausedModel ?? "" }}
            />
          </p>
          <p className={common.note} style={{ marginBlockStart: 0 }}>
            <FormattedMessage
              id="deskSettings.automation.pausedBody"
              defaultMessage="Every new ticket since {when} has routed straight to your Inbox, untouched — same as the kill switch being off. Resets automatically."
              values={{ when: relativeTime(status.pausedSince) }}
            />
          </p>
        </div>
      )}
    </>
  );
}

function Switch({
  on,
  onToggle,
}: {
  readonly on: boolean;
  readonly onToggle: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      className={clsx(common.switch, on && common.switchOn)}
      aria-pressed={on}
      onClick={onToggle}
    >
      <span className={common.switchDot} />
    </button>
  );
}

function StaffRoster(): ReactNode {
  const { formatMessage } = useIntl();
  const [roster, setRoster] = useState<StaffRosterEntry[] | null>(null);

  useEffect(() => {
    SupportService.getStaffRoster().then(setRoster);
  }, []);

  const statusFor = (entry: StaffRosterEntry): string => {
    if (!entry.hasPasskey && !entry.hasAuthenticator) {
      return formatMessage({
        id: "deskSettings.roster.noFactor",
        defaultMessage: "No second factor yet",
      });
    }
    const factor = entry.hasPasskey
      ? formatMessage({
          id: "deskSettings.roster.passkey",
          defaultMessage: "Passkey",
        })
      : formatMessage({
          id: "deskSettings.roster.authenticator",
          defaultMessage: "Authenticator",
        });
    const when =
      entry.lastSignedInAt != null
        ? formatMessage(
            {
              id: "deskSettings.roster.signedIn",
              defaultMessage: "signed in {when}",
            },
            { when: relativeTime(entry.lastSignedInAt) },
          )
        : formatMessage({
            id: "deskSettings.roster.neverSignedIn",
            defaultMessage: "never signed in",
          });
    return `${factor} · ${when}`;
  };

  return (
    <div className={common.card} style={{ marginBlockStart: 0 }}>
      <p className={common.micro}>
        <FormattedMessage
          id="deskSettings.roster.title"
          defaultMessage="Staff — shown but not editable"
        />
      </p>
      {roster == null && (
        <p className={common.note}>
          <FormattedMessage id="staffDesk.loading" defaultMessage="Loading…" />
        </p>
      )}
      <div className={common.facts}>
        {roster?.map((entry) => (
          <div className={common.fact} key={entry.email}>
            <span className={common.factK}>{entry.name ?? entry.email}</span>
            <span className={common.factV}>{statusFor(entry)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SavedRepliesManager(): ReactNode {
  const { formatMessage } = useIntl();
  const [replies, setReplies] = useState<SavedReplyDetails[] | null>(null);
  const [editing, setEditing] = useState<SavedReplyDetails | "new" | null>(
    null,
  );

  const load = () => {
    SupportService.listSavedReplies().then(setReplies);
  };
  useEffect(load, []);

  return (
    <div className={common.card}>
      <p className={common.micro}>
        <FormattedMessage
          id="deskSettings.replies.title"
          defaultMessage="Saved replies — shared with every staff member"
        />
      </p>
      <div className={styles.replies}>
        {replies == null && (
          <p className={common.note}>
            <FormattedMessage
              id="staffDesk.loading"
              defaultMessage="Loading…"
            />
          </p>
        )}
        {replies != null && replies.length === 0 && (
          <p className={common.note}>
            <FormattedMessage
              id="staffDesk.empty"
              defaultMessage="Nothing here."
            />
          </p>
        )}
        {replies?.map((r) => (
          <button
            type="button"
            className={styles.reply}
            key={r.id}
            onClick={() => setEditing(r)}
          >
            <span style={{ minInlineSize: 0 }}>
              <span className={styles.replyTitle}>{r.title}</span>
              <span className={styles.replySub}>{r.body}</span>
            </span>
            <span className={styles.replyUsed}>
              <FormattedMessage
                id="deskThread.savedReplies.used"
                defaultMessage="used {n} times"
                values={{ n: r.usedCount }}
              />
            </span>
          </button>
        ))}
      </div>
      <div className={common.btnRow}>
        <button
          type="button"
          className={clsx(common.btn, common.ghost, common.small)}
          onClick={() => setEditing("new")}
        >
          <FormattedMessage
            id="deskSettings.replies.new"
            defaultMessage="New saved reply"
          />
        </button>
      </div>
      <p className={common.noteSmall}>
        <FormattedMessage
          id="deskSettings.replies.note"
          defaultMessage="A starting point, not a canned answer — inserted into the reply box as text you can still edit before it sends. Shared rather than personal, for the same reason as the answers library."
        />
      </p>

      {editing != null && (
        <SavedReplyDialog
          reply={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            load();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function SavedReplyDialog({
  reply,
  onClose,
  onSaved,
}: {
  readonly reply: SavedReplyDetails | null;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [title, setTitle] = useState(reply?.title ?? "");
  const [body, setBody] = useState(reply?.body ?? "");
  const [busy, setBusy] = useState(false);
  const ready = title.trim() !== "" && body.trim() !== "";

  return (
    <div
      className={dlg.scrim}
      role="presentation"
      onClick={(ev) => ev.target === ev.currentTarget && onClose()}
    >
      <div className={dlg.dialog} role="dialog" aria-modal={true}>
        <h2 className={dlg.title}>
          {reply == null ? (
            <FormattedMessage
              id="deskSettings.replies.new"
              defaultMessage="New saved reply"
            />
          ) : (
            <FormattedMessage
              id="deskSettings.replies.edit"
              defaultMessage="Edit saved reply"
            />
          )}
        </h2>
        <TextField
          size="full"
          type="text"
          maxLength={128}
          placeholder={formatMessage({
            id: "deskAnswers.form.title",
            defaultMessage: "Title",
          })}
          value={title}
          onChange={setTitle}
        />
        <TextField
          size="full"
          type="textarea"
          rows={5}
          maxLength={4000}
          placeholder={formatMessage({
            id: "deskAnswers.form.body",
            defaultMessage: "Body",
          })}
          value={body}
          onChange={setBody}
        />
        <div className={dlg.actions}>
          <button
            className={clsx(dlg.btn, dlg.cancel)}
            onClick={onClose}
            type="button"
          >
            <FormattedMessage id="t_Cancel" defaultMessage="Cancel" />
          </button>
          <Button
            label={formatMessage({
              id: "deskAnswers.form.save",
              defaultMessage: "Save",
            })}
            disabled={!ready || busy}
            onClick={() => {
              setBusy(true);
              const input = { title: title.trim(), body: body.trim() };
              const req =
                reply == null
                  ? SupportService.createSavedReply(input)
                  : SupportService.updateSavedReply(reply.id, input);
              req.then(onSaved).finally(() => setBusy(false));
            }}
          />
        </div>
      </div>
    </div>
  );
}
