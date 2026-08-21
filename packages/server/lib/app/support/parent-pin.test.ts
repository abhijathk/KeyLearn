import { test } from "node:test";
import { Application } from "@fastr/core";
import { Profile } from "@keylearn/database";
import { equal } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";

/**
 * The support section is a grown-up's on a household that has a learner
 * profile.
 *
 * The page already refused to render for a *currently active* kid profile,
 * and that was worth having, but it was only ever a speed bump: it was
 * client-side, and it keyed on which profile happened to be selected. A
 * child who switched to the grown-up's profile — or anyone at all sending
 * the request directly — walked straight past it. These tests are about
 * the version that can't be talked past.
 */

const context = new TestContext();

const ticket = {
  kind: "support",
  name: "A Parent",
  email: "parent@example.com",
  subject: "Certificate will not download",
  message: "The completion certificate does nothing when I tap download.",
};

async function addKidProfile(userId: number): Promise<void> {
  await Profile.query().insert({
    userId,
    kind: "kid",
    firstName: "Learner",
  });
}

test("no kid profile: support is not gated", async () => {
  const user = await findUser("user1@keylearn.org");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  const response = await request.POST("/_/support/tickets").send(ticket);

  equal(response.status, 200);
});

test("kid profile and no PIN: asks for setup rather than a PIN", async () => {
  const user = await findUser("user1@keylearn.org");
  await addKidProfile(user.id!);
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  const response = await request.POST("/_/support/tickets").send(ticket);

  equal(response.status, 428);
  const body = (await response.body.json()) as any;
  equal(body.error.parentPin, true);
  // The distinction the client needs: there is no PIN to prompt for yet.
  equal(body.error.parentPinSetupRequired, true);
});

test("kid profile and a PIN: refused until the PIN is proved", async () => {
  const user = await findUser("user1@keylearn.org");
  await addKidProfile(user.id!);
  await user.setParentPin("1234");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  const before = await request.POST("/_/support/tickets").send(ticket);
  equal(before.status, 428);
  const body = (await before.body.json()) as any;
  equal(body.error.parentPin, true);
  // A PIN exists, so the client prompts rather than sending them to setup.
  equal(body.error.parentPinSetupRequired, undefined);

  await request.POST("/_/support/my/pin").send({ pin: "1234" });

  const after = await request.POST("/_/support/tickets").send(ticket);
  equal(after.status, 200);
});

test("a wrong PIN does not open the section", async () => {
  const user = await findUser("user1@keylearn.org");
  await addKidProfile(user.id!);
  await user.setParentPin("1234");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  const wrong = await request.POST("/_/support/my/pin").send({ pin: "9999" });
  equal(wrong.status, 403);

  const response = await request.POST("/_/support/tickets").send(ticket);
  equal(response.status, 428);
});

test("signed out: not gated, because there is nothing to gate on", async () => {
  // The honest limit of this whole feature, asserted so nobody later
  // mistakes it for a guarantee. Anyone can open a ticket without an
  // account, and there we know nothing about who is typing — no profile,
  // no age, no PIN. The gate makes the registered path safe; it does not
  // make support child-free, and no gate here could.
  const request = startApp(context.get(Application, kMain));

  const response = await request.POST("/_/support/tickets").send(ticket);

  equal(response.status, 200);
});

// ── the gate the page asks on load ──
//
// The page must not render the section before it knows the answer, so this
// endpoint is what decides whether it opens at all. It reports the same
// decision the enforcing path throws on — same function underneath — so the
// two cannot drift into disagreeing.

test("gate: open for a signed-out visitor", async () => {
  const request = startApp(context.get(Application, kMain));

  const response = await request.GET("/_/support/gate").send();

  equal(response.status, 200);
  const gate = (await response.body.json()) as any;
  equal(gate.required, false);
  equal(gate.proved, true);
});

test("gate: open for a household with no kid profile", async () => {
  const user = await findUser("user1@keylearn.org");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  const gate = (await (
    await request.GET("/_/support/gate").send()
  ).body.json()) as any;

  equal(gate.required, false);
});

test("gate: kid profile and no PIN reports setup, not a prompt", async () => {
  const user = await findUser("user1@keylearn.org");
  await addKidProfile(user.id!);
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  const gate = (await (
    await request.GET("/_/support/gate").send()
  ).body.json()) as any;

  equal(gate.required, true);
  equal(gate.setupRequired, true);
  equal(gate.proved, false);
});

test("proving the PIN for profiles does not open support", async () => {
  // Two doors, two proofs. Behind support is a private channel to an adult
  // stranger carrying the account's email and every ticket ever written;
  // behind profile management is a rename. The stricter one is not opened
  // as a side effect of the other.
  const user = await findUser("user1@keylearn.org");
  await addKidProfile(user.id!);
  await user.setParentPin("1234");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  await request.POST("/_/account/parent-pin/verify").send({ pin: "1234" });

  const gate = (await (
    await request.GET("/_/support/gate").send()
  ).body.json()) as any;
  equal(gate.proved, false);
});

test("leaving the section hands the proof back", async () => {
  // A PIN proved fifteen minutes ago is not evidence that a grown-up is
  // still holding the tablet. Closing the window is when that stops being
  // true, so that is when the proof ends — not when a timer says so.
  const user = await findUser("user1@keylearn.org");
  await addKidProfile(user.id!);
  await user.setParentPin("1234");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  await request.POST("/_/support/my/pin").send({ pin: "1234" });
  const open = (await (
    await request.GET("/_/support/gate").send()
  ).body.json()) as any;
  equal(open.proved, true);

  await request.POST("/_/support/my/pin/revoke").send({});

  const shut = (await (
    await request.GET("/_/support/gate").send()
  ).body.json()) as any;
  equal(shut.proved, false);
  equal(shut.required, true);

  // And the section is actually shut, not merely reported as shut.
  const response = await request.GET("/_/support/my/tickets").send();
  equal(response.status, 428);
});

test("a concurrent request cannot resurrect a revoked proof", async () => {
  // The bug this table exists for. The session is one blob rewritten in
  // full on every request, so a request that loaded before the revoke and
  // committed after it wrote the deleted key straight back. Closing the
  // account window did exactly that: leaving the pane fires the rail's
  // unread count alongside the revoke.
  const user = await findUser("user1@keylearn.org");
  await addKidProfile(user.id!);
  await user.setParentPin("1234");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  await request.POST("/_/support/my/pin").send({ pin: "1234" });

  // The unread count and the revoke, overlapping — the shape that broke.
  await Promise.all([
    request.GET("/_/support/my/tickets").send(),
    request.POST("/_/support/my/pin/revoke").send({}),
    request.GET("/_/support/my/tickets").send(),
  ]);

  const gate = (await (
    await request.GET("/_/support/gate").send()
  ).body.json()) as any;
  equal(gate.proved, false, "the revoke must survive whatever ran beside it");

  const after = await request.GET("/_/support/my/tickets").send();
  equal(after.status, 428);
});

test("one browser's proof does not open another's", async () => {
  // Keyed on the session, not the account: proving on the family tablet
  // must not open the section on a laptop signed into the same account.
  const user = await findUser("user1@keylearn.org");
  await addKidProfile(user.id!);
  await user.setParentPin("1234");

  const tablet = startApp(context.get(Application, kMain));
  await tablet.become(user.id!);
  const laptop = startApp(context.get(Application, kMain));
  await laptop.become(user.id!);

  await tablet.POST("/_/support/my/pin").send({ pin: "1234" });

  const other = (await (
    await laptop.GET("/_/support/gate").send()
  ).body.json()) as any;
  equal(other.proved, false);
});

test("gate: closed before the PIN, open after it", async () => {
  const user = await findUser("user1@keylearn.org");
  await addKidProfile(user.id!);
  await user.setParentPin("1234");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  const before = (await (
    await request.GET("/_/support/gate").send()
  ).body.json()) as any;
  equal(before.required, true);
  equal(before.setupRequired, false);
  equal(before.proved, false);

  await request.POST("/_/support/my/pin").send({ pin: "1234" });

  const after = (await (
    await request.GET("/_/support/gate").send()
  ).body.json()) as any;
  equal(after.proved, true);
});

test("reading a thread is gated too, not only writing", async () => {
  // The section's contents are the sensitive part: a thread carries
  // everything anyone has written into the ticket. A gate on submission
  // alone would have shown a child the previous conversation.
  const user = await findUser("user1@keylearn.org");
  await addKidProfile(user.id!);
  await user.setParentPin("1234");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  const response = await request.GET("/_/support/t/any-token").send();

  equal(response.status, 428);
});

// ── stickiness ──
//
// The gate keys on a live learner profile OR the sticky flag. The flag
// exists because deleting the profile is the obvious move for anyone
// trying to get past the gate, and a requirement that travels with the
// thing it protects protects nothing.

test("the requirement survives deleting the last kid profile", async () => {
  const user = await findUser("user1@keylearn.org");
  await user.$query().patch({ supportPinRequired: true });
  await user.setParentPin("1234");
  // No kid profile on the account at all — only the sticky record that
  // there used to be one.
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  const gate = (await (
    await request.GET("/_/support/gate").send()
  ).body.json()) as any;
  equal(gate.required, true);

  const response = await request.POST("/_/support/tickets").send(ticket);
  equal(response.status, 428);
});

test("creating a kid profile sets the flag", async () => {
  const user = await findUser("user1@keylearn.org");
  await user.setParentPin("1234");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);
  // Creating a profile is gated by the account PIN, not the support one —
  // that separation is the point of the two keys.
  await request.POST("/_/account/parent-pin/verify").send({ pin: "1234" });

  const created = await request.POST("/_/profiles").send({
    kind: "kid",
    firstName: "Learner",
    parentalConsent: true,
  });
  equal(created.status, 200);

  const after = await findUser("user1@keylearn.org");
  equal(Boolean(after.supportPinRequired), true);
});

test("an adult profile does not set the flag", async () => {
  const user = await findUser("user1@keylearn.org");
  const request = startApp(context.get(Application, kMain));
  await request.become(user.id!);

  await request.POST("/_/profiles").send({
    kind: "adult",
    firstName: "Grown Up",
  });

  const after = await findUser("user1@keylearn.org");
  equal(Boolean(after.supportPinRequired), false);
});
