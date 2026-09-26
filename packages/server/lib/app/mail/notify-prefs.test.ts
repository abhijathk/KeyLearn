import { test } from "node:test";
import { Profile } from "@keylearn/database";
import { Settings } from "@keylearn/settings";
import { SettingsDatabase } from "@keylearn/settings-database";
import { equal, isFalse, isTrue } from "rich-assert";
import { TestContext } from "../test/context.ts";
import { type FakeMailer } from "../test/mail.ts";
import { findUser } from "../test/sql.ts";
import { Mailer } from "./index.ts";
import { Notifier } from "./notify.ts";

const context = new TestContext();

// The Preferences pane saves email choices on the grown-up's own profile, so
// that is where the reminder has to look — not only at the account's file.
test("a reminder switched off in Preferences is not sent", async () => {
  const user = await findUser("user1@keylearn.org");
  const adult = await Profile.query().insertAndFetch({
    userId: user.id!,
    kind: "adult",
    firstName: "Grace",
  });
  const settings = context.get(SettingsDatabase);
  const mailer = context.get(Mailer) as FakeMailer;
  const notifier = context.get(Notifier);

  // Nothing set anywhere: reminders are on by default.
  isTrue(await notifier.practiceReminder(user, 9));
  mailer.dump();

  // Switched off where the pane saves it.
  await settings.setProfile(
    user.id!,
    adult.id!,
    new Settings({ "account.emailReminders": false }),
  );
  await user.$query().patch({ remindedAt: null });
  isFalse(await notifier.practiceReminder(user, 9));
  equal(mailer.dump().length, 0);
});
