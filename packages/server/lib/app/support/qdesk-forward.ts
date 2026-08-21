import { Env } from "@keylearn/config";
import { SupportAttachment, SupportMessage } from "@keylearn/database";
import { reference } from "./my-controller.ts";

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

function config(): { url: string; key: string } | null {
  const url = Env.getString("QDESK_URL", "");
  const key = Env.getString("QDESK_APP_KEY", "");
  return url !== "" && key !== "" ? { url, key } : null;
}

export function qdeskConfigured(): boolean {
  return config() != null;
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
  cfg: { url: string; key: string } | null = config(),
): Promise<unknown | null> {
  if (cfg == null) {
    return null;
  }
  try {
    const res = await fetch(new URL(path, cfg.url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-qdesk-app-key": cfg.key,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`qdesk-forward: ${path} -> ${res.status}`);
      return null;
    }
    // Always an object on success, so a caller can read "this landed"
    // off a non-null result — a 200 with an empty body is still a
    // delivery, and the ticks depend on telling those apart.
    return (await res.json().catch(() => ({}))) as unknown;
  } catch (err) {
    console.error(`qdesk-forward: ${path} failed`, err);
    return null;
  }
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
async function landCrisisReply(
  ticketId: number,
  result: unknown,
): Promise<void> {
  const reply = (result as { crisisReply?: string | null } | null)?.crisisReply;
  if (reply == null || reply === "") {
    return;
  }
  try {
    await SupportMessage.create({
      ticketId,
      sender: "agent",
      kind: "crisis",
      body: reply,
    });
  } catch (err) {
    console.error("qdesk-forward: could not record the crisis reply", err);
  }
}

export function forwardTicketToQdesk(ticket: {
  readonly id: number;
  readonly kind: "support" | "business";
  readonly name: string;
  readonly email: string;
  readonly subject: string;
  readonly message: string;
  readonly userId: number | null;
  /** The row the opening message was written to, for its second tick. */
  readonly messageId?: number | null;
}): void {
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
        },
        cfg,
      ),
    )
    .then((result) => {
      void landCrisisReply(ticket.id, result);
      if (result != null && ticket.messageId != null) {
        void SupportMessage.markDelivered(ticket.messageId);
      }
    });
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
export function forwardCsatToQdesk(
  ticketId: number,
  rating: number,
  note: string | null,
): void {
  void post(`/_/apps/tickets/${ticketId}/csat`, { rating, note });
}

/**
 * The person deleted it from their side.
 *
 * Not a deletion on the desk's side: the conversation is a record of what
 * staff were told and what they answered. It leaves the queue and stays
 * in the archive.
 */
export function forwardArchiveToQdesk(ticketId: number): void {
  void post(`/_/apps/tickets/${ticketId}/archive`, {
    reason: "deleted-by-user",
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
  }).catch(() => {});
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
    });
    if (!res.ok) {
      throw new Error(`status ${res.status}`);
    }
    const articles = (await res.json()) as HelpArticle[];
    cache = { at: Date.now(), articles };
    return articles;
  } catch (err) {
    console.error("qdesk help articles failed", err);
    return cache?.articles ?? [];
  }
}
