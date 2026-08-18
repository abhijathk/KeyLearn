import { Env } from "@keylearn/config";

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

async function post(path: string, body: unknown): Promise<void> {
  const cfg = config();
  if (cfg == null) {
    return;
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
    }
  } catch (err) {
    console.error(`qdesk-forward: ${path} failed`, err);
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
}): void {
  void post("/_/apps/tickets", {
    externalId: String(ticket.id),
    kind: ticket.kind,
    name: ticket.name,
    email: ticket.email,
    subject: ticket.subject,
    message: ticket.message,
    keylearnUserId: ticket.userId,
  });
}

export function forwardReplyToQdesk(ticketId: number, body: string): void {
  void post(`/_/apps/tickets/${ticketId}/messages`, { body });
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
