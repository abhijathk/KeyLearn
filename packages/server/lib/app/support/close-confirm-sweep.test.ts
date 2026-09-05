import { test } from "node:test";
import {
  Notification,
  SupportMessage,
  SupportTicket,
  User,
} from "@keylearn/database";
import { setSiteConfigValues } from "@keylearn/site-config";
import { equal } from "rich-assert";
import { TestContext } from "../test/context.ts";
import { CloseConfirmSweep } from "./sweep.ts";

/**
 * The sweep that answers "is this sorted?" on a silent learner's behalf.
 *
 * What is worth testing here is not that a timer fires — it is the two
 * decisions that have consequences: closing a conversation nobody agreed to
 * close, and how often somebody is nudged about it. Both are cheap to get
 * subtly wrong (off-by-one on the window, a reminder that fires on every
 * pass), and both are invisible in production until a learner complains.
 */

const context = new TestContext();
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

async function seed({
  askedAgo,
  remindedAgo = null,
  status = "open",
}: {
  readonly askedAgo: number;
  readonly remindedAgo?: number | null;
  readonly status?: string;
}) {
  await Notification.query().delete();
  await SupportMessage.query().delete();
  await SupportTicket.query().delete();
  await User.query().delete();
  const user = await User.query().insertAndFetch({
    email: "learner@example.com",
    name: "Learner",
  } as any);
  const { ticket } = await SupportTicket.create({
    userId: user.id!,
    kind: "support",
    name: "Learner",
    email: "learner@example.com",
    subject: "Something",
    message: "Something is not working",
  });
  const now = Date.now();
  await SupportTicket.query()
    .findById(ticket.id!)
    .patch({
      status,
      closeRequestedAt: new Date(now - askedAgo),
      closeRemindedAt: remindedAgo == null ? null : new Date(now - remindedAgo),
    } as any);
  return { user, ticketId: ticket.id! };
}

async function reload(id: number): Promise<SupportTicket> {
  return (await SupportTicket.query().findById(id))!;
}

test("inside the window, nobody is closed and the nudge is at most daily", async () => {
  setSiteConfigValues(new Map([["ops.closeConfirmDays", 3]]));
  // Asked 25 hours ago, never nudged: one reminder is due.
  const { ticketId } = await seed({ askedAgo: 25 * HOUR });
  const first = await context.get(CloseConfirmSweep).runOnce();
  equal(first.closed, 0);
  equal(first.reminded, 1);
  equal((await reload(ticketId)).status, "open");

  // The sweep runs every four hours. Running it again immediately must not
  // produce a second reminder — this is the whole point of closeRemindedAt,
  // and without it a learner gets six notifications a day.
  const second = await context.get(CloseConfirmSweep).runOnce();
  equal(second.closed, 0);
  equal(second.reminded, 0);
});

test("a ticket asked about moments ago is not nudged at all", async () => {
  setSiteConfigValues(new Map([["ops.closeConfirmDays", 3]]));
  await seed({ askedAgo: 2 * HOUR });
  const result = await context.get(CloseConfirmSweep).runOnce();
  equal(result.closed, 0);
  // The question is already in the thread and on the bell; chasing it two
  // hours later would be nagging, not reminding.
  equal(result.reminded, 0);
});

test("past the window it closes, says so in the thread, and notifies", async () => {
  setSiteConfigValues(new Map([["ops.closeConfirmDays", 3]]));
  const { ticketId } = await seed({ askedAgo: 3 * DAY + HOUR });
  const result = await context.get(CloseConfirmSweep).runOnce();
  equal(result.closed, 1);

  const ticket = await reload(ticketId);
  equal(ticket.status, "closed");
  // The request is cleared by the transition, so a second pass cannot close
  // it again or notify about it again.
  equal(ticket.closeRequestedAt ?? null, null);

  const messages = await SupportMessage.query().where("ticketId", ticketId);
  equal(messages.filter((m) => m.sender === "system").length, 1);

  const notes = await Notification.query();
  equal(notes.length, 1);
  equal(notes[0].kind, "ticket-auto-closed");

  const again = await context.get(CloseConfirmSweep).runOnce();
  equal(again.closed, 0);
  equal(again.reminded, 0);
});

test("the window is the site setting, not a constant", async () => {
  // The same ticket, four days old. Closed under a three-day window, left
  // alone under a seven-day one — which is what makes ops.closeConfirmDays
  // a real control rather than decoration.
  setSiteConfigValues(new Map([["ops.closeConfirmDays", 7]]));
  const { ticketId } = await seed({ askedAgo: 4 * DAY });
  equal((await context.get(CloseConfirmSweep).runOnce()).closed, 0);
  equal((await reload(ticketId)).status, "open");

  setSiteConfigValues(new Map([["ops.closeConfirmDays", 3]]));
  equal((await context.get(CloseConfirmSweep).runOnce()).closed, 1);
  equal((await reload(ticketId)).status, "closed");
});

test("a ticket that has moved on is never closed by this sweep", async () => {
  setSiteConfigValues(new Map([["ops.closeConfirmDays", 3]]));
  // Already spam. The status guard is belt-and-braces — setStatus clears the
  // request — but this sweep closes conversations, and the cost of trusting
  // an invariant that later stops holding is somebody's live thread.
  await seed({ askedAgo: 10 * DAY, status: "spam" });
  const result = await context.get(CloseConfirmSweep).runOnce();
  equal(result.closed, 0);
  equal(result.reminded, 0);
});
