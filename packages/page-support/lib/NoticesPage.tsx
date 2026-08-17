import {
  type NoticeDetails,
  type NoticeDisplay,
  type NoticeKind,
  SiteNotice,
} from "@keylearn/pages-shared";
import { Button, ConfirmDialog, TextField } from "@keylearn/widget";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as common from "./common.module.less";
import { DeskShell } from "./DeskShell.tsx";
import * as styles from "./NoticesPage.module.less";
import { SupportService } from "./service.ts";

const KINDS: readonly NoticeKind[] = ["incident", "maintenance", "feature"];

function kindLabel(kind: NoticeKind): ReactNode {
  switch (kind) {
    case "incident":
      return (
        <FormattedMessage
          id="deskNotices.kind.incident"
          defaultMessage="Incident"
        />
      );
    case "maintenance":
      return (
        <FormattedMessage
          id="deskNotices.kind.maintenance"
          defaultMessage="Maintenance"
        />
      );
    case "feature":
      return (
        <FormattedMessage
          id="deskNotices.kind.feature"
          defaultMessage="Feature"
        />
      );
  }
}

function itemKindClass(
  kind: NoticeKind,
): "itemIncident" | "itemMaintenance" | null {
  switch (kind) {
    case "incident":
      return "itemIncident";
    case "maintenance":
      return "itemMaintenance";
    case "feature":
      return null;
  }
}

function stampKindClass(
  kind: NoticeKind,
): "stampError" | "stampWarn" | "stampFeature" | null {
  switch (kind) {
    case "incident":
      return "stampError";
    case "maintenance":
      return "stampWarn";
    case "feature":
      return "stampFeature";
  }
}

/** The current moment, formatted for a `datetime-local` input's value (local time, no timezone/seconds). */
function nowLocalInputValue(): string {
  return toLocalInputValue(new Date().toISOString());
}

/** An ISO timestamp, formatted for a `datetime-local` input's value — null becomes "". */
function toLocalInputValue(iso: string | null): string {
  if (iso == null) {
    return "";
  }
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function windowLabel(n: NoticeDetails): string {
  const now = Date.now();
  const started = n.startsAt == null || new Date(n.startsAt).getTime() <= now;
  const ended = n.endsAt != null && new Date(n.endsAt).getTime() <= now;
  const from =
    n.startsAt == null ? "live now" : new Date(n.startsAt).toLocaleString();
  const until =
    n.endsAt == null ? "until cleared" : new Date(n.endsAt).toLocaleString();
  const state = ended ? "ended" : started ? from : `starts ${from}`;
  return `${state} → ${until} · ${n.audience}${n.dismissible ? " · dismissible" : ""}${n.display === "window" ? " · floating window" : ""}`;
}

// NoticeDetails has no `active` flag — see the service layer's own note.
// Live-now inference from the window is right for anything that simply
// expires on its own; an early manual retraction only diverges from it for
// the rest of that same session, which the local override map below covers.
function inferLive(n: NoticeDetails): boolean {
  const now = Date.now();
  const started = n.startsAt == null || new Date(n.startsAt).getTime() <= now;
  const notEnded = n.endsAt == null || new Date(n.endsAt).getTime() > now;
  return started && notEnded;
}

export function NoticesPage(): ReactNode {
  return (
    <DeskShell active="notices">
      <Notices />
    </DeskShell>
  );
}

function Notices(): ReactNode {
  const { formatMessage } = useIntl();
  const [notices, setNotices] = useState<NoticeDetails[] | null>(null);
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const [deleting, setDeleting] = useState<NoticeDetails | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [kind, setKind] = useState<NoticeKind>("feature");
  const [display, setDisplay] = useState<NoticeDisplay>("banner");
  const [message, setMessage] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [audience, setAudience] = useState("everyone");
  const [locale, setLocale] = useState("");
  const [dismissible, setDismissible] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => {
    SupportService.listAllNotices().then(setNotices);
  };
  useEffect(load, []);

  const isOn = (n: NoticeDetails) => overrides[n.id] ?? inferLive(n);

  const effectiveAudience =
    audience === "language" ? locale.trim() || "en" : audience;

  const resetForm = () => {
    setEditingId(null);
    setKind("feature");
    setDisplay("banner");
    setMessage("");
    setStartsAt("");
    setEndsAt("");
    setAudience("everyone");
    setLocale("");
    setDismissible(true);
  };

  const startEdit = (n: NoticeDetails) => {
    setEditingId(n.id);
    setKind(n.kind);
    setDisplay(n.display);
    setMessage(n.message);
    setStartsAt(toLocalInputValue(n.startsAt));
    setEndsAt(toLocalInputValue(n.endsAt));
    setAudience(
      ["everyone", "signed-in", "kids"].includes(n.audience)
        ? n.audience
        : "language",
    );
    setLocale(
      ["everyone", "signed-in", "kids"].includes(n.audience) ? "" : n.audience,
    );
    setDismissible(n.dismissible);
  };

  const save = () => {
    if (message.trim() === "" || busy) {
      return;
    }
    setBusy(true);
    const fields = {
      message: message.trim(),
      kind,
      display,
      startsAt: startsAt === "" ? null : new Date(startsAt).toISOString(),
      endsAt: endsAt === "" ? null : new Date(endsAt).toISOString(),
      audience: effectiveAudience,
      dismissible,
    };
    const request =
      editingId != null
        ? SupportService.updateNotice(editingId, fields)
        : SupportService.createNotice(fields);
    request
      .then((saved) => {
        setNotices((prev) => {
          if (prev == null) {
            return [saved];
          }
          return prev.some((n) => n.id === saved.id)
            ? prev.map((n) => (n.id === saved.id ? saved : n))
            : [saved, ...prev];
        });
        setOverrides((prev) => ({ ...prev, [saved.id]: true }));
        resetForm();
      })
      .finally(() => setBusy(false));
  };

  const preview: NoticeDetails[] = [
    ...(message.trim() !== ""
      ? [
          {
            id: -1,
            message: message.trim(),
            level:
              kind === "incident" ? ("warning" as const) : ("info" as const),
            kind,
            display,
            startsAt: null,
            endsAt: null,
            audience: effectiveAudience,
            dismissible,
            createdAt: new Date().toISOString(),
          },
        ]
      : []),
    ...(notices ?? [])
      .filter(isOn)
      .slice(0, 3 - (message.trim() !== "" ? 1 : 0)),
  ].slice(0, 3);

  return (
    <>
      <div className={styles.list}>
        {notices == null && (
          <p className={common.note}>
            <FormattedMessage
              id="staffDesk.loading"
              defaultMessage="Loading…"
            />
          </p>
        )}
        {notices != null && notices.length === 0 && (
          <p className={common.note}>
            <FormattedMessage
              id="staffDesk.empty"
              defaultMessage="Nothing here."
            />
          </p>
        )}
        {notices?.map((n) => {
          const on = isOn(n);
          return (
            <div
              className={clsx(
                styles.item,
                itemKindClass(n.kind) != null && styles[itemKindClass(n.kind)!],
                !on && styles.itemInactive,
              )}
              key={n.id}
            >
              <div className={styles.itemHead}>
                <h3 className={styles.itemTitle}>{n.message}</h3>
                <span
                  className={clsx(
                    styles.stamp,
                    stampKindClass(n.kind) != null &&
                      styles[stampKindClass(n.kind)!],
                  )}
                >
                  {kindLabel(n.kind)}
                </span>
              </div>
              <div className={styles.itemRow}>
                <span className={styles.itemMeta}>{windowLabel(n)}</span>
                <span className={common.grow} />
                <button
                  type="button"
                  className={clsx(common.switch, on && common.switchOn)}
                  aria-pressed={on}
                  aria-label={formatMessage({
                    id: "deskNotices.toggle",
                    defaultMessage: "Retract or reinstate this notice",
                  })}
                  onClick={() => {
                    const next = !on;
                    setOverrides((prev) => ({ ...prev, [n.id]: next }));
                    void SupportService.setNoticeActive(n.id, next).catch(
                      () => {
                        setOverrides((prev) => ({ ...prev, [n.id]: on }));
                      },
                    );
                  }}
                >
                  <span className={common.switchDot} />
                </button>
                <span className={styles.itemFootLabel}>
                  {on ? (
                    <FormattedMessage
                      id="deskNotices.live"
                      defaultMessage="Live"
                    />
                  ) : (
                    <FormattedMessage
                      id="deskNotices.retracted"
                      defaultMessage="Retracted"
                    />
                  )}
                </span>
                <button
                  type="button"
                  className={styles.itemEdit}
                  onClick={() => startEdit(n)}
                >
                  <FormattedMessage
                    id="deskNotices.edit"
                    defaultMessage="Edit"
                  />
                </button>
                <button
                  type="button"
                  className={styles.itemDelete}
                  onClick={() => setDeleting(n)}
                >
                  <FormattedMessage
                    id="deskNotices.delete"
                    defaultMessage="Delete"
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className={common.split}>
        <div className={common.card} style={{ marginBlockStart: 0 }}>
          <p className={common.micro}>
            {editingId != null ? (
              <FormattedMessage
                id="deskNotices.edit.title"
                defaultMessage="Edit notice"
              />
            ) : (
              <FormattedMessage
                id="deskNotices.new.title"
                defaultMessage="New notice"
              />
            )}
          </p>

          <span className={common.lbl}>
            <FormattedMessage
              id="deskNotices.form.kind"
              defaultMessage="Kind"
            />
          </span>
          <div className={common.tabs}>
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className={clsx(common.tab, kind === k && common.tabOn)}
                onClick={() => setKind(k)}
              >
                {kindLabel(k)}
              </button>
            ))}
          </div>

          <span className={common.lbl}>
            <FormattedMessage
              id="deskNotices.form.display"
              defaultMessage="How it shows"
            />
          </span>
          <div className={common.tabs}>
            <button
              type="button"
              className={clsx(common.tab, display === "banner" && common.tabOn)}
              onClick={() => setDisplay("banner")}
            >
              <FormattedMessage
                id="deskNotices.display.banner"
                defaultMessage="Banner"
              />
            </button>
            <button
              type="button"
              className={clsx(common.tab, display === "window" && common.tabOn)}
              onClick={() => setDisplay("window")}
            >
              <FormattedMessage
                id="deskNotices.display.window"
                defaultMessage="Floating window"
              />
            </button>
          </div>
          {display === "window" && (
            <p className={common.noteSmall} style={{ marginTop: "-0.5rem" }}>
              <FormattedMessage
                id="deskNotices.display.windowNote"
                defaultMessage="Only for a message someone needs to stop and read — most notices should stay a banner."
              />
            </p>
          )}

          <span className={common.lbl}>
            <FormattedMessage
              id="deskNotices.form.message"
              defaultMessage="Message"
            />
          </span>
          <TextField
            type="textarea"
            size="full"
            rows={3}
            maxLength={280}
            placeholder={formatMessage({
              id: "deskNotices.form.messagePlaceholder",
              defaultMessage: "What's happening, in one or two sentences",
            })}
            value={message}
            onChange={setMessage}
          />

          <span className={common.lbl}>
            <FormattedMessage
              id="deskNotices.form.window"
              defaultMessage="Shows from / until"
            />
          </span>
          <div className={styles.dateGrid}>
            <span className={styles.dateWithNow}>
              <input
                type="datetime-local"
                className={styles.dateField}
                value={startsAt}
                onChange={(ev) => setStartsAt(ev.target.value)}
              />
              <button
                type="button"
                className={styles.nowBtn}
                onClick={() => setStartsAt(nowLocalInputValue())}
              >
                <FormattedMessage
                  id="deskNotices.form.now"
                  defaultMessage="Now"
                />
              </button>
            </span>
            <input
              type="datetime-local"
              className={styles.dateField}
              value={endsAt}
              onChange={(ev) => setEndsAt(ev.target.value)}
            />
          </div>

          <span className={common.lbl}>
            <FormattedMessage
              id="deskNotices.form.audience"
              defaultMessage="Who sees it"
            />
          </span>
          <div className={common.tabs}>
            <button
              type="button"
              className={clsx(
                common.tab,
                audience === "everyone" && common.tabOn,
              )}
              onClick={() => setAudience("everyone")}
            >
              <FormattedMessage
                id="deskNotices.audience.everyone"
                defaultMessage="Everyone"
              />
            </button>
            <button
              type="button"
              className={clsx(
                common.tab,
                audience === "signed-in" && common.tabOn,
              )}
              onClick={() => setAudience("signed-in")}
            >
              <FormattedMessage
                id="deskNotices.audience.signedIn"
                defaultMessage="Signed in"
              />
            </button>
            <button
              type="button"
              className={clsx(common.tab, audience === "kids" && common.tabOn)}
              onClick={() => setAudience("kids")}
            >
              <FormattedMessage
                id="deskNotices.audience.kids"
                defaultMessage="Kids"
              />
            </button>
            <button
              type="button"
              className={clsx(
                common.tab,
                audience === "language" && common.tabOn,
              )}
              onClick={() => setAudience("language")}
            >
              <FormattedMessage
                id="deskNotices.audience.language"
                defaultMessage="One language"
              />
            </button>
          </div>
          {audience === "language" && (
            <input
              type="text"
              className={styles.dateField}
              maxLength={16}
              placeholder={formatMessage({
                id: "deskNotices.audience.languageCode",
                defaultMessage: "Locale code, e.g. es or hi",
              })}
              value={locale}
              onChange={(ev) => setLocale(ev.target.value)}
            />
          )}

          <div className={common.btnRow}>
            <button
              type="button"
              className={clsx(common.switch, dismissible && common.switchOn)}
              aria-pressed={dismissible}
              onClick={() => setDismissible((v) => !v)}
            >
              <span className={common.switchDot} />
            </button>
            <span style={{ fontSize: "0.8rem", color: "var(--text-color-f1)" }}>
              <FormattedMessage
                id="deskNotices.form.dismissible"
                defaultMessage="They can dismiss it"
              />
            </span>
          </div>

          <div className={common.btnRow}>
            <Button
              label={formatMessage(
                editingId != null
                  ? {
                      id: "deskNotices.form.save",
                      defaultMessage: "Save changes",
                    }
                  : {
                      id: "deskNotices.form.schedule",
                      defaultMessage: "Schedule",
                    },
              )}
              disabled={message.trim() === "" || busy}
              onClick={save}
            />
            {editingId != null && (
              <button type="button" className={common.link} onClick={resetForm}>
                <FormattedMessage
                  id="deskNotices.form.cancelEdit"
                  defaultMessage="Cancel"
                />
              </button>
            )}
          </div>
        </div>

        <div>
          <p className={common.micro}>
            <FormattedMessage
              id="deskNotices.preview.title"
              defaultMessage="How it lands, top of every page"
            />
          </p>
          {preview.length === 0 && (
            <p className={common.note}>
              <FormattedMessage
                id="deskNotices.preview.empty"
                defaultMessage="Nothing live right now — start typing a message to preview it."
              />
            </p>
          )}
          {preview.map((n) => (
            <div
              className={clsx(
                styles.previewFrame,
                n.display === "window" && styles.previewFrameTall,
              )}
              key={n.id}
            >
              <SiteNotice notice={n} onDismiss={() => {}} contained={true} />
            </div>
          ))}
          <p className={common.noteSmall}>
            <FormattedMessage
              id="deskNotices.preview.note"
              defaultMessage="Incidents have no dismiss button — a person who dismissed one and then hit the same failure would file the ticket you were trying to prevent. Feature notices dismiss forever; maintenance dismisses until the window starts, then returns once."
            />
          </p>
        </div>
      </div>

      {deleting != null && (
        <ConfirmDialog
          title={formatMessage({
            id: "deskNotices.deleteConfirmTitle",
            defaultMessage: "Delete this notice?",
          })}
          message={formatMessage(
            {
              id: "deskNotices.deleteConfirmMessage",
              defaultMessage:
                "“{message}” will be removed for good — this is different from retracting it, which just stops showing it. There is no undo.",
            },
            { message: deleting.message },
          )}
          confirmLabel={formatMessage({
            id: "deskNotices.delete",
            defaultMessage: "Delete",
          })}
          danger={true}
          onConfirm={() => {
            const id = deleting.id;
            setDeleting(null);
            setNotices((prev) => (prev ?? []).filter((n) => n.id !== id));
            void SupportService.deleteNotice(id).catch(load);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
