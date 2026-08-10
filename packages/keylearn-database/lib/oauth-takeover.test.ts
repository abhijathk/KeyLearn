// A runnable reproduction of the nOAuth-class takeover, kept next to the model
// so the guarantee is exercised rather than asserted in a comment.
import { test } from "node:test";
import { equal, isNull } from "rich-assert";
import { User, UserExternalId } from "./model.ts";
import { useDatabase } from "./testing.ts";

useDatabase();

test("EXPLOIT: a tenant-controlled email cannot take over an account", async () => {
  // The victim registered normally, with a password.
  await User.registerWithPassword(
    "victim@keylearn.org",
    "correct horse battery",
    "victim",
    "1990-01-01",
  );
  const before = await User.findByEmail("victim@keylearn.org");
  const victimId = before!.id!;

  // The attacker owns an identity provider tenant and sets their user's mail
  // attribute to the victim's address. The provider reports no verification.
  const result = await User.ensure({
    raw: {},
    provider: "microsoft",
    id: "attacker-subject-9999",
    email: "victim@keylearn.org",
    emailVerified: null,
    name: "Attacker",
    url: null,
    imageUrl: null,
  });

  // The sign-in must not resolve to the victim's account.
  equal(result.kind, "link-required");
  isNull(
    await UserExternalId.findBySubject("microsoft", "attacker-subject-9999"),
  );

  // The victim's account is untouched: same id, password intact, no new link.
  const after = await User.findById(victimId);
  equal(after!.email, "victim@keylearn.org");
  equal(after!.externalIds!.length, 0);
  equal(
    (
      await User.loginWithPassword(
        "victim@keylearn.org",
        "correct horse battery",
      )
    )?.id,
    victimId,
  );
});
