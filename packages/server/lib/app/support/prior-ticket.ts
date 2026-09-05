// Picking up where an earlier conversation left off.
//
// A resolved ticket cannot be reopened, and three places in the app tell
// people what to do instead: quote the old number in a new message and the
// history comes with it. This is the half that keeps that promise.
//
// The reference is typed by a person, not carried by a link, and that is a
// deliberate choice rather than a shortcut: a link would have to be minted,
// stored and expired, and the number is already printed at the top of every
// thread and in every email about it. What it costs is that anyone can type
// any number — so the ownership check below is not a nicety, it is the whole
// security model.

import { SupportMessage, SupportTicket } from "@keylearn/database";

/**
 * How many prior tickets one message may pull in.
 *
 * Someone pasting an old email footer can easily quote three or four
 * numbers, and each one costs two queries and a slice of the agent's
 * context. The first two are almost always the ones they meant.
 */
const MAX_PRIOR = 2;

/**
 * How much of the earlier conversation travels.
 *
 * Enough for the agent to know what was tried and how it ended; not the
 * transcript. A previous ticket is context for the new question, and an
 * agent handed two full conversations tends to answer the older one.
 */
const MAX_SUMMARY_CHARS = 700;

/** What crosses the bridge about an earlier conversation. */
export type PriorTicket = {
  readonly reference: string;
  readonly subject: string;
  readonly status: string;
  readonly closedAt: string | null;
  /** What was asked and what was done, in the desk's own words. */
  readonly summary: string;
};

/**
 * Every reference typed into a message, in the order they appear.
 *
 * Case-insensitive because people retype these from paper and from memory,
 * and `key0000080` is unambiguously the same ticket. The digits are fixed at
 * seven to match `reference()`; a longer run of digits is not a reference
 * with extra characters, it is a different string, so the boundary assertion
 * rejects it rather than silently truncating.
 */
export function findReferences(text: string): readonly number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const m of text.matchAll(/\bKEY(\d{7})(?!\d)/gi)) {
    const id = Number(m[1]);
    // KEY0000000 is not a ticket. Ids start at 1.
    if (id > 0 && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * The earlier conversations this person is entitled to bring with them.
 *
 * **The ownership check is the point of this function.** A reference is a
 * short, sequential, guessable string — `KEY0000079` is one keystroke from
 * `KEY0000080` — so a quoted number proves nothing about who typed it.
 * Without this, quoting a stranger's number would hand their subject line,
 * their status and a summary of their support conversation to the agent, and
 * from there into a reply.
 *
 * Signed-in accounts are matched on `userId`, which is the strong check.
 * Guests are matched on the email the new ticket was submitted with, which
 * is weaker — an address is not a secret — but it is the same standard the
 * guest thread view already applies, and a guest has no account to match on.
 * A ticket with neither is never returned to anybody.
 *
 * An unmatched reference is silently ignored: telling somebody "that ticket
 * exists but is not yours" is itself the disclosure being prevented.
 */
export async function priorTicketsFor({
  text,
  userId,
  email,
  excludeId,
}: {
  readonly text: string;
  readonly userId: number | null;
  readonly email: string;
  readonly excludeId?: number;
}): Promise<readonly PriorTicket[]> {
  const ids = findReferences(text).filter((id) => id !== excludeId);
  if (ids.length === 0) {
    return [];
  }
  const out: PriorTicket[] = [];
  for (const id of ids.slice(0, MAX_PRIOR)) {
    const ticket = await SupportTicket.findById(id);
    if (ticket == null) {
      continue;
    }
    const mine =
      userId != null
        ? ticket.userId === userId
        : ticket.userId == null &&
          (ticket.email ?? "").toLowerCase() === email.toLowerCase();
    if (!mine) {
      continue;
    }
    // Spam is never handed back as context. A blocked sender quoting their
    // own blocked ticket would otherwise get its contents replayed into a
    // fresh conversation the filter has not seen yet.
    if (ticket.status === "spam" || ticket.status === "holding") {
      continue;
    }
    out.push({
      reference: `KEY${String(id).padStart(7, "0")}`,
      subject: ticket.subject ?? "",
      status: ticket.status ?? "",
      closedAt:
        ticket.closedAt != null
          ? new Date(ticket.closedAt).toISOString()
          : null,
      summary: await summarise(ticket),
    });
  }
  return out;
}

/**
 * What happened, in the conversation's own words.
 *
 * Extractive rather than generated: this runs on the request path of a
 * ticket submission, and a model call here would put a support form behind a
 * provider's latency and availability. The desk has an agent of its own that
 * can read this and do better with it; what this has to get right is that
 * the words are true.
 *
 * The shape is the opening question plus the last thing the desk actually
 * said, which is what "what was done about it" almost always means. System
 * lines are excluded — "Marked as sorted." tells the agent nothing it does
 * not already learn from the status.
 */
async function summarise(ticket: SupportTicket): Promise<string> {
  const messages = await SupportMessage.query()
    .where("ticketId", ticket.id!)
    .orderBy("id", "asc");
  const asked = (ticket.message ?? "").trim();
  const answers = messages.filter(
    (m) =>
      (m.sender === "us" || m.sender === "agent") &&
      m.kind !== "crisis" &&
      (m.body ?? "").trim() !== "",
  );
  const last = answers.at(-1)?.body?.trim() ?? "";
  const parts: string[] = [];
  if (asked !== "") {
    parts.push(`They asked: ${clip(asked, 260)}`);
  }
  if (last !== "") {
    parts.push(
      `The desk's last reply: ${clip(last, 320)}`,
      `Replies from the desk: ${answers.length}.`,
    );
  } else {
    parts.push("Nobody from the desk replied.");
  }
  return clip(parts.join(" "), MAX_SUMMARY_CHARS);
}

/** Cut at a word boundary where there is one, so a summary never ends mid-word. */
function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) {
    return flat;
  }
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`;
}
