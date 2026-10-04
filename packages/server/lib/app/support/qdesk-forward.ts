import { Env } from "@keylearn/config";
import { SupportAttachment, SupportMessage } from "@keylearn/database";
import { reference } from "./my-controller.ts";
import { type PriorTicket } from "./prior-ticket.ts";
import { enqueueForward } from "./qdesk-outbox.ts";

/**
 * Forwarding bridge to QDesk, the ops app — plain HTTP against its
 * app-key API, nothing more. QDesk is the system of record for support
 * conversations now; this module is how a ticket born on this side (the
 * public /support form, a guest thread reply) reaches it. Fire-and-forget
 * by design: QDesk being down must never fail a customer's submission,
 * and this repo's own ticket tables remain a complete fallback record —
 * a missed forward means QDesk is behind, not that data is lost.
 *
 * Unconfigured (no QDESK_URL/QDESK_APP_KEY) means the bridge is off and
 * this repo's own automation (#tryAutoReply) keeps working standalone —
 * configured means QDesk's agent owns automation and the local
 * auto-reply steps aside (see the call sites in controller.ts).
 */

export type DeskConfig = { readonly url: string; readonly key: string };

function config(): DeskConfig | null {
  const url = Env.getString("QDESK_URL", "");
  const key = Env.getString("QDESK_APP_KEY", "");
  return url !== "" && key !== "" ? { url, key } : null;
}

/** The bridge configuration in force right now, or null when it is off. */
export function deskConfig(): DeskConfig | null {
  return config();
}

export function qdeskConfigured(): boolean {
  return config() != null;
}

/**
 * Every request to the desk carries the app key, so none of them may follow
 * a redirect: a 30x from a compromised or misconfigured desk (or anything
 * sitting in front of it) would otherwise replay `x-qdesk-app-key` to
 * whatever host it names. `redirect: "error"` turns that into a failed
 * request, which every caller here already treats as "the desk is down".
 */
const NO_REDIRECT = { redirect: "error" } as const;

/** Default bound on any desk call that does not state its own. */
const DESK_TIMEOUT_MS = 15_000;

/**
 * When the desk last asked us to back off (429/503 with Retry-After), and
 * until when. The retry sweep and the outbox drain read it so a backlog
 * does not keep hammering a desk that has said it is overloaded.
 */
let deskPausedUntil = 0;

export function deskBackoffUntil(): number {
  return deskPausedUntil;
}

/** For tests only. */
export function resetDeskBackoff(): void {
  deskPausedUntil = 0;
}

/** Milliseconds from a Retry-After header (seconds or an HTTP date), or null. */
export function parseRetryAfter(
  value: string | null,
  now: number = Date.now(),
): number | null {
  if (value == null || value.trim() === "") {
    return null;
  }
  const v = value.trim();
  if (/^\d+$/.test(v)) {
    return Number(v) * 1000;
  }
  const at = Date.parse(v);
  return Number.isFinite(at) ? Math.max(0, at - now) : null;
}

/** What a send to the desk came back with — status 0 for no answer at all. */
export type DeskSendResult = {
  readonly ok: boolean;
  readonly status: number;
  readonly retryAfterMs: number | null;
  readonly body: unknown;
};

/**
 * One POST to the desk, with the outcome described rather than collapsed to
 * null — the outbox needs the status to decide whether to retry.
 */
export async function sendToDesk(
  path: string,
  body: unknown,
  cfg: DeskConfig,
  headers: Record<string, string> = {},
): Promise<DeskSendResult> {
  try {
    const res = await fetch(new URL(path, cfg.url), {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
        "x-qdesk-app-key": cfg.key,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
      ...NO_REDIRECT,
    });
    const retryAfterMs = parseRetryAfter(res.headers.get("retry-after"));
    if ((res.status === 429 || res.status === 503) && retryAfterMs != null) {
      // Capped: a desk asking for a day of silence is more likely broken
      // than busy, and the give-up window is the real backstop.
      deskPausedUntil = Math.max(
        deskPausedUntil,
        Date.now() + Math.min(retryAfterMs, 60 * 60 * 1000),
      );
    }
    if (!res.ok) {
      console.error(`qdesk-forward: ${path} -> ${res.status}`);
      await res.body?.cancel().catch(() => {});
      return { ok: false, status: res.status, retryAfterMs, body: null };
    }
    // Always an object on success, so a caller can read "this landed"
    // off a non-null result — a 200 with an empty body is still a
    // delivery, and the ticks depend on telling those apart.
    const json = (await res.json().catch(() => ({}))) as unknown;
    return { ok: true, status: res.status, retryAfterMs, body: json };
  } catch (err) {
    console.error(`qdesk-forward: ${path} failed`, err);
    return { ok: false, status: 0, retryAfterMs: null, body: null };
  }
}

/**
 * `cfg` is passed in by any caller that awaits something before posting.
 *
 * This function used to read the configuration itself, which was safe
 * while every caller invoked it synchronously. Once forwarding began
 * loading a message's attachments first, the read moved to *after* an
 * await — so a forward no longer necessarily used the configuration that
 * was in force when the message was sent. Snapshotting it at call time
 * restores that, and is the honest behaviour besides: the send decided
 * where it was going, not a database round-trip later.
 */
async function post(
  path: string,
  body: unknown,
  cfg: DeskConfig | null = config(),
): Promise<unknown | null> {
  if (cfg == null) {
    return null;
  }
  const result = await sendToDesk(path, body, cfg);
  return result.ok ? result.body : null;
}

/**
 * The §6.7 emergency redirect, when the message that was just forwarded
 * tripped the crisis detector.
 *
 * The desk returns this in the response rather than delivering it later,
 * because it carries an emergency number and a polling interval is not an
 * acceptable delivery schedule for one. Written straight into the thread
 * as a `crisis` message, which the account section renders as an alert
 * rather than a chat bubble — nothing about this should look like the
 * assistant making conversation.
 */
/** Seconds between crisis chunks — read-then-act pacing, not typing theater. */
const CRISIS_CHUNK_GAP_MS = 3_000;

async function landCrisisReply(
  ticketId: number,
  result: unknown,
): Promise<void> {
  const payload = result as {
    crisisReply?: string | null;
    crisisChunks?: readonly string[] | null;
    crisisQuiet?: boolean;
  } | null;
  // Chunked delivery (owner directive): the FIRST chunk carries the
  // number and lands immediately — nothing else has to be read to act.
  // The remaining chunks arrive a few seconds apart while the person
  // dials: steadying words, what the operator will do, the honest AI
  // disclaimers. A desk old enough to send only the single block still
  // works — it lands whole.
  const chunks =
    payload?.crisisChunks != null && payload.crisisChunks.length > 0
      ? payload.crisisChunks
      : payload?.crisisReply != null && payload.crisisReply !== ""
        ? [payload.crisisReply]
        : [];
  if (chunks.length === 0) {
    return;
  }
  // Covert danger renders as an ORDINARY bubble on the customer's screen —
  // "crisis-quiet" is stored for the record, and the thread UI deliberately
  // has no special styling for it: to anyone glancing at the screen this
  // is a support chat about nothing in particular.
  const kind = payload?.crisisQuiet === true ? "crisis-quiet" : "crisis";
  try {
    await SupportMessage.create({
      ticketId,
      sender: "agent",
      kind,
      body: chunks[0]!,
    });
  } catch (err) {
    console.error("qdesk-forward: could not record the crisis reply", err);
    return;
  }
  // The rest are best-effort and paced. Deliberately NOT awaited — the
  // customer's own request must not wait nine seconds for follow-up
  // paragraphs, and a failure here can never claw back chunk one.
  for (let i = 1; i < chunks.length; i++) {
    const body = chunks[i]!;
    setTimeout(() => {
      void SupportMessage.create({
        ticketId,
        sender: "agent",
        kind,
        body,
      }).catch((err) =>
        console.error("qdesk-forward: crisis chunk failed", err),
      );
    }, i * CRISIS_CHUNK_GAP_MS);
  }
}

export function forwardTicketToQdesk(
  ticket: {
    readonly id: number;
    readonly kind: "support" | "business";
    readonly name: string;
    readonly email: string;
    readonly subject: string;
    readonly message: string;
    readonly userId: number | null;
    /** The row the opening message was written to, for its second tick. */
    readonly messageId?: number | null;
    /** ISO 3166-1 alpha-2 from the edge (cf-ipcountry) — network truth, not a preference. */
    readonly country?: string | null;
    /** The browser's own IANA zone. */
    readonly timeZone?: string | null;
    /**
     * Earlier conversations this person quoted the number of, and owns.
     *
     * Already ownership-checked by the time it reaches here — see
     * `priorTicketsFor`. Optional so a desk build that does not read it, and
     * a caller that has not resolved any, both behave as before.
     */
    readonly priorTickets?: readonly PriorTicket[];
  },
  /**
   * Told the desk's own id for the ticket once it lands, or null when it did
   * not (bridge off, desk down — the retry sweep delivers it later). For a
   * caller whose next step needs the desk's address for the ticket.
   */
  onLanded?: (deskTicketId: number | null) => void,
): void {
  const cfg = config();
  void attachmentsFor(ticket.messageId)
    .then((attachments) =>
      post(
        "/_/apps/tickets",
        {
          attachments,
          externalId: String(ticket.id),
          // The number this ticket's own customer is shown and will quote back.
          // Sent rather than derived on the desk's side, because the format
          // belongs to this app — the desk should not have to know it.
          reference: reference(ticket.id),
          kind: ticket.kind,
          name: ticket.name,
          email: ticket.email,
          subject: ticket.subject,
          message: ticket.message,
          keylearnUserId: ticket.userId,
          country: ticket.country ?? null,
          timeZone: ticket.timeZone ?? null,
          // Only sent when there is something to send: an empty array on
          // every ordinary ticket is noise in the desk's logs and one more
          // thing for its schema to have an opinion about.
          ...(ticket.priorTickets != null && ticket.priorTickets.length > 0
            ? { priorTickets: ticket.priorTickets }
            : {}),
        },
        cfg,
      ),
    )
    .then((result) => {
      void landCrisisReply(ticket.id, result);
      if (result != null && ticket.messageId != null) {
        void SupportMessage.markDelivered(ticket.messageId);
      }
      const deskId = (result as { ticketId?: unknown } | null)?.ticketId;
      onLanded?.(typeof deskId === "number" ? deskId : null);
    });
}

/**
 * A page on the desk, for links in mail to staff. The desk is QDesk now, on
 * its own origin; KeyLearn's old `/desk` pages are gone, so a link built on
 * this app's own origin is a 404. Null when no desk is configured.
 */
export function deskPageUrl(path: string): string | null {
  const url = Env.getString("QDESK_URL", "");
  return url === "" ? null : String(new URL(path, url));
}

/**
 * What a message brought with it, described rather than copied.
 *
 * The desk gets the name, type, size and this app's own id — enough to
 * list the file and decide how to show it — and fetches the bytes over
 * the ops API only when a staff member actually opens one.
 */
async function attachmentsFor(
  messageId: number | null | undefined,
): Promise<
  { externalId: string; fileName: string; mimeType: string; size: number }[]
> {
  if (messageId == null) {
    return [];
  }
  try {
    const rows = await SupportAttachment.query().where("messageId", messageId);
    return rows.map((a) => ({
      externalId: String(a.id!),
      fileName: a.fileName!,
      mimeType: a.mimeType!,
      size: a.size!,
    }));
  } catch (err) {
    // A ticket that reaches the desk without its attachments listed is
    // far better than one that does not reach it at all.
    console.error("qdesk-forward: could not read attachments", err);
    return [];
  }
}

export function forwardReplyToQdesk(
  ticketId: number,
  body: string,
  messageId?: number | null,
): void {
  // Read now, used later — see `post`.
  const cfg = config();
  void attachmentsFor(messageId)
    .then((attachments) =>
      post(
        `/_/apps/tickets/${ticketId}/messages`,
        {
          body,
          // The desk is idempotent on this, which is what makes the retry
          // sweep safe: a delivery that landed but whose answer was lost is
          // recognised rather than posted a second time.
          externalMessageId: messageId == null ? null : String(messageId),
          attachments,
        },
        cfg,
      ),
    )
    .then((result) => {
      void landCrisisReply(ticketId, result);
      // Null means the bridge is off or the desk did not take it. Either
      // way the message stays on one tick, which is the truth.
      if (result != null && messageId != null) {
        void SupportMessage.markDelivered(messageId);
      }
    });
}

/**
 * How it went, in the person's own words and one number.
 *
 * Sent rather than kept because the rating is only worth collecting if
 * the people who answered the ticket ever see it — the desk widget is
 * where that happens.
 */
/**
 * The customer's thumbs on ONE desk reply — forwarded so it lands on the
 * exact message in the desk's own thread. `qdeskMessageId` is the desk's
 * id, carried in on the delivery leg and stored on the local message row.
 */
//
// The four forwards below used to be `void post(...)`: one attempt, and a
// desk that was down, restarting or rate-limiting at that moment lost the
// rating, the thumbs, the resolution or the archive for good. They now go
// through the durable outbox (qdesk-outbox.ts) — a row written first, sent
// at once, and retried with backoff by the sweep. Each keeps its
// fire-and-forget signature: the customer's click never waits on the desk.
//
// The dedupe key makes the latest word win: a second rating, or "sorted"
// followed by "not really", replaces the one still waiting rather than
// queueing behind it, so a retry can never land an out-of-date value last.
export function forwardFeedbackToQdesk(
  ticketId: number,
  qdeskMessageId: number,
  rating: "good" | "bad",
): void {
  enqueueForward({
    kind: "feedback",
    ticketId,
    path: `/_/apps/tickets/${ticketId}/messages/${qdeskMessageId}/feedback`,
    body: { rating },
    dedupeKey: `feedback:${ticketId}:${qdeskMessageId}`,
  });
}

export function forwardCsatToQdesk(
  ticketId: number,
  rating: number,
  note: string | null,
): void {
  enqueueForward({
    kind: "csat",
    ticketId,
    path: `/_/apps/tickets/${ticketId}/csat`,
    body: { rating, note },
    dedupeKey: `csat:${ticketId}`,
  });
}

/**
 * The person deleted it from their side.
 *
 * Not a deletion on the desk's side: the conversation is a record of what
 * staff were told and what they answered. It leaves the queue and stays
 * in the archive.
 */
export function forwardArchiveToQdesk(ticketId: number): void {
  enqueueForward({
    kind: "archive",
    ticketId,
    path: `/_/apps/tickets/${ticketId}/archive`,
    body: { reason: "deleted-by-user" },
    dedupeKey: `archive:${ticketId}`,
  });
}

/**
 * The customer said it is sorted — or changed their mind.
 *
 * Until this, "yes, that sorted it" closed the thread here and left the
 * desk's copy open: the queue counted work nobody was waiting on, and a
 * staffer could pick up a ticket the customer had finished with and answer
 * into silence. QDesk is the system of record for the conversation, so its
 * copy has to hear about a status the customer set on this side.
 *
 * Both directions travel, because closing on somebody's word is only safe
 * if their change of mind lands too — a one-way sync would leave a "not
 * really" stranded against a closed desk ticket.
 */
export function forwardResolutionToQdesk(
  ticketId: number,
  resolved: boolean,
): void {
  enqueueForward({
    kind: "resolution",
    ticketId,
    path: `/_/apps/tickets/${ticketId}/resolution`,
    body: { resolved },
    dedupeKey: `resolution:${ticketId}`,
  });
}

/**
 * Whether the desk is writing on this ticket right now.
 *
 * Asked rather than assumed: the "someone is answering" indicator used
 * to be switched on by the customer's own send, which told them a person
 * was there before anybody had opened the thread. Returns false whenever
 * the bridge is off or the desk does not answer — a missing indicator is
 * a small loss, a false one is a promise.
 */
export async function deskIsTyping(ticketId: number): Promise<boolean> {
  const cfg = config();
  if (cfg == null) {
    return false;
  }
  try {
    const res = await fetch(
      new URL(`/_/apps/tickets/${ticketId}/presence`, cfg.url),
      {
        headers: { "x-qdesk-app-key": cfg.key },
        signal: AbortSignal.timeout(4000),
        ...NO_REDIRECT,
      },
    );
    if (!res.ok) {
      return false;
    }
    const body = (await res.json()) as { typing?: boolean };
    return body.typing === true;
  } catch {
    return false;
  }
}

/**
 * "The customer is writing", passed to the desk.
 *
 * Fire-and-forget and deliberately thin: it says somebody was typing a
 * moment ago and nothing about what. A failure is silence, which is the
 * correct behaviour for an indicator — a missing one costs nothing, a
 * wrong one is a claim.
 */
export function tellDeskCustomerTyping(ticketId: number): void {
  const cfg = config();
  if (cfg == null) {
    return;
  }
  void fetch(new URL(`/_/apps/tickets/${ticketId}/typing`, cfg.url), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-qdesk-app-key": cfg.key,
    },
    body: "{}",
    signal: AbortSignal.timeout(3000),
    ...NO_REDIRECT,
  })
    .then((res) => res.body?.cancel())
    .catch(() => {});
}

/** One published help article, as the desk publishes it. */
export type HelpArticle = {
  readonly id: number;
  readonly title: string;
  readonly body: string;
  readonly updatedAt: string;
};

// The articles change when a staff member edits one — minutes matter,
// seconds don't. A short cache keeps a busy help page off the desk
// entirely, and means the desk being briefly unreachable doesn't empty
// the page for everyone.
const ARTICLE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; articles: readonly HelpArticle[] } | null = null;

/**
 * The desk's published knowledge base, for the customer-facing help
 * centre. Returns the last good answer if the desk is unreachable, and
 * an empty list if we've never had one — a help page with nothing on it
 * is a bad day; a help page that 500s is a worse one.
 */
export async function fetchHelpArticles(): Promise<readonly HelpArticle[]> {
  const cfg = config();
  if (cfg == null) {
    return [];
  }
  if (cache != null && Date.now() - cache.at < ARTICLE_TTL_MS) {
    return cache.articles;
  }
  try {
    const res = await fetch(new URL("/_/apps/answers", cfg.url), {
      headers: { "x-qdesk-app-key": cfg.key },
      signal: AbortSignal.timeout(10_000),
      ...NO_REDIRECT,
    });
    if (!res.ok) {
      throw new Error(`status ${res.status}`);
    }
    const articles = (await res.json()) as HelpArticle[];
    // A wrong shape is "not available", not a list — cached, it would reach
    // the help page's `.map` for five minutes.
    if (!Array.isArray(articles)) {
      throw new Error("expected a list");
    }
    cache = { at: Date.now(), articles };
    return articles;
  } catch (err) {
    console.error("qdesk help articles failed", err);
    return cache?.articles ?? [];
  }
}

/** One active notice as the desk publishes it. */
export type DeskNotice = {
  readonly id: number;
  readonly message: string;
  readonly kind: "incident" | "maintenance" | "feature";
  readonly display: "banner" | "window" | "poll" | "feedback";
  readonly audience?: string;
  readonly dismissible: boolean;
  /** A poll's two to four options (phase 3.1). */
  readonly options?: readonly string[] | null;
  /** Whether learners see the running result after answering. */
  readonly showResults?: boolean;
  /** Whether a feedback card asks for an optional comment (phase 3.2). */
  readonly askComment?: boolean;
  /** Bumped by the desk when an edit is meant to reach people who already closed the notice. */
  readonly revision?: number;
  readonly createdAt: string;
};

/** Forgets the cached feed, so a test (or a retracted card) is seen at once. */
export function resetDeskNoticeCache(): void {
  noticeCache = null;
}

/** One live desk notice by id, or null when it is not live right now. */
export async function fetchDeskNotice(id: number): Promise<DeskNotice | null> {
  return (await fetchDeskNotices()).find((n) => n.id === id) ?? null;
}

// Same shape and reasoning as the article cache above: an incident
// notice changing within a minute is fine, the desk being down must not
// empty the banner, and a poll-per-pageview must never reach the desk.
const NOTICE_TTL_MS = 60 * 1000;
let noticeCache: { at: number; notices: readonly DeskNotice[] } | null = null;

/**
 * The desk's active notices, folded into this app's own public notice
 * feed — an incident posted on the desk is about THIS product's
 * customers, and "we know, no need to write in" on the support form is
 * the cheapest ticket-flood prevention there is.
 */
export async function fetchDeskNotices(): Promise<readonly DeskNotice[]> {
  const cfg = config();
  if (cfg == null) {
    return [];
  }
  if (noticeCache != null && Date.now() - noticeCache.at < NOTICE_TTL_MS) {
    return noticeCache.notices;
  }
  try {
    const res = await fetch(new URL("/_/apps/notices", cfg.url), {
      headers: { "x-qdesk-app-key": cfg.key },
      signal: AbortSignal.timeout(5_000),
      ...NO_REDIRECT,
    });
    if (!res.ok) {
      throw new Error(`status ${res.status}`);
    }
    const body = (await res.json()) as { notices?: DeskNotice[] } | null;
    if (!Array.isArray(body?.notices)) {
      throw new Error("expected a notices list");
    }
    noticeCache = { at: Date.now(), notices: body.notices };
    return noticeCache.notices;
  } catch (err) {
    console.error("qdesk notices failed", err);
    return noticeCache?.notices ?? [];
  }
}

// Moves on the scale of days; ten minutes of staleness costs nothing.
const EXPECTED_REPLY_TTL_MS = 10 * 60 * 1000;
let expectedReplyCache: { at: number; medianMinutes: number | null } | null =
  null;

/**
 * How long the desk's first reply usually takes — the number behind the
 * thread view's "we usually reply within…" line. Null when the desk is
 * unreachable or has nothing measured, and the line simply doesn't show:
 * a made-up expectation is worse than none.
 */
export async function fetchExpectedReplyMinutes(): Promise<number | null> {
  const cfg = config();
  if (cfg == null) {
    return null;
  }
  if (
    expectedReplyCache != null &&
    Date.now() - expectedReplyCache.at < EXPECTED_REPLY_TTL_MS
  ) {
    return expectedReplyCache.medianMinutes;
  }
  try {
    const res = await fetch(new URL("/_/apps/expected-reply", cfg.url), {
      headers: { "x-qdesk-app-key": cfg.key },
      signal: AbortSignal.timeout(5_000),
      ...NO_REDIRECT,
    });
    if (!res.ok) {
      throw new Error(`status ${res.status}`);
    }
    const body = (await res.json()) as { medianMinutes?: number | null };
    expectedReplyCache = {
      at: Date.now(),
      medianMinutes: body.medianMinutes ?? null,
    };
    return expectedReplyCache.medianMinutes;
  } catch (err) {
    console.error("qdesk expected-reply failed", err);
    return expectedReplyCache?.medianMinutes ?? null;
  }
}

/**
 * The bytes of a file a staffer sent with a desk reply, fetched back from the
 * desk by its own id. Null on any failure: the reply still lands, and the
 * caller reports how many files did not.
 */
export async function fetchDeskAttachment(
  ticketId: number,
  attachmentId: number,
  maxBytes: number = SupportAttachment.MAX_BYTES,
): Promise<Buffer | null> {
  const cfg = config();
  if (cfg == null) {
    return null;
  }
  try {
    const res = await fetch(
      new URL(
        `/_/apps/tickets/${ticketId}/attachments/${attachmentId}`,
        cfg.url,
      ),
      {
        headers: { "x-qdesk-app-key": cfg.key },
        // Covers the body as well as the headers: the signal stays live
        // while the stream below is read.
        signal: AbortSignal.timeout(DESK_TIMEOUT_MS),
        ...NO_REDIRECT,
      },
    );
    if (!res.ok) {
      console.error(`qdesk attachment ${attachmentId} -> ${res.status}`);
      await res.body?.cancel().catch(() => {});
      return null;
    }
    return await readCapped(res, maxBytes, `qdesk attachment ${attachmentId}`);
  } catch (err) {
    console.error(`qdesk attachment ${attachmentId} failed`, err);
    return null;
  }
}

/**
 * The body, read in chunks and abandoned the moment it passes `maxBytes`.
 *
 * `arrayBuffer()` buffered the whole response before anything looked at
 * its size, so a desk (or whatever answered as one) could make this
 * process hold any amount of memory for a file that was then thrown away
 * for being over 10 MB. A declared length over the cap is refused before
 * a byte is read; an undeclared or understated one is cut off as it
 * streams.
 */
async function readCapped(
  res: Response,
  maxBytes: number,
  what: string,
): Promise<Buffer | null> {
  const declared = Number(res.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    console.error(`${what}: declared ${declared} bytes, over ${maxBytes}`);
    await res.body?.cancel().catch(() => {});
    return null;
  }
  if (res.body == null) {
    return Buffer.alloc(0);
  }
  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      console.error(`${what}: over ${maxBytes} bytes, abandoned`);
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}
