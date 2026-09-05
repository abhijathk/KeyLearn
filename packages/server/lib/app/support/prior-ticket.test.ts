import { test } from "node:test";
import { SupportMessage, SupportTicket, User } from "@keylearn/database";
import { deepEqual, equal } from "rich-assert";
import { TestContext } from "../test/context.ts";
import { findReferences, priorTicketsFor } from "./prior-ticket.ts";

/**
 * A reference is short, sequential and printed on every thread, so anyone
 * can type anyone's. The ownership check is therefore not a refinement of
 * this feature — it is the feature's entire security model, and these tests
 * exist mostly to hold it.
 */

// Binds the models to a knex instance; the queries below need it even
// though nothing here resolves a controller out of the container.
const context = new TestContext();
void context;

test("references are found only in the exact printed shape", () => {
  deepEqual([...findReferences("about KEY0000080 thanks")], [80]);
  // Retyped from memory or from paper.
  deepEqual([...findReferences("about key0000080")], [80]);
  // Same number twice is one ticket, not two lookups.
  deepEqual([...findReferences("KEY0000080 KEY0000080")], [80]);
  // Not a reference with extra characters — a different string entirely.
  deepEqual([...findReferences("KEY00000801")], []);
  deepEqual([...findReferences("KEY000080")], []);
  deepEqual([...findReferences("MONKEY0000080")], []);
  // Ids start at 1.
  deepEqual([...findReferences("KEY0000000")], []);
});

async function seed() {
  await SupportMessage.query().delete();
  await SupportTicket.query().delete();
  await User.query().delete();

  const mine = await User.query().insertAndFetch({
    email: "mine@example.com",
    name: "Mine",
  } as any);
  const theirs = await User.query().insertAndFetch({
    email: "theirs@example.com",
    name: "Theirs",
  } as any);

  const make = async (
    userId: number | null,
    email: string,
    subject: string,
  ) => {
    const { ticket } = await SupportTicket.create({
      userId,
      kind: "support",
      name: "Someone",
      email,
      subject,
      message: `The original question about ${subject}.`,
    });
    await SupportMessage.create({
      ticketId: ticket.id!,
      sender: "agent",
      body: `We changed the setting for ${subject} and it should be fine now.`,
    });
    await ticket.setStatus("closed");
    return ticket.id!;
  };

  return {
    mine,
    theirs,
    ownTicket: await make(mine.id!, "mine@example.com", "my thing"),
    otherTicket: await make(theirs.id!, "theirs@example.com", "their thing"),
    guestTicket: await make(null, "guest@example.com", "guest thing"),
  };
}

const ref = (id: number) => `KEY${String(id).padStart(7, "0")}`;

test("a signed-in account gets its own quoted ticket back", async () => {
  const { mine, ownTicket } = await seed();
  const got = await priorTicketsFor({
    text: `following up on ${ref(ownTicket)}`,
    userId: mine.id!,
    email: "mine@example.com",
  });
  equal(got.length, 1);
  equal(got[0].reference, ref(ownTicket));
  equal(got[0].status, "closed");
  // The summary carries what was asked and what was done, not the transcript.
  equal(got[0].summary.includes("They asked"), true);
  equal(got[0].summary.includes("The desk's last reply"), true);
});

test("quoting somebody else's number returns nothing at all", async () => {
  const { mine, otherTicket } = await seed();
  const got = await priorTicketsFor({
    text: `about ${ref(otherTicket)}`,
    userId: mine.id!,
    email: "mine@example.com",
  });
  // Not an error, not a partial record — nothing. Saying "that exists but
  // is not yours" would itself be the disclosure this prevents.
  equal(got.length, 0);
});

test("a signed-in account cannot reach a guest ticket by address", async () => {
  const { mine, guestTicket } = await seed();
  const got = await priorTicketsFor({
    text: ref(guestTicket),
    userId: mine.id!,
    email: "guest@example.com",
  });
  equal(got.length, 0);
});

test("a guest is matched on the address they filed with, case-insensitively", async () => {
  const { guestTicket } = await seed();
  const ok = await priorTicketsFor({
    text: ref(guestTicket),
    userId: null,
    email: "GUEST@example.com",
  });
  equal(ok.length, 1);

  const wrong = await priorTicketsFor({
    text: ref(guestTicket),
    userId: null,
    email: "somebody-else@example.com",
  });
  equal(wrong.length, 0);
});

test("spam is never handed back as context", async () => {
  const { mine, ownTicket } = await seed();
  const ticket = (await SupportTicket.query().findById(ownTicket))!;
  await ticket.setStatus("spam");
  const got = await priorTicketsFor({
    text: ref(ownTicket),
    userId: mine.id!,
    email: "mine@example.com",
  });
  equal(got.length, 0);
});

test("the ticket doing the quoting is never its own prior ticket", async () => {
  const { mine, ownTicket } = await seed();
  const got = await priorTicketsFor({
    text: ref(ownTicket),
    userId: mine.id!,
    email: "mine@example.com",
    excludeId: ownTicket,
  });
  equal(got.length, 0);
});

test("an unknown number is ignored rather than raised", async () => {
  const { mine } = await seed();
  const got = await priorTicketsFor({
    text: "about KEY9999999",
    userId: mine.id!,
    email: "mine@example.com",
  });
  equal(got.length, 0);
});
