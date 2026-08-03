import { test } from "node:test";
import { equal, isNull, notEqual } from "rich-assert";
import { Profile, User } from "./model.ts";
import { useDatabase } from "./testing.ts";

useDatabase();

async function household() {
  const user = await User.query().insertGraph({
    email: "house@keylearn.com",
    name: "house",
  });
  const account = (await User.findById(user.id!))!;
  const ana = await Profile.query().insert({
    userId: account.id!,
    kind: "adult",
    firstName: "Ana",
  });
  const ben = await Profile.query().insert({
    userId: account.id!,
    kind: "adult",
    firstName: "Ben",
  });
  return { account, ana, ben };
}

test("each grown-up appears as themselves, not as the account", async () => {
  const { account, ana, ben } = await household();

  const a = ana.toPublicUser(account);
  const b = ben.toPublicUser(account);

  equal(a.name, "Ana");
  equal(b.name, "Ben");
  // Two learners in one household must be distinguishable — otherwise a
  // leaderboard shows one shared account name for both of them.
  notEqual(a.name, b.name);
  // The account's own display name is used for neither.
  notEqual(a.name, account.name);
});

test("a learner can hide their identity independently", async () => {
  const { account, ana, ben } = await household();
  await ana.$query().patch({ anonymized: true });
  const hidden = (await Profile.findOwned(account.id!, ana.id!))!;

  const a = hidden.toPublicUser(account);
  const b = ben.toPublicUser(account);

  notEqual(a.name, "Ana");
  isNull(a.imageUrl);
  // One learner opting out must not affect the other.
  equal(b.name, "Ben");
});

test("a hidden learner keeps a stable alias", async () => {
  const { account, ana } = await household();
  await ana.$query().patch({ anonymized: true });
  const hidden = (await Profile.findOwned(account.id!, ana.id!))!;

  // The same person should not look like a different stranger on every visit.
  equal(hidden.toPublicUser(account).name, hidden.toPublicUser(account).name);
});

test("a photo avatar becomes the picture; a preset icon does not", async () => {
  const { account, ana, ben } = await household();
  await ana.$query().patch({
    avatar: JSON.stringify({
      type: "photo",
      dataUrl: "data:image/png;base64,AAAA",
    }),
  });
  await ben.$query().patch({
    avatar: JSON.stringify({ type: "icon", id: "a-mint" }),
  });

  const withPhoto = (await Profile.findOwned(account.id!, ana.id!))!;
  const withIcon = (await Profile.findOwned(account.id!, ben.id!))!;

  equal(withPhoto.toPublicUser(account).imageUrl, "data:image/png;base64,AAAA");
  // A preset icon has no URL, so it falls through to the name identicon rather
  // than producing a broken image.
  isNull(withIcon.toPublicUser(account).imageUrl);
});
