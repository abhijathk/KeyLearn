import { test } from "node:test";
import { Application } from "@fastr/core";
import { Profile, type User } from "@keylearn/database";
import { equal } from "rich-assert";
import { kMain } from "../module.ts";
import { TestContext } from "../test/context.ts";
import { startApp } from "../test/request.ts";
import { findUser } from "../test/sql.ts";
import { resetRateLimits } from "./ratelimit.ts";

/**
 * The grown-up PIN actually guards profile management.
 *
 * This had no test at all. Two hundred and twenty-six passed without one, and
 * none of them would have noticed if the gate were deleted — which is not
 * hypothetical: during this work the check was replaced with `if (false)` to
 * force the prompt while testing the UI, and the suite stayed green. It came
 * within one commit of shipping with profile management unguarded.
 *
 * A control nobody tests is a control nobody is keeping. What it protects is
 * concrete: a child who picks up the tablet must not be able to rename
 * themselves an adult, delete a sibling, or add a profile. The PIN is the only
 * thing standing between them and those routes, because the on-screen gate is
 * a speed bump and a direct fetch walks straight past it.
 */

const context = new TestContext();

const PIN = "8317";

/**
 * Runs a body with a PIN set, and puts the account back afterwards.
 *
 * These tests share seeded accounts with the rest of the suite, and a PIN left
 * behind gates routes other tests use. That is not theoretical either: the org
 * suite passed on its own and failed after this file ran, because user2 had
 * quietly acquired a PIN. A test that changes shared state and does not put it
 * back is a test that breaks somebody else's.
 */
async function withPin(user: User, body: () => Promise<void>): Promise<void> {
  await user.setParentPin(PIN);
  try {
    await body();
  } finally {
    await user.setParentPin(null);
  }
}

/**
 * Runs a body and puts the learner's name back afterwards.
 *
 * The same lesson as the PIN, learned twice: proving the gate lets a rename
 * through means performing a rename, and these are the accounts the rest of
 * the suite is also using. Clearing the PIN alone left "Grace" behind, and the
 * org suite went on failing.
 */
async function withNameRestored(
  profileId: number,
  restore: { firstName?: string | null; lastName?: string | null },
  body: () => Promise<void>,
): Promise<void> {
  try {
    await body();
  } finally {
    const row = await Profile.query().findById(profileId);
    // `?? undefined` because the column reads back as `string | null` while
    // the patch builder accepts only `string | undefined` — and a name that
    // was genuinely empty should be restored to empty, not to the literal
    // string "null".
    await row?.$query().patch({
      firstName: restore.firstName ?? undefined,
      lastName: restore.lastName ?? undefined,
    });
  }
}

test("a household with no PIN is not asked for one", async () => {
  // The gate must stay invisible to the many accounts that never set a PIN. A
  // check that fired regardless would lock every one of them out of their own
  // learners — a worse failure than the one it prevents.
  resetRateLimits();
  const user = await findUser("user1@keylearn.org");
  await Profile.ensureDefault(user);
  const [profile] = await Profile.listForUser(user.id!);

  await withNameRestored(
    profile.id!,
    { firstName: profile.firstName, lastName: profile.lastName },
    async () => {
      const request = startApp(context.get(Application, kMain));
      await request.become(user.id!);

      const response = await request
        .PATCH(`/_/profiles/${profile.id!}`)
        .type("application/json")
        .send(JSON.stringify({ firstName: "Ada" }));
      equal(response.status, 200);
    },
  );
});

test("with a PIN set, changing a learner is refused until it is proved", async () => {
  resetRateLimits();
  const user = await findUser("user2@keylearn.org");
  await Profile.ensureDefault(user);
  const [profile] = await Profile.listForUser(user.id!);

  await withNameRestored(
    profile.id!,
    { firstName: profile.firstName, lastName: profile.lastName },
    async () =>
      await withPin(user, async () => {
        const request = startApp(context.get(Application, kMain));
        await request.become(user.id!);

        // 428 rather than 403: this is not "you may not", it is "there is a step
        // you have not taken yet", and the page has to tell those apart to know
        // whether to raise a prompt or show an error.
        const refused = await request
          .PATCH(`/_/profiles/${profile.id!}`)
          .type("application/json")
          .send(JSON.stringify({ firstName: "Grace" }));
        equal(refused.status, 428);
        const body = (await refused.body.json()) as {
          error: { parentPin?: boolean };
        };
        // The flag is what the client keys on to raise the PIN prompt rather than
        // show a bare failure. Without it a parent sees a Save button that does
        // nothing, which is the bug the prompt was written to fix.
        equal(body.error.parentPin, true);

        // Proving it opens the gate for the window that follows.
        const proved = await request
          .POST("/_/account/parent-pin/verify")
          .type("application/json")
          .send(JSON.stringify({ pin: PIN }));
        equal(proved.status, 200);

        const allowed = await request
          .PATCH(`/_/profiles/${profile.id!}`)
          .type("application/json")
          .send(JSON.stringify({ firstName: "Grace" }));
        equal(allowed.status, 200);
      }),
  );
});

test("the wrong PIN does not open the gate", async () => {
  // Otherwise the check is a formality that any value satisfies.
  resetRateLimits();
  const user = await findUser("user3@keylearn.org");
  await Profile.ensureDefault(user);
  const [profile] = await Profile.listForUser(user.id!);

  await withPin(user, async () => {
    const request = startApp(context.get(Application, kMain));
    await request.become(user.id!);

    const wrong = await request
      .POST("/_/account/parent-pin/verify")
      .type("application/json")
      .send(JSON.stringify({ pin: "0000" }));
    equal(wrong.status === 200, false);

    const still = await request
      .PATCH(`/_/profiles/${profile.id!}`)
      .type("application/json")
      .send(JSON.stringify({ firstName: "Katherine" }));
    equal(still.status, 428);
  });
});

test("adding and deleting a learner sit behind the same gate", async () => {
  // Editing is the route somebody notices; creating and deleting are the ones
  // that would actually let a child rearrange the household. All three call
  // the same check, and this is what fails if one of them stops.
  resetRateLimits();
  const user = await findUser("user3@keylearn.org");
  await Profile.ensureDefault(user);
  const [profile] = await Profile.listForUser(user.id!);

  await withPin(user, async () => {
    const request = startApp(context.get(Application, kMain));
    await request.become(user.id!);

    const added = await request
      .POST("/_/profiles")
      .type("application/json")
      // A grown-up needs a last name, or the body is rejected before the gate
      // is ever consulted — which would make this pass for the wrong reason.
      .send(
        JSON.stringify({
          kind: "adult",
          firstName: "Mabel",
          lastName: "Keene",
        }),
      );
    equal(added.status, 428);

    const removed = await request.DELETE(`/_/profiles/${profile.id!}`).send();
    equal(removed.status, 428);
  });
});

test("proving the PIN on one account does not open another's", async () => {
  // The proof lives in the session, so this asks whether it is scoped to the
  // person who gave it. If it were not, one household's PIN would unlock every
  // household served by the same process.
  resetRateLimits();
  const owner = await findUser("user2@keylearn.org");
  await Profile.ensureDefault(owner);

  const other = await findUser("user3@keylearn.org");
  await Profile.ensureDefault(other);
  const [theirs] = await Profile.listForUser(other.id!);

  await withPin(owner, async () => {
    await withPin(other, async () => {
      const request = startApp(context.get(Application, kMain));
      await request.become(owner.id!);
      await request
        .POST("/_/account/parent-pin/verify")
        .type("application/json")
        .send(JSON.stringify({ pin: PIN }));

      // Reaching another account's learner is refused on ownership long before
      // the PIN matters — asserted here so a later change that relaxes the
      // gate cannot quietly turn this into a 200.
      const response = await request
        .PATCH(`/_/profiles/${theirs.id!}`)
        .type("application/json")
        .send(JSON.stringify({ firstName: "Nope" }));
      equal(response.status === 200, false);
    });
  });
});
