import { weekdayInSentence } from "@keylearn/intl";
import { notificationsChanged } from "@keylearn/pages-shared";
import {
  Button,
  ConfirmDialog,
  PinField,
  renderMessageText,
  TextField,
} from "@keylearn/widget";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FormattedMessage, type IntlShape, useIntl } from "react-intl";
import { Icon } from "./icons.tsx";
import {
  type AttachFailure,
  Attachment,
  Composer,
  DRAFT_DEBOUNCE_MS,
  Lightbox,
  OfflineNote,
  screenFiles,
  StatusBadge,
  Ticks,
  When,
} from "./MySupport.tsx";
import { ReplyBody } from "./ReplyBody.tsx";
import { SupportService } from "./service.ts";
import * as styles from "./SupportPage.module.less";

/**
 * The account holder's own support section.
 *
 * Three views, never two at once: the list, one conversation, or the form
 * for a new one. Nothing here keeps state the server should hold — drafts,
 * read marks, ratings and dismissals are all written through, so none of it
 * is lost to a refresh, another device, or the grown-up PIN lapsing
 * mid-sentence.
 */

type View =
  | { readonly kind: "list" }
  | { readonly kind: "new" }
  | { readonly kind: "thread"; readonly id: number };

/** A message that has not landed. Kept visible until it does. */
type Outgoing = {
  readonly clientId: string;
  readonly body: string;
  readonly failed: boolean;
};

const newClientId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Messages that have not reached the server yet.
 *
 * The one thing here that is deliberately not in the database: it cannot
 * be, because not reaching the database is what defines it. Held outside
 * the component and mirrored to storage so that going back to the list —
 * or closing the tab on a train — does not throw away something somebody
 * typed. Each survivor carries its `clientId`, so the retry that finally
 * lands is recognised as the same message rather than posted twice.
 */
const OUTBOX_KEY = "keylearn.support.outbox";

function readOutbox(): Record<string, readonly Outgoing[]> {
  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY);
    return raw == null
      ? {}
      : (JSON.parse(raw) as Record<string, readonly Outgoing[]>);
  } catch {
    // Unparseable or unavailable storage is the same as an empty outbox.
    return {};
  }
}

function loadOutbox(ticketId: number): readonly Outgoing[] {
  return readOutbox()[String(ticketId)] ?? [];
}

function storeOutbox(ticketId: number, messages: readonly Outgoing[]): void {
  try {
    const all = readOutbox();
    if (messages.length === 0) {
      delete all[String(ticketId)];
    } else {
      all[String(ticketId)] = messages;
    }
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(all));
  } catch {
    // A full or blocked store costs the durability, not the send.
  }
}

/** How often an open conversation asks whether anything has arrived. */
const POLL_MS = 20_000;

/**
 * How often the desk is told somebody is writing.
 *
 * Comfortably shorter than the desk's own presence TTL, so a person
 * typing continuously never appears to stop — and long enough that a
 * fast typist is not a stream of requests.
 */
const TYPING_PING_MS = 4_000;
/** How long the "someone is answering" dots may run before giving up. */
/**
 * The subject's ceiling, matched to the server's own column so a title
 * that types fine cannot be refused on submit.
 */
const MAX_SUBJECT = 128;

/** The server's way of saying the grown-up PIN needs entering again. */
const isPinLapse = (err: unknown): boolean =>
  (err as { status?: number })?.status === 428 ||
  (err as { body?: { error?: { parentPin?: boolean } } })?.body?.error
    ?.parentPin === true;

const isRateLimited = (err: unknown): boolean =>
  (err as { status?: number })?.status === 429;

export function MySupportSection(): ReactNode {
  const { formatMessage } = useIntl();
  const [gate, setGate] = useState<SupportService.SupportGate | null>(null);
  const [promptOpen, setPromptOpen] = useState(true);
  /**
   * The PIN went stale mid-sentence. Held apart from `gate` so the view
   * underneath stays mounted — unmounting it would throw away whatever had
   * been typed since the last save, which is the thing this prevents.
   */
  const [lapsed, setLapsed] = useState(false);
  /** What to re-run once the PIN is back — set by whoever hit the 428. */
  const retry = useRef<(() => void) | null>(null);
  const onLapse = useCallback((again?: () => void) => {
    retry.current = again ?? null;
    setLapsed(true);
  }, []);

  const [view, setView] = useState<View>({ kind: "list" });
  // How many this account has cleared from its own list. Reset on every
  // load rather than incremented locally, so two tabs cannot disagree.
  const [deletedCount, setDeletedCount] = useState(0);
  const [tickets, setTickets] = useState<
    readonly SupportService.MyTicket[] | null
  >(null);
  const [query, setQuery] = useState("");
  const [rating, setRating] = useState<SupportService.MyTicket | null>(null);
  const [deleting, setDeleting] = useState<SupportService.MyTicket | null>(
    null,
  );
  const [rateLimited, setRateLimited] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { tickets, deletedCount } = await SupportService.listMyTickets();
      setTickets(tickets);
      setDeletedCount(deletedCount);
      setRating((current) => current ?? tickets.find((t) => t.askCsat) ?? null);
      setLoadFailed(false);
    } catch (err) {
      if (isPinLapse(err)) {
        setLapsed(true);
      } else {
        // Anything else has to say so. Leaving `tickets` null showed a
        // skeleton that shimmered forever with no message and no retry.
        setLoadFailed(true);
      }
    }
  }, []);

  /**
   * The proof is handed back when the section is left.
   *
   * On a shared family tablet the account stays signed in and the device
   * changes hands — so a PIN proved fifteen minutes ago is not evidence
   * that a grown-up is holding it now. Leaving the pane, closing the
   * account window and closing the tab all end the visit, and all three
   * end the proof.
   */
  useEffect(() => {
    const hide = () => SupportService.revokeParentPin();
    window.addEventListener("pagehide", hide);
    return () => {
      window.removeEventListener("pagehide", hide);
      hide();
    };
  }, []);

  useEffect(() => {
    let live = true;
    SupportService.getGate()
      .then((g) => live && setGate(g))
      // Fail closed: the server refuses these routes anyway, so an
      // optimistic pane would only offer a section that cannot be used.
      .catch(
        () =>
          live &&
          setGate({
            required: true,
            setupRequired: false,
            proved: false,
            length: null,
          }),
      );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (gate != null && (!gate.required || gate.proved)) {
      void refresh();
    }
  }, [gate, refresh]);

  // Still asking. A flash of the section before the lock appears is the
  // same leak, just briefer.
  if (gate == null) {
    return <section className={styles.section} />;
  }

  if (gate.required && !gate.proved) {
    return promptOpen ? (
      <ParentPinGate
        setupRequired={gate.setupRequired}
        length={gate.length}
        onPass={() => setGate({ ...gate, proved: true })}
        onClose={() => setPromptOpen(false)}
      />
    ) : (
      <SupportLocked
        setupRequired={gate.setupRequired}
        onOpen={() => setPromptOpen(true)}
      />
    );
  }

  const overlay = lapsed ? (
    <PinLapseOverlay
      length={gate?.length ?? null}
      onPass={() => {
        setLapsed(false);
        // The lapse aborted something. Reloading is the honest minimum:
        // it either shows the action went through or shows it did not,
        // where clearing the overlay alone left the person believing a
        // delete or a rating had landed when it never left the browser.
        void refresh();
        retry.current?.();
        retry.current = null;
      }}
    />
  ) : null;

  if (rateLimited) {
    return (
      <section className={styles.section}>
        <h1 className={styles.sectionTitle}>
          <FormattedMessage id="support.headline" defaultMessage="Support" />
        </h1>
        <div className={styles.centred}>
          <Icon name="alert" size={26} />
          <p className={styles.centredText}>
            <FormattedMessage
              id="support.my.rateLimited"
              defaultMessage="That’s five new messages in an hour, which is as many as we can take at once. Add anything else to one of your open conversations, or try again in a little while."
            />
          </p>
          <Button
            label={formatMessage({
              id: "support.my.backToList",
              defaultMessage: "Back to my messages",
            })}
            onClick={() => {
              setRateLimited(false);
              setView({ kind: "list" });
            }}
          />
        </div>
      </section>
    );
  }

  if (view.kind === "new") {
    return (
      <div className={styles.overlayHost}>
        {overlay}
        <NewTicket
          onLapse={onLapse}
          onRateLimited={() => setRateLimited(true)}
          onCancel={() => setView({ kind: "list" })}
          onSent={async (id) => {
            await refresh();
            // Land in the conversation, not back at the list: they have
            // just written something and the next thought is usually "and
            // another thing".
            setView({ kind: "thread", id });
          }}
        />
      </div>
    );
  }

  if (view.kind === "thread") {
    return (
      <div className={styles.overlayHost}>
        {overlay}
        <Thread
          id={view.id}
          onLapse={onLapse}
          onStartNew={() => setView({ kind: "new" })}
          onBack={async () => {
            await refresh();
            setView({ kind: "list" });
          }}
        />
      </div>
    );
  }

  if (tickets == null) {
    return (
      // The overlay belongs here too: if the very first load is what
      // lapsed, this is the only screen there is, and without the prompt
      // it shimmers forever with no way back in.
      <div className={styles.overlayHost}>
        {overlay}
        {loadFailed ? (
          <section className={styles.section}>
            <h1 className={styles.sectionTitle}>
              <FormattedMessage
                id="support.headline"
                defaultMessage="Support"
              />
            </h1>
            <div className={styles.centred}>
              <Icon name="alert" size={26} />
              <p className={styles.centredText}>
                <FormattedMessage
                  id="support.my.loadFailed"
                  defaultMessage="We couldn’t load your messages just now."
                />
              </p>
              <Button
                label={formatMessage({
                  id: "support.my.tryAgain",
                  defaultMessage: "Try again",
                })}
                // Back to the PIN rather than a silent re-request. We do
                // not know why the load failed, and on a shared family
                // tablet an unexplained failure is not a reason to keep
                // the section open — proving the PIN again is cheap, and
                // it re-fetches on the way through.
                onClick={() => {
                  setLoadFailed(false);
                  setTickets(null);
                  setGate((g) =>
                    g == null ? g : { ...g, proved: !g.required },
                  );
                  setPromptOpen(true);
                }}
              />
            </div>
          </section>
        ) : (
          <ListSkeleton />
        )}
      </div>
    );
  }

  const shown =
    query.trim() === ""
      ? tickets
      : tickets.filter(
          (t) =>
            t.subject.toLowerCase().includes(query.toLowerCase()) ||
            t.reference.toLowerCase().includes(query.toLowerCase()),
        );

  // Live first, finished folded away. A support page is somewhere people
  // arrive worried about the thing that is still open, and a year of
  // resolved tickets stacked above it is a wall to read past. Closed
  // threads stay one click away rather than gone: reopening is a reply,
  // and "what did they tell me last time" is a real reason to look.
  const live = shown.filter((t) => t.status !== "closed");
  const resolved = shown.filter((t) => t.status === "closed");

  const chipOf = (t: (typeof tickets)[number]): ReactNode => (
    <div key={t.id} className={styles.chip}>
      <button
        type="button"
        className={styles.chipOpen}
        onClick={() => setView({ kind: "thread", id: t.id })}
      >
        <span className={styles.reference}>{t.reference}</span>
        <span className={styles.chipSubject}>{t.subject}</span>
        <span className={styles.chipMeta}>
          {(t.hasAttachments || t.hasDraft) && (
            <span className={styles.marks}>
              {t.hasDraft && (
                <span className={styles.draftMark}>
                  <FormattedMessage
                    id="support.my.draftMark"
                    defaultMessage="Draft"
                  />
                </span>
              )}
              {t.hasAttachments && <Icon name="clip" size={13} />}
            </span>
          )}
          <When iso={t.updatedAt} />
          {t.unread > 0 && <span className={styles.unread}>{t.unread}</span>}
          <StatusBadge status={t.status} />
        </span>
      </button>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={formatMessage(
          { id: "support.my.delete", defaultMessage: "Remove {ref}" },
          { ref: t.reference },
        )}
        onClick={() => setDeleting(t)}
      >
        <Icon name="trash" />
      </button>
    </div>
  );

  return (
    <div className={styles.overlayHost}>
      {overlay}
      <section className={styles.section}>
        <h1 className={styles.sectionTitle}>
          <FormattedMessage id="support.headline" defaultMessage="Support" />
        </h1>

        {tickets.length === 0 ? (
          <div className={styles.blank}>
            <Icon name="chat" size={32} />
            <p className={styles.centredText}>
              <FormattedMessage
                id="support.my.empty"
                defaultMessage="Nothing here yet. Tell us what’s happening and we’ll reply here, and by email."
              />
            </p>
            <Button
              icon={<Icon name="plus" />}
              label={formatMessage({
                id: "support.my.new",
                defaultMessage: "Log a ticket",
              })}
              onClick={() => setView({ kind: "new" })}
            />
          </div>
        ) : (
          <>
            {tickets.length > 3 && (
              <label className={styles.searchRow}>
                <Icon name="search" />
                <TextField
                  size="full"
                  value={query}
                  placeholder={formatMessage({
                    id: "support.my.search",
                    defaultMessage: "Search your messages",
                  })}
                  onChange={setQuery}
                />
              </label>
            )}

            <div className={styles.floatWrap}>
              <div className={styles.chips}>{live.map(chipOf)}</div>

              {resolved.length > 0 && (
                <details className={styles.resolvedGroup}>
                  <summary className={styles.resolvedSummary}>
                    <FormattedMessage
                      id="support.my.resolvedGroup"
                      defaultMessage="Resolved ({count})"
                      values={{ count: resolved.length }}
                    />
                  </summary>
                  <div className={styles.chips}>{resolved.map(chipOf)}</div>
                </details>
              )}

              {deleting != null && (
                <ConfirmDelete
                  ticket={deleting}
                  onCancel={() => setDeleting(null)}
                  onConfirm={async () => {
                    const remove = async () => {
                      try {
                        await SupportService.deleteMyTicket(deleting.id);
                        setDeleting(null);
                        await refresh();
                      } catch (err) {
                        setDeleting(null);
                        if (isPinLapse(err)) {
                          // Re-run after the PIN, so the ticket the person
                          // asked to remove is actually removed.
                          onLapse(() => void remove());
                        } else {
                          await refresh();
                        }
                      }
                    };
                    await remove();
                  }}
                />
              )}

              {deleting == null && rating != null && (
                <RatingCard
                  ticket={rating}
                  onClose={async () => {
                    const dismiss = async () => {
                      try {
                        await SupportService.dismissCsat(rating.id);
                      } catch (err) {
                        if (isPinLapse(err)) {
                          onLapse(() => void dismiss());
                          return;
                        }
                      }
                      setRating(null);
                      await refresh();
                    };
                    await dismiss();
                  }}
                  onSent={async () => {
                    setRating(null);
                    await refresh();
                  }}
                />
              )}
            </div>

            <div className={styles.actionsRow}>
              <Button
                icon={<Icon name="plus" />}
                label={formatMessage({
                  id: "support.my.new",
                  defaultMessage: "Log a ticket",
                })}
                onClick={() => setView({ kind: "new" })}
              />
              {/* Only once there is something to say. A permanent
                  "0 removed" explains a thing nobody did. */}
              {deletedCount > 0 && (
                <span className={styles.removedNote}>
                  <FormattedMessage
                    id="support.my.removedCount"
                    defaultMessage="{count, plural, one {# ticket removed by you} other {# tickets removed by you}}"
                    values={{ count: deletedCount }}
                  />
                </span>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// ── loading ────────────────────────────────────────────────────────────

function ListSkeleton(): ReactNode {
  return (
    <section className={styles.section}>
      <h1 className={styles.sectionTitle}>
        <FormattedMessage id="support.headline" defaultMessage="Support" />
      </h1>
      <div className="qk-bar-loader" />
      <div className={styles.chips}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="qk-skel-row">
            <div
              className="qk-skel qk-skel--pill"
              style={{ inlineSize: "3rem" }}
            />
            <div className="qk-skel-row-body">
              <div
                className="qk-skel qk-skel--text"
                style={{ inlineSize: `${60 - i * 8}%` }}
              />
            </div>
            <div className="qk-skel qk-skel--pill" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Holds the thread's real shape — left, right, left — so nothing jumps. */
function ThreadSkeleton({
  onBack,
}: {
  readonly onBack: () => void;
}): ReactNode {
  return (
    <section className={styles.section}>
      <div className={styles.threadTop}>
        <button type="button" className={styles.back} onClick={onBack}>
          <Icon name="back" size={14} />
          <FormattedMessage id="support.my.back" defaultMessage="Back" />
        </button>
        <div
          className="qk-skel qk-skel--title"
          style={{ inlineSize: "12rem" }}
        />
      </div>
      <div className={styles.log}>
        <div className={`${styles.msg} ${styles.msgMe}`}>
          <div
            className="qk-skel"
            style={{ inlineSize: "14rem", blockSize: "2.6rem" }}
          />
        </div>
        <div className={`${styles.msg} ${styles.msgThem}`}>
          <div
            className="qk-skel"
            style={{ inlineSize: "18rem", blockSize: "3.4rem" }}
          />
        </div>
        <div className={`${styles.msg} ${styles.msgMe}`}>
          <div
            className="qk-skel"
            style={{ inlineSize: "10rem", blockSize: "2.2rem" }}
          />
        </div>
      </div>
    </section>
  );
}

// ── a new one ──────────────────────────────────────────────────────────

function NewTicket({
  onCancel,
  onSent,
  onLapse,
  onRateLimited,
}: {
  readonly onCancel: () => void;
  readonly onSent: (id: number) => Promise<void>;
  readonly onLapse: (retry?: () => void) => void;
  readonly onRateLimited: () => void;
}): ReactNode {
  const intl = useIntl();
  const { formatMessage } = intl;
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [who, setWho] = useState<{
    readonly name: string;
    readonly email: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = useRef<number | undefined>(undefined);
  /** Held against the account until the ticket exists to claim them. */
  const [pending, setPending] = useState<
    readonly SupportService.MyAttachment[]
  >([]);
  const [uploading, setUploading] = useState<readonly string[]>([]);
  const [attachErrors, setAttachErrors] = useState<readonly AttachFailure[]>(
    [],
  );
  /** Nothing is saved until the restore has landed, or it clears the row. */
  const [restored, setRestored] = useState(false);

  // Restored from the server, not from this tab, so a lapse or a refresh
  // finds it where it was left.
  useEffect(() => {
    let live = true;
    SupportService.getDraft(null)
      .then((d) => {
        if (live) {
          if (d != null) {
            setSubject((s) => (s === "" ? d.subject : s));
            setMessage((m) => (m === "" ? d.body : m));
          }
          setRestored(true);
        }
      })
      .catch((err) => {
        if (isPinLapse(err)) {
          onLapse();
        }
      });
    SupportService.listUnboundAttachments()
      .then((files) => live && setPending(files))
      .catch(() => {});
    SupportService.whoAmI()
      .then((w) => {
        if (live) {
          setWho(w);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [onLapse]);

  useEffect(() => {
    if (!restored) {
      return;
    }
    window.clearTimeout(saved.current);
    saved.current = window.setTimeout(() => {
      void SupportService.saveDraft({
        ticketId: null,
        subject,
        body: message,
      }).catch((err) => {
        // Not swallowed: once the fifteen minutes are up every save fails,
        // and in silence somebody keeps typing into a field that is no
        // longer being kept.
        if (isPinLapse(err)) {
          onLapse();
        }
      });
    }, DRAFT_DEBOUNCE_MS);
    return () => window.clearTimeout(saved.current);
  }, [subject, message, onLapse, restored]);

  const attach = async (files: FileList) => {
    const { ok, rejected } = screenFiles(files, intl);
    setAttachErrors(rejected);
    if (ok.length === 0) {
      return;
    }
    setUploading(ok.map((f) => f.name));
    for (const file of ok) {
      try {
        const row = await SupportService.uploadAttachment(null, file);
        setPending((p) => [...p, row]);
      } catch (e: any) {
        if (isPinLapse(e)) {
          onLapse();
        }
        setAttachErrors((errs) => [
          ...errs,
          // The file is kept: a failure here is usually the network, and
          // producing the screenshot again is the person's time, not ours.
          {
            name: file.name,
            why: e?.body?.error?.message ?? "Upload failed",
            file,
          },
        ]);
      }
      setUploading((u) => u.filter((n) => n !== file.name));
    }
  };

  /**
   * One file, sent through the same path it failed on — screening
   * included, since a retry of something oversized should still be told
   * so rather than uploaded and rejected at the far end.
   */
  const retryOne = async (file: File) => {
    const carrier = new DataTransfer();
    carrier.items.add(file);
    await attach(carrier.files);
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id } = await SupportService.createMyTicket({
        subject,
        message,
        attachmentIds: pending.map((f) => f.id),
      });
      await onSent(id);
    } catch (e: any) {
      if (isPinLapse(e)) {
        onLapse();
      } else if (isRateLimited(e)) {
        onRateLimited();
      } else {
        setError(e?.body?.error?.message ?? e?.message ?? "That didn't send.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.threadTop}>
        <button type="button" className={styles.back} onClick={onCancel}>
          <Icon name="back" size={14} />
          <FormattedMessage id="support.my.back" defaultMessage="Back" />
        </button>
        <h2>
          <FormattedMessage
            id="support.my.newTitle"
            defaultMessage="New message"
          />
        </h2>
      </div>

      <OfflineNote />

      {/* Said rather than assumed: nobody signed in is asked to type their
          own address, so the page shows whose it will be. */}
      {who != null && (
        <div className={styles.asWho}>
          <Icon name="user" size={14} />
          <FormattedMessage
            id="support.my.sentAs"
            defaultMessage="Sent as {name} · {email}"
            values={{ name: <b>{who.name}</b>, email: who.email }}
          />
        </div>
      )}

      {/* Subject first. The message box is tall enough that a field
          underneath it reads as an afterthought, and people scrolled past
          it and then met a Send button that would not send. */}
      <div className={styles.field}>
        <div className={styles.fieldHead}>
          <span className={styles.fieldLabel}>
            <FormattedMessage id="support.my.title" defaultMessage="Subject" />
          </span>
          <span
            className={`${styles.count} ${
              subject.length > MAX_SUBJECT - 10 ? styles.countNear : ""
            }`}
          >
            {subject.length} / {MAX_SUBJECT}
          </span>
        </div>
        <TextField
          size="full"
          value={subject}
          maxLength={MAX_SUBJECT}
          placeholder={formatMessage({
            id: "support.my.titlePlaceholder",
            defaultMessage: "A few words",
          })}
          onChange={(v) => setSubject(v.slice(0, MAX_SUBJECT))}
        />
      </div>

      {/* Message first: people write a poor title before they have
          described the problem, and a good one straight after. */}
      <div className={styles.field}>
        <span className={styles.fieldLabel}>
          <FormattedMessage
            id="support.my.what"
            defaultMessage="What happened?"
          />
        </span>
        <Composer
          value={message}
          onChange={setMessage}
          pending={pending}
          uploading={uploading}
          errors={attachErrors}
          onDismissError={(name) =>
            setAttachErrors((e) => e.filter((x) => x.name !== name))
          }
          onRetry={(file) => {
            setAttachErrors((e) => e.filter((x) => x.name !== file.name));
            void retryOne(file);
          }}
          onAttach={(files) => void attach(files)}
          onRemoveAttachment={(attachmentId) => {
            void SupportService.removeAttachment(attachmentId)
              .then(() =>
                setPending((p) => p.filter((f) => f.id !== attachmentId)),
              )
              .catch((err) => isPinLapse(err) && onLapse());
          }}
          onSend={() => void send()}
          busy={busy}
          hideSend={true}
          placeholder={formatMessage({
            id: "support.my.whatPlaceholder",
            defaultMessage: "Tell us what’s happening…",
          })}
        />
      </div>

      {/* Said, rather than a Send button that quietly does nothing. */}
      {subject.trim() === "" && message.trim() !== "" && (
        <p className={styles.hint}>
          <FormattedMessage
            id="support.my.needTitle"
            defaultMessage="Add a short title and we can send this."
          />
        </p>
      )}

      {error != null && <p className={styles.error}>{error}</p>}

      <div className={styles.actionsRow}>
        <Button
          label={formatMessage({
            id: "support.my.send",
            defaultMessage: "Send",
          })}
          disabled={busy || subject.trim() === "" || message.trim() === ""}
          onClick={() => void send()}
        />
        <Button
          label={formatMessage({
            id: "support.my.cancel",
            defaultMessage: "Cancel",
          })}
          onClick={onCancel}
        />
      </div>
    </section>
  );
}

// ── one conversation ───────────────────────────────────────────────────

function Thread({
  id,
  onBack,
  onLapse,
  onStartNew,
}: {
  readonly id: number;
  readonly onBack: () => Promise<void>;
  readonly onLapse: (retry?: () => void) => void;
  readonly onStartNew: () => void;
}): ReactNode {
  const intl = useIntl();
  const { formatMessage } = intl;
  const [thread, setThread] = useState<SupportService.MyThread | null>(null);
  const [reply, setReply] = useState("");
  /**
   * The last time the desk was told this person is writing.
   *
   * Throttled to one ping every few seconds rather than one per
   * keystroke: the desk's own presence entry lives for a while anyway,
   * so a ping per character would be a hundred requests to say the same
   * thing once.
   */
  const typingSentAt = useRef(0);
  const [outbox, setOutbox] = useState<readonly Outgoing[]>(() =>
    loadOutbox(id),
  );
  const [busy, setBusy] = useState(false);
  const [attachErrors, setAttachErrors] = useState<readonly AttachFailure[]>(
    [],
  );
  const [uploading, setUploading] = useState<readonly string[]>([]);
  const [viewing, setViewing] = useState<SupportService.MyAttachment | null>(
    null,
  );
  const [showAll, setShowAll] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [confirmSorted, setConfirmSorted] = useState(false);
  // Bumped to put the cursor in the reply box after "Not really".
  const [focusReply, setFocusReply] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  /** Until the restore has resolved, an empty debounced save would delete it. */
  const [restored, setRestored] = useState(false);
  /**
   * Shown between sending and the first answer, and never for longer than
   * it takes to stop being true. An indicator that runs forever stops
   * meaning "someone is reading this" and starts meaning nothing.
   */
  /**
   * Somebody at the desk is writing — reported by the desk, not inferred.
   *
   * This used to be switched on by the customer's own send and left up
   * for 45 seconds, so pressing send told them a person was answering
   * before anybody had opened the thread. It is the desk's presence now,
   * and false whenever nobody is there.
   */
  const composing = thread?.deskTyping === true;
  /**
   * Whether there is unseen conversation below the fold.
   *
   * Only shown when it is true — an arrow that is always there stops
   * meaning "there is more" and becomes another control to ignore.
   */
  const [more, setMore] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);
  // Format from the account's preference, instant from this device.
  // Somebody travelling has their preference set to home and their
  // laptop set to where they are standing; the clock should follow the
  // laptop, and how it is written should follow the choice they made.
  const { locale } = intl;
  /**
   * Where the divider goes, held as ids rather than a count.
   *
   * `lastSeenId` is the bottom of the log when the thread was opened;
   * `firstUnseenId` is whatever landed after it, fixed on first sight so
   * the line stays put while the person is reading. Indices were wrong
   * here — "Load earlier" grows the array at the front and slides every
   * position along.
   */
  const lastSeenId = useRef<number | null>(null);
  const firstUnseenId = useRef<number | null>(null);
  const saved = useRef<number | undefined>(undefined);
  /**
   * Read through a ref so `send` does not depend on the whole thread: a
   * new identity every poll re-registered the online listener that flushes
   * the outbox, twenty seconds at a time.
   */
  const pendingIds = useRef<readonly number[]>([]);
  const flushRef = useRef<(() => void) | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (all: boolean) => {
      try {
        const t = await SupportService.getMyTicket(id, all);
        // Reading the thread is what marks its notifications read on the
        // server. Tell the bell now rather than leaving it to its own
        // minute-long poll — the person is looking at both at once, and a
        // badge that lingers after they have read the message reads as the
        // app not having noticed. Only when something actually changed:
        // this loader polls every 20 seconds while the thread is open.
        if (t.markedRead === true) {
          notificationsChanged();
        }
        if (lastSeenId.current == null) {
          lastSeenId.current = t.messages.at(-1)?.id ?? -1;
        } else if (firstUnseenId.current == null) {
          const at = t.messages.findIndex((m) => m.id === lastSeenId.current);
          const next = at >= 0 ? t.messages[at + 1] : undefined;
          if (next != null) {
            firstUnseenId.current = next.id;
          }
        }
        setThread(t);
        setReply((current) =>
          current === "" ? (t.draft?.body ?? "") : current,
        );
        setRestored(true);
        setLoadFailed(false);
      } catch (err) {
        if (isPinLapse(err)) {
          onLapse();
        } else {
          setLoadFailed(true);
        }
      }
    },
    [id, onLapse],
  );

  useEffect(() => {
    void load(showAll);
  }, [load, showAll]);

  // A reply can arrive while somebody is reading. Without this the live
  // region has nothing to announce and the divider never appears.
  useEffect(() => {
    const timer = window.setInterval(() => void load(showAll), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load, showAll]);

  useEffect(() => {
    storeOutbox(id, outbox);
  }, [id, outbox]);

  // Whatever was left unsent when the tab closed goes out on the way back
  // in, without waiting for the person to find the Try again button.
  useEffect(() => {
    if (outbox.some((m) => m.failed)) {
      flushRef.current?.();
    }
    // Once, on arrival: later failures are retried by the online listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    pendingIds.current = thread?.pending.map((p) => p.id) ?? [];
    // The branch that used to live here switched off the "someone is
    // answering" guess when a reply landed. There is no guess any more —
    // the desk reports whether anybody is actually typing — so there is
    // nothing to switch off.
  }, [thread]);

  // The outbox counts as well as the thread: a sent message shows
  // optimistically and only joins `thread.messages` after the round trip,
  // so keying on the thread alone left somebody's own message off-screen
  // until the server answered.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length, outbox.length, composing]);

  // Recalculated on scroll and whenever the conversation grows, since a
  // message arriving while somebody is reading history is exactly when
  // this needs to appear.
  useEffect(() => {
    const el = logRef.current;
    if (el == null) {
      return;
    }
    const check = () => {
      // A couple of pixels of slack: sub-pixel layout means an element
      // scrolled fully to the end rarely lands on an exact zero.
      setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 24);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  }, [thread?.messages.length, outbox.length, showAll]);

  useEffect(() => {
    // Nothing is saved until the restore has landed. An empty save that
    // beat it would clear the row — the server treats a blank draft as
    // "nothing left to keep", which is right, and is exactly why this
    // guard has to exist.
    if (!restored) {
      return;
    }
    window.clearTimeout(saved.current);
    saved.current = window.setTimeout(() => {
      void SupportService.saveDraft({ ticketId: id, body: reply }).catch(
        (err) => {
          if (isPinLapse(err)) {
            onLapse();
          }
        },
      );
    }, DRAFT_DEBOUNCE_MS);
    return () => window.clearTimeout(saved.current);
  }, [reply, id, onLapse, restored]);

  const send = useCallback(
    async (body: string, clientId: string) => {
      setBusy(true);
      try {
        await SupportService.replyToMyTicket(id, {
          message: body,
          clientId,
          attachmentIds: pendingIds.current,
        });
        setOutbox((o) => o.filter((m) => m.clientId !== clientId));
        await load(showAll);
        // The hand-off to the desk finishes after the send returns, so
        // the reload above always sees one tick. One more look a moment
        // later catches the second without waiting out the 20s poll.
        window.setTimeout(() => void load(showAll), 1500);
      } catch (err) {
        if (isPinLapse(err)) {
          onLapse();
        }
        setOutbox((o) =>
          o.map((m) => (m.clientId === clientId ? { ...m, failed: true } : m)),
        );
      } finally {
        setBusy(false);
      }
    },
    [id, load, showAll, onLapse],
  );

  /** Whatever could not be sent goes out again the moment we are back. */
  const flush = useCallback(() => {
    for (const m of outbox.filter((o) => o.failed)) {
      void send(m.body, m.clientId);
    }
  }, [outbox, send]);

  // The arrival flush runs before `flush` is defined in source order.
  flushRef.current = flush;

  const attach = async (files: FileList) => {
    // Screened here first. A 12 MB screenshot that only fails after the
    // whole upload is a minute gone and a progress bar that meant nothing.
    const { ok, rejected } = screenFiles(files, intl);
    const failures: AttachFailure[] = [...rejected];
    if (ok.length === 0) {
      setAttachErrors(failures);
      return;
    }
    setUploading(ok.map((f) => f.name));
    for (const file of ok) {
      try {
        await SupportService.uploadAttachment(id, file);
      } catch (e: any) {
        if (isPinLapse(e)) {
          onLapse();
        }
        // One entry per file: a single string meant the last failure
        // silently replaced the earlier ones. The file rides along so the
        // chip can offer Retry.
        failures.push({
          name: file.name,
          why: e?.body?.error?.message ?? "Upload failed",
          file,
        });
      }
      setUploading((u) => u.filter((n) => n !== file.name));
    }
    setAttachErrors(failures);
    await load(showAll);
  };

  /**
   * One file, sent through the same path it failed on — screening
   * included, since a retry of something oversized should still be told
   * so rather than uploaded and rejected at the far end.
   */
  const retryOne = async (file: File) => {
    const carrier = new DataTransfer();
    carrier.items.add(file);
    await attach(carrier.files);
  };

  if (thread == null) {
    return loadFailed ? (
      <section className={styles.section}>
        <div className={styles.threadTop}>
          <button
            type="button"
            className={styles.back}
            onClick={() => void onBack()}
          >
            <Icon name="back" size={14} />
            <FormattedMessage id="support.my.back" defaultMessage="Back" />
          </button>
        </div>
        <div className={styles.centred}>
          <Icon name="alert" size={26} />
          <p className={styles.centredText}>
            <FormattedMessage
              id="support.my.threadFailed"
              defaultMessage="We couldn’t open this conversation just now."
            />
          </p>
          <Button
            label={formatMessage({
              id: "support.my.tryAgain",
              defaultMessage: "Try again",
            })}
            onClick={() => void load(showAll)}
          />
        </div>
      </section>
    ) : (
      <ThreadSkeleton onBack={() => void onBack()} />
    );
  }

  if (viewing != null) {
    return (
      <section className={styles.section}>
        <div className={styles.threadTop}>
          <button
            type="button"
            className={styles.back}
            onClick={() => setViewing(null)}
          >
            <Icon name="back" size={14} />
            <FormattedMessage
              id="support.my.backToConversation"
              defaultMessage="Back to the conversation"
            />
          </button>
          <span className={styles.reference}>{thread.reference}</span>
        </div>
        <Lightbox file={viewing} onClose={() => setViewing(null)} />
      </section>
    );
  }

  // Resolved is final, like spam. Reopening used to be a reply away, which
  // read as kind but meant the desk's copy — closed, out of the queue, with
  // a note saying nothing is needed — could be woken by a message nobody
  // was watching for. A new ticket starts where somebody is looking, and
  // can name the old one to bring its history with it.
  const cannotReopen = thread.status === "spam" || thread.status === "closed";
  const last = thread.messages.at(-1);
  // Asked in the thread, at the end of the answer, while it is still fresh
  // — and it is a question about the problem, not about us. The rating card
  // is a different question and comes later, once the case has closed.
  // A staffer has marked this resolved at the desk and we are waiting on
  // an answer. Stronger than the question below — it has a deadline, and
  // saying nothing has a consequence — so it replaces that question rather
  // than sitting beside it. Two prompts asking the same thing with
  // different stakes is how somebody answers the wrong one.
  const closeRequested =
    !answered && !cannotReopen && thread.closeRequestedAt != null;
  const askSorted =
    !answered &&
    !cannotReopen &&
    !closeRequested &&
    last != null &&
    last.sender !== "them" &&
    last.kind == null;

  let dayShown: string | null = null;

  return (
    <section className={`${styles.section} ${styles.sectionThread}`}>
      {/* Back, reference, badge on one line with the reference centred
          between them; the subject beneath, where a long one can run
          without pushing the badge off the end. */}
      <div className={styles.threadHead}>
        <div className={styles.threadTop}>
          <button
            type="button"
            className={styles.back}
            onClick={() => void onBack()}
          >
            <Icon name="back" size={14} />
            <FormattedMessage id="support.my.back" defaultMessage="Back" />
          </button>
          <span className={styles.reference}>{thread.reference}</span>
          <StatusBadge status={thread.status} />
        </div>
        {/* `title` rather than a tooltip component: it is the browser's
            own, it works on a truncated element without any extra state,
            and it is what a screen reader reads anyway. */}
        <h2 className={styles.threadSubject} title={thread.subject}>
          {thread.subject}
        </h2>
        {/* An expectation, only while a person has the thread and only
            when there's a real number behind it (the desk's own median).
            "Flagged" used to render as unexplained silence — the single
            most bot-like thing the desk did to a customer. */}
        {thread.status === "flagged" && thread.expectedReplyMinutes != null && (
          <p className={styles.expectation}>
            <FormattedMessage
              id="support.my.expectedReply"
              defaultMessage="A person has this one. We usually reply within about {wait}."
              values={{ wait: waitWords(thread.expectedReplyMinutes, intl) }}
            />
          </p>
        )}
      </div>

      <div className={styles.thread}>
        <OfflineNote onReconnect={flush} />

        <div
          ref={logRef}
          className={styles.log}
          role="log"
          aria-live="polite"
          aria-label={intl.formatMessage({
            id: "support.my.conversation",
            defaultMessage: "Conversation",
          })}
        >
          {thread.hasEarlier && !showAll && (
            <button
              type="button"
              className={styles.earlier}
              onClick={() => setShowAll(true)}
            >
              <FormattedMessage
                id="support.my.loadEarlier"
                defaultMessage="Load earlier messages"
              />
            </button>
          )}

          {thread.messages.map((m, i) => {
            const mine = m.sender === "them";
            const day = new Date(m.createdAt).toDateString();
            const newDay = day !== dayShown;
            dayShown = day;
            // Anchored to an id, not an index: "Load earlier" grows the
            // array at the front, and an index then points at a stranger.
            const dividerHere = firstUnseenId.current === m.id;

            return (
              <div key={m.id} className={styles.entry}>
                {newDay && (
                  <span className={styles.day}>
                    {dayLabel(m.createdAt, intl)}
                  </span>
                )}
                {dividerHere && (
                  <span className={styles.divider}>
                    <FormattedMessage
                      id="support.my.newHere"
                      defaultMessage="New"
                    />
                  </span>
                )}

                {m.kind === "crisis" ? (
                  /* Never a bubble. Nothing about the emergency redirect
                     should read as the assistant chatting. The redirect
                     arrives as a few paced chunks; the alert header opens
                     the run once rather than repeating on every chunk. */
                  <div className={styles.crisis} role="alert">
                    {thread.messages[i - 1]?.kind !== "crisis" && (
                      <span className={styles.crisisHead}>
                        <Icon name="alert" size={16} />
                        <FormattedMessage
                          id="support.my.crisisHead"
                          defaultMessage="This sounds like an emergency"
                        />
                      </span>
                    )}
                    <CrisisBody text={m.body} />
                  </div>
                ) : m.sender === "system" || m.kind === "handover" ? (
                  <p className={styles.systemMsg}>
                    {renderMessageText(m.body, undefined, locale)}
                  </p>
                ) : (
                  <div
                    className={`${styles.msg} ${mine ? styles.msgMe : styles.msgThem}`}
                  >
                    {/* A person is never labelled as the assistant, and the
                        assistant is never passed off as a person. The desk
                        may not send a name; the sender always says which
                        of the two it was. */}
                    {!mine && (
                      <span className={styles.from}>
                        {m.sender === "agent" ? (
                          <>
                            {m.authorName ??
                              formatMessage({
                                id: "support.my.assistantName",
                                defaultMessage: "KeyLearn assistant",
                              })}
                            <span className={styles.fromRole}>
                              <FormattedMessage
                                id="support.my.aiRole"
                                defaultMessage="AI assistant"
                              />
                            </span>
                          </>
                        ) : (
                          <>
                            {m.authorName ??
                              formatMessage({
                                id: "support.my.staffName",
                                defaultMessage: "KeyLearn support",
                              })}
                            <span className={styles.fromRole}>
                              <FormattedMessage
                                id="support.my.staffRole"
                                defaultMessage="KeyLearn"
                              />
                            </span>
                          </>
                        )}
                      </span>
                    )}
                    <div className={styles.bubble}>
                      {m.attachments.map((a) => (
                        <Attachment key={a.id} file={a} onView={setViewing} />
                      ))}
                      {/* Rich rendering for what the DESK writes only.
                          A customer typing asterisks means asterisks —
                          promoting their own words into product chrome
                          would put KeyLearn's voice in their mouth. Their
                          bubble below stays plain. */}
                      <ReplyBody text={m.body} locale={locale} />
                    </div>
                    <span className={styles.stamp}>
                      {new Date(m.createdAt).toLocaleTimeString(locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {/* Only on your own: a tick on a message somebody
                          else sent you would be reporting on them. */}
                      {mine && (
                        <Ticks
                          className={styles.ticks}
                          delivered={m.deliveredAt != null}
                        />
                      )}
                      {/* Did THIS reply help — the pair of drawn thumbs,
                          only on replies the desk can attribute (it needs
                          the desk id the delivery carried in). Never on
                          the emergency script: rating an emergency
                          redirect is not a question worth asking. */}
                      {!mine && m.qdeskMessageId != null && m.kind == null && (
                        <ReplyFeedback ticketId={id} message={m} />
                      )}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {outbox.map((m) => (
            <div
              key={m.clientId}
              className={`${styles.msg} ${styles.msgMe} ${m.failed ? styles.msgFailed : ""}`}
            >
              <div className={styles.bubble}>
                {renderMessageText(m.body, undefined, locale)}
              </div>
              {m.failed ? (
                <span className={styles.failNote}>
                  <Icon name="alert" size={13} />
                  <FormattedMessage
                    id="support.my.didntSend"
                    defaultMessage="Didn’t send."
                  />
                  <button
                    type="button"
                    onClick={() => void send(m.body, m.clientId)}
                  >
                    <FormattedMessage
                      id="support.my.retry"
                      defaultMessage="Try again"
                    />
                  </button>
                </span>
              ) : (
                <span className={styles.sending}>
                  <span className="qk-spinner" />
                  <FormattedMessage
                    id="support.my.sending"
                    defaultMessage="Sending"
                  />
                </span>
              )}
            </div>
          ))}

          {confirmSorted && (
            <ConfirmDialog
              title={formatMessage({
                id: "support.my.sortedConfirm.title",
                defaultMessage: "Mark this as resolved?",
              })}
              message={formatMessage({
                id: "support.my.sortedConfirm.message",
                defaultMessage:
                  "This closes the conversation for good — replying won’t reopen it. If something else comes up you can start a new message and quote this ticket’s number, and we’ll pick up the history.",
              })}
              confirmLabel={formatMessage({
                id: "support.my.sortedConfirm.yes",
                defaultMessage: "Yes, it’s resolved",
              })}
              onConfirm={() => {
                setConfirmSorted(false);
                void SupportService.markSorted(id)
                  .then(() => {
                    setAnswered(true);
                    return load(showAll);
                  })
                  // Marked answered only once it landed: setting it first
                  // made the card vanish with nothing recorded.
                  .catch((err) => isPinLapse(err) && onLapse());
              }}
              onCancel={() => setConfirmSorted(false)}
            />
          )}

          {closeRequested && (
            <div className={styles.closedNote}>
              <p className={styles.sortedQ}>
                <FormattedMessage
                  id="support.my.deskClosed"
                  defaultMessage="Support think this one is sorted"
                />
              </p>
              <p className={styles.sortedSub}>
                {thread.closeConfirmDueAt != null ? (
                  <FormattedMessage
                    id="support.my.deskClosed.due"
                    defaultMessage="If it is, you don’t need to do anything — it will close itself on {when}. If it isn’t, keep it open and we’ll carry on."
                    values={{
                      when: deadlineLabel(thread.closeConfirmDueAt, locale),
                    }}
                  />
                ) : (
                  <FormattedMessage
                    id="support.my.deskClosed.sub"
                    defaultMessage="If it is, you don’t need to do anything. If it isn’t, keep it open and we’ll carry on."
                  />
                )}
              </p>
              <div className={styles.actionsRow}>
                <Button
                  label={formatMessage({
                    id: "support.my.deskClosed.yes",
                    defaultMessage: "Yes, it’s resolved",
                  })}
                  // Same dialog as the lighter question below: this still
                  // ends the conversation for good, and being asked by the
                  // desk first does not make that less final.
                  onClick={() => setConfirmSorted(true)}
                />
                <Button
                  label={formatMessage({
                    id: "support.my.deskClosed.no",
                    defaultMessage: "Keep it open",
                  })}
                  onClick={() => {
                    void SupportService.notSorted(id)
                      .then(() => {
                        setFocusReply((n) => n + 1);
                        return load(showAll);
                      })
                      .catch((err) => isPinLapse(err) && onLapse());
                  }}
                />
              </div>
            </div>
          )}

          {askSorted && (
            <div className={styles.closedNote}>
              <p className={styles.sortedQ}>
                <FormattedMessage
                  id="support.my.sorted"
                  defaultMessage="Did that sort it?"
                />
              </p>
              <div className={styles.actionsRow}>
                <Button
                  label={formatMessage({
                    id: "support.my.sortedYes",
                    defaultMessage: "Yes",
                  })}
                  // Asked before it happens, because it cannot be taken
                  // back: this closes the thread on both sides and no
                  // reply reopens it. A tap meant for "Not really" that
                  // lands one button to the left should not cost somebody
                  // the conversation they were in the middle of.
                  onClick={() => setConfirmSorted(true)}
                />
                <Button
                  label={formatMessage({
                    id: "support.my.sortedNo",
                    defaultMessage: "Not really",
                  })}
                  onClick={() => {
                    void SupportService.notSorted(id)
                      .then(() => {
                        setAnswered(true);
                        setFocusReply((n) => n + 1);
                        return load(showAll);
                      })
                      .catch((err) => isPinLapse(err) && onLapse());
                  }}
                />
              </div>
            </div>
          )}

          {composing && (
            <div className={`${styles.msg} ${styles.msgThem}`}>
              <div
                className={`${styles.bubble} ${styles.composingBubble}`}
                aria-label={formatMessage({
                  id: "support.my.composing",
                  defaultMessage: "Someone is answering",
                })}
              >
                <span
                  className={`qk-dots ${styles.typingDots}`}
                  aria-hidden="true"
                >
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
          )}

          <div ref={bottom} />
        </div>

        {more && (
          <button
            type="button"
            className={styles.toBottom}
            aria-label={formatMessage({
              id: "support.my.toBottom",
              defaultMessage: "Jump to the latest message",
            })}
            onClick={() =>
              bottom.current?.scrollIntoView({
                block: "end",
                behavior: "smooth",
              })
            }
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="M8 3v9M4.2 8.4 8 12.2l3.8-3.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {cannotReopen ? (
          <div className={styles.closedNote}>
            <p>
              <FormattedMessage
                id="support.my.cannotReopen"
                defaultMessage="This conversation is closed and can’t be reopened. If you need help with something else, start a new one."
              />
            </p>
            <Button
              icon={<Icon name="plus" />}
              label={formatMessage({
                id: "support.my.new",
                defaultMessage: "Log a ticket",
              })}
              onClick={onStartNew}
            />
          </div>
        ) : (
          <Composer
            value={reply}
            onChange={(next) => {
              setReply(next);
              const now = Date.now();
              if (next !== "" && now - typingSentAt.current > TYPING_PING_MS) {
                typingSentAt.current = now;
                SupportService.typing(id);
              }
            }}
            focusSignal={focusReply}
            pending={thread.pending}
            uploading={uploading}
            errors={attachErrors}
            onDismissError={(name) =>
              setAttachErrors((e) => e.filter((x) => x.name !== name))
            }
            onRetry={(file) => {
              setAttachErrors((e) => e.filter((x) => x.name !== file.name));
              void retryOne(file);
            }}
            onAttach={(files) => void attach(files)}
            onRemoveAttachment={(attachmentId) => {
              void SupportService.removeAttachment(attachmentId)
                .then(() => load(showAll))
                .catch((err) => isPinLapse(err) && onLapse());
            }}
            onSend={() => {
              const clientId = newClientId();
              const body = reply;
              // Cleared here, not on success: leaving it in the box while
              // the pending bubble also shows it puts the same message on
              // screen twice.
              setReply("");
              setOutbox((o) => [...o, { clientId, body, failed: false }]);
              void send(body, clientId);
            }}
            busy={busy}
            placeholder={formatMessage({
              id: "support.my.reply",
              defaultMessage: "Write a reply…",
            })}
          />
        )}
      </div>
    </section>
  );
}

// ── floating cards ─────────────────────────────────────────────────────

function ConfirmDelete({
  ticket,
  onCancel,
  onConfirm,
}: {
  readonly ticket: SupportService.MyTicket;
  readonly onCancel: () => void;
  readonly onConfirm: () => Promise<void>;
}): ReactNode {
  const intl = useIntl();
  const { formatMessage } = intl;
  const first = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className={styles.floatCard}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="support-del-q"
      aria-describedby="support-del-d"
    >
      <div className={styles.floatTop}>
        <div>
          <div className={styles.floatQ} id="support-del-q">
            <FormattedMessage
              id="support.my.deleteTitle"
              defaultMessage="Remove {ref} from your messages?"
              values={{ ref: ticket.reference }}
            />
          </div>
          <div className={styles.floatSub}>
            <FormattedMessage
              id="support.my.deleteSub"
              defaultMessage="{subject} · opened {when}"
              values={{
                subject: ticket.subject,
                when: dayLabel(ticket.createdAt, intl),
              }}
            />
          </div>
        </div>
        <button
          type="button"
          className={styles.floatClose}
          onClick={onCancel}
          aria-label={formatMessage({
            id: "support.my.cancel",
            defaultMessage: "Cancel",
          })}
        >
          <Icon name="x" size={13} />
        </button>
      </div>
      <p className={styles.floatSub} id="support-del-d" style={{ margin: 0 }}>
        <FormattedMessage
          id="support.my.deleteBody"
          defaultMessage="It goes from your list straight away. Our team keeps a copy of the conversation and anything you attached, filed away — so if you write again about the same thing, they can still see what was said. To have it erased entirely, ask us and we’ll do that."
        />
      </p>
      <div className={styles.actionsRow}>
        <button
          ref={first}
          type="button"
          className={styles.dangerButton}
          onClick={() => void onConfirm()}
        >
          <FormattedMessage
            id="support.my.deleteYes"
            defaultMessage="Remove it"
          />
        </button>
        <Button
          label={formatMessage({
            id: "support.my.deleteNo",
            defaultMessage: "Keep it",
          })}
          onClick={onCancel}
        />
      </div>
    </div>
  );
}

/**
 * The emergency redirect, with the number set large.
 *
 * The script marks the number itself with `**`, so this needs no parsing
 * of the sentence around it and keeps working in every locale the script
 * is translated into. The first line is dropped because the heading above
 * already says it.
 */
/**
 * The pair of drawn thumbs under a desk reply — "did this one help".
 *
 * Optimistic and forgiving: the choice paints immediately, a mis-tap is
 * corrected by tapping the other one (last tap wins on the server too),
 * and a failed request quietly reverts rather than scolding — losing a
 * thumb is not worth an error dialog. Icons are the section's own drawn
 * glyphs, not platform emoji, for the same reason as every other control
 * here: they take the theme's colour and read as controls, not stickers.
 */
function ReplyFeedback({
  ticketId,
  message,
}: {
  readonly ticketId: number;
  readonly message: {
    readonly id: number;
    readonly feedback: "good" | "bad" | null;
  };
}): ReactNode {
  const { formatMessage } = useIntl();
  const [rating, setRating] = useState<"good" | "bad" | null>(message.feedback);
  const rate = (value: "good" | "bad") => {
    if (rating === value) {
      return;
    }
    const previous = rating;
    setRating(value);
    SupportService.rateReply(ticketId, message.id, value).catch(() => {
      setRating(previous);
    });
  };
  return (
    <span className={styles.replyFeedback}>
      <button
        type="button"
        className={`${styles.thumb} ${rating === "good" ? styles.thumbOn : ""}`}
        aria-pressed={rating === "good"}
        title={formatMessage({
          id: "support.my.replyHelped",
          defaultMessage: "This reply helped",
        })}
        aria-label={formatMessage({
          id: "support.my.replyHelped",
          defaultMessage: "This reply helped",
        })}
        onClick={() => rate("good")}
      >
        <Icon name="thumbUp" size={13} />
      </button>
      <button
        type="button"
        className={`${styles.thumb} ${rating === "bad" ? styles.thumbBadOn : ""}`}
        aria-pressed={rating === "bad"}
        title={formatMessage({
          id: "support.my.replyDidNotHelp",
          defaultMessage: "This reply didn’t help",
        })}
        aria-label={formatMessage({
          id: "support.my.replyDidNotHelp",
          defaultMessage: "This reply didn’t help",
        })}
        onClick={() => rate("bad")}
      >
        <Icon name="thumbDown" size={13} />
      </button>
    </span>
  );
}

function CrisisBody({ text }: { readonly text: string }): ReactNode {
  const lines = text.split("\n");
  const body = (
    lines[0]?.startsWith("This sounds like an emergency")
      ? lines.slice(1)
      : lines
  )
    .join("\n")
    .trim();

  return (
    <>
      {body.split(/\n{2,}/).map((para, i) => (
        <p key={i}>
          {para.split("**").map((part, j) =>
            // Odd indices are what the script marked: the number to dial.
            // Rendered digit-by-digit in individual boxes (owner
            // directive) — aria carries the whole number so assistive
            // tech reads "000", not "zero. zero. zero." as three items.
            j % 2 === 1 ? (
              <span
                key={j}
                className={styles.dialNumber}
                aria-label={part.trim()}
              >
                {part
                  .trim()
                  .split("")
                  .map((ch, k) => (
                    <span
                      key={k}
                      className={styles.dialDigit}
                      aria-hidden={true}
                    >
                      {ch}
                    </span>
                  ))}
              </span>
            ) : (
              part
            ),
          )}
        </p>
      ))}
    </>
  );
}

/** Read aloud by a screen reader, so each needs to exist in the catalogue. */
function starWords(intl: IntlShape): readonly string[] {
  return [
    "",
    intl.formatMessage({ id: "support.my.star1", defaultMessage: "One star" }),
    intl.formatMessage({ id: "support.my.star2", defaultMessage: "Two stars" }),
    intl.formatMessage({
      id: "support.my.star3",
      defaultMessage: "Three stars",
    }),
    intl.formatMessage({
      id: "support.my.star4",
      defaultMessage: "Four stars",
    }),
    intl.formatMessage({
      id: "support.my.star5",
      defaultMessage: "Five stars",
    }),
  ];
}

/**
 * A chat log is read by "today" and "yesterday" far more than by date.
 * Anything older keeps the date, because a weekday alone stops being a
 * date once it is more than a week back.
 */
/**
 * A wait in words a person plans around — "an hour", "3 hours", "a day"
 * — never "137 minutes". Rounded UP on purpose: an expectation the desk
 * usually beats builds trust, one it usually misses spends it.
 */
function waitWords(minutes: number, intl: IntlShape): string {
  if (minutes <= 60) {
    return intl.formatMessage({
      id: "support.my.waitHour",
      defaultMessage: "an hour",
    });
  }
  if (minutes <= 12 * 60) {
    return intl.formatMessage(
      {
        id: "support.my.waitHours",
        defaultMessage: "{hours} hours",
      },
      { hours: Math.ceil(minutes / 60) },
    );
  }
  return intl.formatMessage({
    id: "support.my.waitDay",
    defaultMessage: "a day",
  });
}

/**
 * A date in the future, named.
 *
 * Separate from {@link dayLabel} because that one counts backwards: its
 * `daysBack` goes negative for anything ahead of now and lands on the
 * "Today" branch, so a deadline three days away rendered as "it will close
 * itself on Today".
 *
 * Deliberately a weekday or a date and never "tomorrow" — the string this
 * fills has a preposition in front of it in most languages, chosen by the
 * translators for exactly those two shapes, and "on tomorrow" is wrong in
 * all of them. Within the week a weekday reads better than a date for a
 * deadline somebody is deciding about; past that a date is the only thing
 * that is unambiguous.
 */
function deadlineLabel(iso: string, locale: string): string {
  const then = new Date(iso);
  const daysAhead = Math.ceil(
    (then.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  if (daysAhead > 0 && daysAhead < 7) {
    // Not the formatter's own weekday: thirteen of the catalogue's languages
    // need a case-inflected or preposition-bearing form here ("tiistaina",
    // "we wtorek") and Intl only ever returns the dictionary form. See
    // weekdayInSentence — every other locale falls through to exactly the
    // call this replaces.
    return weekdayInSentence(then, locale);
  }
  return then.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year:
      then.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function dayLabel(iso: string, intl: IntlShape): string {
  const then = new Date(iso);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const daysBack =
    Math.floor((midnight.getTime() - then.getTime()) / 86400000) + 1;
  if (daysBack <= 0) {
    return intl.formatMessage({
      id: "support.my.today",
      defaultMessage: "Today",
    });
  }
  if (daysBack === 1) {
    return intl.formatMessage({
      id: "support.my.yesterday",
      defaultMessage: "Yesterday",
    });
  }
  return then.toLocaleDateString(undefined, {
    weekday: daysBack < 7 ? "long" : undefined,
    day: "numeric",
    month: "short",
    year:
      then.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function RatingCard({
  ticket,
  onClose,
  onSent,
}: {
  readonly ticket: SupportService.MyTicket;
  readonly onClose: () => Promise<void>;
  readonly onSent: () => Promise<void>;
}): ReactNode {
  const intl = useIntl();
  const { formatMessage } = intl;
  const words = starWords(intl);
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <div className={styles.floatCard}>
        <div className={styles.floatTop}>
          <span className={styles.thanks}>
            <Icon name="tick" size={16} />
            <FormattedMessage
              id="support.my.csatThanks"
              defaultMessage="Thanks — that goes to the people who answered you."
            />
          </span>
          <button
            type="button"
            className={styles.floatClose}
            onClick={() => void onSent()}
            aria-label={formatMessage({
              id: "support.my.close",
              defaultMessage: "Close",
            })}
          >
            <Icon name="x" size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.floatCard}>
      <div className={styles.floatTop}>
        <div>
          <div className={styles.floatQ}>
            <FormattedMessage
              id="support.my.csatQ"
              defaultMessage="How did we do on {ref}?"
              values={{ ref: ticket.reference }}
            />
          </div>
          <div className={styles.floatSub}>
            <FormattedMessage
              id="support.my.csatSub"
              defaultMessage="{subject} · closed {when}"
              values={{
                subject: ticket.subject,
                when: dayLabel(ticket.updatedAt, intl),
              }}
            />
          </div>
        </div>
        <button
          type="button"
          className={styles.floatClose}
          onClick={() => void onClose()}
          aria-label={formatMessage({
            id: "support.my.close",
            defaultMessage: "Close",
          })}
        >
          <Icon name="x" size={13} />
        </button>
      </div>

      <div className={styles.starsRow}>
        <div
          className={styles.stars}
          role="radiogroup"
          aria-label={formatMessage({
            id: "support.my.rateLabel",
            defaultMessage: "Rate from 1 to 5 stars",
          })}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={formatMessage(
                {
                  id: "support.my.starN",
                  defaultMessage: "{n, plural, one {# star} other {# stars}}",
                },
                { n },
              )}
              className={`${styles.star} ${n <= stars ? styles.starLit : ""}`}
              onClick={() => setStars(n)}
            >
              <Icon name="star" filled={n <= stars} size={18} />
            </button>
          ))}
        </div>
        {stars > 0 && <span className={styles.starLabel}>{words[stars]}</span>}
      </div>

      {/* The note appears only once a star is chosen — asking up front
          turns a one-tap thing into a form. */}
      {stars > 0 && (
        <>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              <FormattedMessage
                id="support.my.csatNote"
                defaultMessage="Anything you’d like to add? (optional)"
              />
            </span>
            <TextField
              size="full"
              type="textarea"
              value={note}
              onChange={setNote}
            />
          </div>
          {error != null && <p className={styles.error}>{error}</p>}
          <div className={styles.actionsRow}>
            <Button
              label={formatMessage({
                id: "support.my.send",
                defaultMessage: "Send",
              })}
              onClick={() => {
                void SupportService.rateTicket(
                  ticket.id,
                  stars,
                  note.trim() || null,
                )
                  .then(() => setDone(true))
                  .catch(() =>
                    setError(
                      formatMessage({
                        id: "support.my.csatFailed",
                        defaultMessage:
                          "That didn’t send. Try again in a moment.",
                      }),
                    ),
                  );
              }}
            />
            <Button
              label={formatMessage({
                id: "support.my.notNow",
                defaultMessage: "Not now",
              })}
              onClick={() => void onClose()}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── the grown-up PIN ───────────────────────────────────────────────────

function ParentPinGate({
  setupRequired,
  length,
  onPass,
  onClose,
}: {
  readonly setupRequired: boolean;
  /** One box per digit of this household's PIN. */
  readonly length: number | null;
  readonly onPass: () => void;
  readonly onClose: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (setupRequired) {
    return (
      <section className={styles.section}>
        <div className={styles.centred}>
          <Icon name="lock" size={26} />
          <p className={styles.centredText}>
            <FormattedMessage
              id="support.my.setupNeeded"
              defaultMessage="There’s a kid profile on this account, so writing to us needs a grown-up PIN. Set one up in Security and come back — it takes a moment, and it keeps these conversations out of small hands."
            />
          </p>
          <div className={styles.actionsRow}>
            <Button
              label={formatMessage({
                id: "support.pin.setupCta",
                defaultMessage: "Set up a PIN",
              })}
              onClick={() => {
                // The pane alone is not enough: the PIN card is below the
                // fold, so "set one up in Security" would land on a screen
                // with nothing visibly about a PIN on it.
                try {
                  window.sessionStorage.setItem(
                    "keylearn.security.scrollToPin",
                    "1",
                  );
                } catch {
                  // Blocked storage costs the scroll, not the navigation.
                }
                window.location.hash = "security";
              }}
            />
            <Button
              label={formatMessage({
                id: "support.pin.close",
                defaultMessage: "Not now",
              })}
              onClick={onClose}
            />
          </div>
        </div>
      </section>
    );
  }

  /**
   * Takes the PIN as an argument rather than reading state.
   *
   * `onComplete` fires from inside the change handler that filled the last
   * box, one render before that digit reaches state — so a submit that
   * read `pin` verified the PIN minus its final digit and reported it
   * wrong, every time, for a PIN that was right.
   */
  const submit = async (candidate: string = pin) => {
    // Filling the last box submits, and so does the button beside it. Two
    // verifies for one PIN spends two of the ten attempts the limiter
    // allows in five minutes.
    if (busy) {
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await SupportService.verifyParentPin(candidate);
      onPass();
    } catch {
      // Cleared, so the next attempt starts from an empty row rather than
      // needing the old digits picked out first.
      setPin("");
      setErr(
        formatMessage({
          id: "support.pin.wrong",
          defaultMessage: "That PIN is not right.",
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.centred}>
        <Icon name="lock" size={26} />
        <p className={styles.centredText}>
          <FormattedMessage
            id="support.my.pinIntro"
            defaultMessage="There’s a kid profile on this account, so messages to us are a grown-up’s. Enter the PIN to open support."
          />
        </p>
        <PinField
          value={pin}
          length={length}
          onChange={setPin}
          onComplete={(value) => void submit(value)}
          disabled={busy}
        />
        {err != null && <p className={styles.pinError}>{err}</p>}
        {/* No Continue: the last digit submits, so a button that repeats
            what just happened is a question about whether it did. */}
        <div className={styles.actionsCentred}>
          <Button
            label={formatMessage({
              id: "support.pin.close",
              defaultMessage: "Not now",
            })}
            onClick={onClose}
          />
        </div>
      </div>
    </section>
  );
}

/** What is left after the gate is dismissed: the door, and the handle. */
function SupportLocked({
  setupRequired,
  onOpen,
}: {
  readonly setupRequired: boolean;
  readonly onOpen: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  return (
    <section className={styles.section}>
      <div className={styles.centred}>
        <Icon name="lock" size={26} />
        <p className={styles.centredText}>
          <FormattedMessage
            id="support.my.lockedIntro"
            defaultMessage="Support is for the grown-up who owns this account."
          />
        </p>
        <Button
          label={
            setupRequired
              ? formatMessage({
                  id: "support.locked.setupCta",
                  defaultMessage: "Set up a PIN",
                })
              : formatMessage({
                  id: "support.locked.cta",
                  defaultMessage: "Enter the grown-up PIN",
                })
          }
          onClick={onOpen}
        />
      </div>
    </section>
  );
}

/**
 * The PIN went stale mid-sentence.
 *
 * An overlay rather than a replacement: the composing view stays mounted
 * behind it, so what has been typed is still there afterwards — including
 * the part written since the last save, which is the bit a server-side
 * draft alone cannot promise.
 */
function PinLapseOverlay({
  length,
  onPass,
}: {
  readonly length: number | null;
  readonly onPass: () => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // See ParentPinGate.submit: the value has to travel with the call.
  const submit = (candidate: string = pin) => {
    if (busy) {
      return;
    }
    setBusy(true);
    setErr(null);
    void SupportService.verifyParentPin(candidate)
      .then(onPass)
      .catch(() => {
        setPin("");
        setErr(
          formatMessage({
            id: "support.pin.wrong",
            defaultMessage: "That PIN is not right.",
          }),
        );
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className={styles.lapseOverlay} role="dialog" aria-modal="true">
      <div className={styles.lapseCard}>
        <Icon name="lock" size={24} />
        <p className={styles.centredText}>
          <FormattedMessage
            id="support.pin.lapsed"
            defaultMessage="The grown-up PIN needs entering again. {saved} — it’ll be right where you left it."
            values={{
              saved: (
                <b>
                  <FormattedMessage
                    id="support.pin.lapsedSaved"
                    defaultMessage="Your message is saved"
                  />
                </b>
              ),
            }}
          />
        </p>
        <PinField
          value={pin}
          length={length}
          onChange={setPin}
          onComplete={(value) => submit(value)}
          disabled={busy}
        />
        {err != null && <p className={styles.pinError}>{err}</p>}
      </div>
    </div>
  );
}
