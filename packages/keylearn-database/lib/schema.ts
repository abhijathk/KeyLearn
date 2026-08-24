import { envStaffEmails } from "@keylearn/config";
import { type Knex } from "knex";
import { AccountDeletionRequest } from "./account-deletion-request.ts";
import { AgentStatus } from "./agent-status.ts";
import { Answer, AnswerRule } from "./answer.ts";
import { DeskUnlock } from "./desk-unlock.ts";
import {
  Certificate,
  CertificateSitting,
  Credential,
  EmailVerification,
  Order,
  Profile,
  User,
  UserExternalId,
  UserLoginRequest,
} from "./model.ts";
import { Notice } from "./notice.ts";
import { Notification } from "./notification.ts";
import { PracticeSession } from "./practice-session.ts";
import { ProfileData } from "./profile-data.ts";
import { SavedReply } from "./saved-reply.ts";
import { SecurityEvent } from "./security-event.ts";
import { SecurityReset } from "./security-reset.ts";
import { Staff } from "./staff.ts";
import { StaffAuditEvent } from "./staff-audit-event.ts";
import { StaffSettings } from "./staff-settings.ts";
import { SupportAttachment } from "./support-attachment.ts";
import { SupportBlock } from "./support-block.ts";
import { SupportDraft } from "./support-draft.ts";
import { SupportMessage } from "./support-message.ts";
import { SupportPinProof } from "./support-pin-proof.ts";
import { SupportTicket } from "./support-ticket.ts";

export async function createSchema(knex: Knex): Promise<void> {
  /** Returns whether the table was created by this call, not whether it exists. */
  const createTable = async ({
    tableName,
    createTable,
  }: {
    tableName: string;
    createTable: (knex: Knex, table: Knex.CreateTableBuilder) => void;
  }): Promise<boolean> => {
    const { schema } = knex;
    if (!(await schema.hasTable(tableName))) {
      await schema.createTable(tableName, (table) => {
        createTable(knex, table);
      });
      return true;
    }
    return false;
  };

  await createTable(User);
  await createTable(UserExternalId);
  await createTable(Order);
  await createTable(UserLoginRequest);
  await createTable(Profile);
  await createTable(Credential);
  await createTable(EmailVerification);
  await createTable(SecurityEvent);
  await createTable(ProfileData);
  await createTable(CertificateSitting);
  await createTable(Certificate);
  await createTable(SupportTicket);
  // Depends on SupportTicket (FK) — must come after it.
  await createTable(SupportMessage);
  await createTable(SupportAttachment);
  await createTable(SupportDraft);
  await createTable(SecurityReset);
  await createTable(SupportPinProof);
  await createTable(Notice);
  await createTable(StaffAuditEvent);
  await createTable(Answer);
  // Depends on Answer (FK) — must come after it.
  await createTable(AnswerRule);
  await createTable(SavedReply);
  await createTable(StaffSettings);
  // Depends on User (FK) — must come after it.
  await createTable(PracticeSession);
  await createTable(Notification);
  await createTable(AgentStatus);
  await createTable(SupportBlock);
  await createTable(AccountDeletionRequest);

  // Who may reach the desk, moved out of the STAFF_EMAILS env var.
  //
  // The seed runs on creation only. Doing it whenever the table is empty
  // would mean an admin who removes every other staff member gets them all
  // back at the next restart — a silent re-grant of access that was
  // deliberately revoked, which is a security bug rather than a nicety.
  if (await createTable(Staff)) {
    const seeded = await Staff.seed(envStaffEmails());
    if (seeded > 0) {
      console.log(`staff: seeded ${seeded} address(es) from STAFF_EMAILS`);
    }
  }
  await createTable(DeskUnlock);
  // Gives a fresh deployment a working failsafe before anyone has signed in
  // to set one. A no-op once a passcode exists — see DeskUnlock.bootstrap.
  if (await DeskUnlock.bootstrap(process.env["ADMIN_UNLOCK_PASSCODE"] ?? "")) {
    console.log("desk-unlock: passcode taken from ADMIN_UNLOCK_PASSCODE");
  }

  // Additive column migrations for databases created before the column
  // existed — createTable above only runs when the table is missing.
  await addColumn("user", "password_hash", (table) => {
    table.string("password_hash", 128).nullable();
  });
  await addColumn("user", "date_of_birth", (table) => {
    table.date("date_of_birth").nullable();
  });
  await addColumn("user", "session_epoch", (table) => {
    table.integer("session_epoch").notNullable().defaultTo(0);
  });
  const emailVerifiedAdded = await addColumn(
    "user",
    "email_verified",
    (table) => {
      table.boolean("email_verified").notNullable().defaultTo(false);
    },
  );
  // Grandfather every pre-existing account in as verified — they were created
  // before email verification existed, so we must not lock them out. Only runs
  // the one time the column is first added; new sign-ups default to false.
  if (emailVerifiedAdded) {
    await knex("user").update({ email_verified: true });
  }

  // Emailed codes are now bound to a purpose, so one code can no longer be
  // redeemed for a different (possibly destructive) action, and two concurrent
  // flows stop overwriting each other's row.
  const purposeAdded = await addColumn(
    "email_verification",
    "purpose",
    (table) => {
      table.string("purpose", 24).notNullable().defaultTo("verify-email");
    },
  );
  await addColumn("email_verification", "attempts_at", (table) => {
    table.timestamp("attempts_at").nullable();
  });
  if (purposeAdded) {
    // The uniqueness constraint moves from (email) to (email, purpose). Any
    // in-flight codes are dropped: they predate purpose binding, and a user can
    // simply request a new one.
    await knex("email_verification").delete();
    try {
      await knex.schema.alterTable("email_verification", (table) => {
        table.dropUnique(["email"]);
      });
    } catch {
      // Some engines name or omit the index differently; a missing index here is
      // not fatal, the composite one below is what matters.
    }
    try {
      await knex.schema.alterTable("email_verification", (table) => {
        table.unique(["email", "purpose"]);
      });
    } catch {
      // Already present.
    }
  }

  // Two-step verification.
  await addColumn("user", "totp_secret", (table) => {
    table.string("totp_secret", 64).nullable();
  });
  // Widened from a 32-character base32 secret to hold an encrypted value
  // instead (see totp-crypto.ts) — the ciphertext, its IV and its auth tag,
  // base64-encoded together, run well past 64 characters. Safe to run every
  // time: altering an already-TEXT column to TEXT again is a no-op on both
  // engines this app supports.
  await knex.schema.alterTable("user", (table) => {
    table.text("totp_secret").alter();
  });
  await addColumn("user", "totp_enabled", (table) => {
    table.boolean("totp_enabled").notNullable().defaultTo(false);
  });
  await addColumn("user", "recovery_codes", (table) => {
    table.text("recovery_codes").nullable();
  });

  // Recorded as a need, not a diagnosis: what the app must know is whether to
  // lead with audio and offer braille entry, and a disability label would be
  // special-category health data without answering that any better.
  await addColumn("profile", "vision_support", (table) => {
    table.boolean("vision_support").notNullable().defaultTo(false);
  });

  await addColumn("profile", "anonymized", (table) => {
    table.boolean("anonymized").notNullable().defaultTo(false);
  });

  await addColumn("user", "parent_pin_hash", (table) => {
    table.string("parent_pin_hash", 160).nullable();
  });

  // How many digits the PIN has, so the entry screen can draw one box per
  // digit. A hash cannot be asked this.
  //
  // Left null on accounts whose PIN predates the column, and the entry
  // screen falls back to a single free-length field for those. Not
  // backfilled with 4: a household whose PIN is six digits would be shown
  // four boxes and locked out of their own account.
  // Who a support reply is from, shown on the notification itself.
  await addColumn("notification", "author_name", (table) => {
    table.string("author_name", 64).nullable();
  });

  await addColumn("notification", "from_assistant", (table) => {
    table.boolean("from_assistant").notNullable().defaultTo(false);
  });

  await addColumn("user", "parent_pin_length", (table) => {
    table.integer("parent_pin_length").unsigned().nullable();
  });

  // Sticky memory of "this household has had a learner profile", which the
  // support gate reads alongside the live profile count.
  //
  // Without it the requirement lifts the moment the last kid profile is
  // deleted — and deleting a profile is exactly what a child who wants past
  // the gate would try. Once true, never cleared.
  //
  // Deliberately not backfilled: accounts that still HAVE a kid profile are
  // caught by the live count, and for one whose profile was already deleted
  // before this shipped there is nothing left to read. The flag starts
  // earning its keep from the next kid profile created on any account.
  await addColumn("user", "support_pin_required", (table) => {
    table.boolean("support_pin_required").notNullable().defaultTo(false);
  });

  // Public profiles become opt-in. Existing accounts are moved to private too,
  // rather than grandfathered: the public id is a reversible encoding of the row
  // id, so every account's full typing history was enumerable by anyone, and in
  // an app used by children that is not a default worth preserving. Anyone who
  // wants their profile shared can turn it back on.
  await addColumn("user", "public_profile", (table) => {
    table.boolean("public_profile").notNullable().defaultTo(false);
  });

  // When the last practice nudge went out. The reminder frequency preference is
  // a minimum gap between emails, and a gap can only be enforced against a
  // remembered timestamp — without this column "Monthly" and "Weekly" would
  // both mean "every time the sweep runs".
  await addColumn("user", "reminded_at", (table) => {
    table.dateTime("reminded_at").nullable();
  });

  // Emailed LINKS are likewise bound to a purpose, so a sign-in link can no
  // longer be redeemed to set a new password, or vice versa.
  const tokenPurposeAdded = await addColumn(
    "user_login_request",
    "purpose",
    (table) => {
      table.string("purpose", 16).notNullable().defaultTo("login");
    },
  );
  if (tokenPurposeAdded) {
    // Drop any in-flight tokens: they predate purpose binding, and a user can
    // request a new link.
    await knex("user_login_request").delete();
    try {
      await knex.schema.alterTable("user_login_request", (table) => {
        table.dropUnique(["email"]);
      });
    } catch {
      // Index naming varies by engine; the composite one below is what matters.
    }
    try {
      await knex.schema.alterTable("user_login_request", (table) => {
        table.unique(["email", "purpose"]);
      });
    } catch {
      // Already present.
    }
  }

  // Gates the support desk's staff-only views. Off by default — nobody is
  // staff until granted with scripts/grant-staff.mjs.
  await addColumn("user", "staff", (table) => {
    table.boolean("staff").notNullable().defaultTo(false);
  });

  // When a linked provider was last signed in with. Without this,
  // toPublicUser() had no way to prefer the account's most recently used
  // provider for its display name/avatar, so whichever provider happened to
  // be linked first silently won forever — e.g. an old Google link's avatar
  // outliving a newer Facebook sign-in with no way to tell the two apart.
  await addColumn("user_external_id", "used_at", (table) => {
    table.timestamp("used_at").nullable();
  });

  // Captured once, from Cloudflare's CF-IPCountry header, at the moment an
  // account registers — never updated again. Feeds the support dashboard's
  // signup-geography breakdown; not an ongoing location trail.
  await addColumn("user", "signup_country", (table) => {
    table.string("signup_country", 2).nullable();
  });

  // Captured once, from Accept-Language negotiation, at the moment an
  // account registers — never updated again, same rule as signup_country.
  // Feeds the support dashboard's signup-language breakdown.
  await addColumn("user", "locale", (table) => {
    table.string("locale", 10).nullable();
  });

  // Support-ticket columns below are also present in SupportTicket.createTable
  // itself, so a fresh database gets the full schema in one shot — these
  // addColumn calls exist purely to bring an already-created support_ticket
  // table (created before these columns existed) up to date.
  await addColumn("support_ticket", "confirmed", (table) => {
    table.boolean("confirmed").notNullable().defaultTo(true);
  });
  await addColumn("support_ticket", "confirm_token_hash", (table) => {
    table.string("confirm_token_hash", 64).nullable();
  });
  await addColumn("support_ticket", "closed_at", (table) => {
    table.timestamp("closed_at").nullable();
  });
  // Which Answer/AnswerRule auto-replied to this ticket, if still credited
  // at close time — see SupportTicket.attachAutoAnswer/clearAutoAttribution.
  await addColumn("support_ticket", "auto_answer_id", (table) => {
    table.integer("auto_answer_id").unsigned().nullable();
  });
  await addColumn("support_ticket", "auto_rule_id", (table) => {
    table.integer("auto_rule_id").unsigned().nullable();
  });
  // The automation agent's tone read — see SupportTicket.setSentiment.
  await addColumn("support_ticket", "sentiment", (table) => {
    table.string("sentiment", 16).nullable();
  });
  // thread_token_hash is NOT NULL + unique, which a plain addColumn cannot
  // express on a table that may already hold rows — added nullable first,
  // then tightened below.
  const threadTokenAdded = await addColumn(
    "support_ticket",
    "thread_token_hash",
    (table) => {
      table.string("thread_token_hash", 64).nullable();
    },
  );
  if (threadTokenAdded) {
    // The desk was never reachable before this column existed
    // (SUPPORT_VISIBLE was off), so any pre-existing rows are test data, not
    // real conversations — simplest correct fix is to drop them rather than
    // mint tokens for tickets nobody could ever have reached anyway.
    await knex("support_ticket").delete();
    await knex.schema.alterTable("support_ticket", (table) => {
      table.string("thread_token_hash", 64).notNullable().alter();
    });
    try {
      await knex.schema.alterTable("support_ticket", (table) => {
        table.unique(["thread_token_hash"]);
      });
    } catch {
      // Already present (e.g. this ran as part of createTable on a fresh DB).
    }
  }

  // Notice columns below are likewise also present in Notice.createTable
  // itself; these addColumn calls upgrade an already-created notice table.
  await addColumn("notice", "kind", (table) => {
    table.string("kind", 16).notNullable().defaultTo("feature");
  });
  await addColumn("notice", "starts_at", (table) => {
    table.timestamp("starts_at").nullable();
  });
  await addColumn("notice", "ends_at", (table) => {
    table.timestamp("ends_at").nullable();
  });
  await addColumn("notice", "audience", (table) => {
    table.string("audience", 16).notNullable().defaultTo("everyone");
  });
  await addColumn("notice", "dismissible", (table) => {
    table.boolean("dismissible").notNullable().defaultTo(true);
  });
  await addColumn("agent_status", "enabled", (table) => {
    table.boolean("enabled").notNullable().defaultTo(true);
  });
  // The name the customer sees above a desk reply (QDesk sends it with
  // the reply; see that repo's deliver-reply bridge).
  await addColumn("support_message", "author_name", (table) => {
    table.string("author_name", 64).nullable();
  });
  await addColumn("support_message", "answer_ids", (table) => {
    table.text("answer_ids").nullable();
  });
  await addColumn("staff_settings", "require_reveal_reason", (table) => {
    table.boolean("require_reveal_reason").notNullable().defaultTo(true);
  });
  await addColumn("staff_settings", "show_last_login_location", (table) => {
    table.boolean("show_last_login_location").notNullable().defaultTo(true);
  });
  await addColumn("support_ticket", "archived", (table) => {
    table.boolean("archived").notNullable().defaultTo(false);
  });
  await addColumn("notice", "display", (table) => {
    table.string("display", 16).notNullable().defaultTo("banner");
  });
  await addColumn("answer", "reopened_count", (table) => {
    table.integer("reopened_count").unsigned().notNullable().defaultTo(0);
  });
  await addColumn("answer_rule", "reopened_count", (table) => {
    table.integer("reopened_count").unsigned().notNullable().defaultTo(0);
  });

  // Staff's own display/notification/behaviour preferences for the desk —
  // see StaffSettings for what reads/writes each one.
  await addColumn("staff_settings", "compact_density", (table) => {
    table.boolean("compact_density").notNullable().defaultTo(false);
  });
  await addColumn("staff_settings", "relative_timestamps", (table) => {
    table.boolean("relative_timestamps").notNullable().defaultTo(false);
  });
  await addColumn("staff_settings", "show_country_flag", (table) => {
    table.boolean("show_country_flag").notNullable().defaultTo(false);
  });
  await addColumn("staff_settings", "desktop_push", (table) => {
    table.boolean("desktop_push").notNullable().defaultTo(false);
  });
  await addColumn("staff_settings", "sound_alert", (table) => {
    table.boolean("sound_alert").notNullable().defaultTo(false);
  });
  await addColumn("staff_settings", "escalation_only", (table) => {
    table.boolean("escalation_only").notNullable().defaultTo(false);
  });
  await addColumn("staff_settings", "default_landing_page", (table) => {
    table
      .string("default_landing_page", 16)
      .notNullable()
      .defaultTo("dashboard");
  });
  // Deliberately read via StaffSettings.siteDefault() where it's enforced
  // (the guest-reply reopen path), same as confidenceThreshold/overdueHours —
  // desk-wide behaviour, not really "per staff member", but stored on the
  // same row for the same unsophisticated-but-good-enough reason.
  await addColumn("staff_settings", "second_reopen_auto_flag", (table) => {
    table.boolean("second_reopen_auto_flag").notNullable().defaultTo(false);
  });
  // 0 = off. Read via siteDefault() by the idle-ticket close sweep.
  await addColumn("staff_settings", "auto_close_idle_days", (table) => {
    table.integer("auto_close_idle_days").unsigned().notNullable().defaultTo(0);
  });
  // Reserves the setting's shape for the sentiment-reading agent from the
  // pending automation plan — nothing reads this yet.
  await addColumn("staff_settings", "sentiment_sensitivity", (table) => {
    table
      .string("sentiment_sensitivity", 16)
      .notNullable()
      .defaultTo("moderate");
  });

  // Captured once, from Cloudflare's CF-IPCountry header, at the moment a
  // ticket is created — never updated again, same rule as User.signupCountry.
  // Feeds the Inbox's optional per-ticket country flag.
  await addColumn("support_ticket", "country", (table) => {
    table.string("country", 2).nullable();
  });
  // How many times this ticket has moved from closed back to open via a
  // guest reply — see replyToThread. Powers the second-reopen auto-flag
  // setting; not shown to the sender.
  // ── the account-window support section ──

  // Removing a ticket from your own list is a soft delete. The row has to
  // stay: the desk keeps the conversation and archives it, so "gone from my
  // messages" is a timestamp rather than a DELETE. Held here rather than in
  // the browser, or the ticket reappears on their phone.
  await addColumn("support_ticket", "deleted_by_user_at", (table) => {
    table.timestamp("deleted_by_user_at").nullable();
  });

  // What the unread count on the chip and the dot on the rail are counted
  // against. In local storage it would say "2 unread" on the laptop and
  // nothing on the tablet.
  await addColumn("support_ticket", "last_read_at", (table) => {
    table.timestamp("last_read_at").nullable();
  });

  // One question, five stars, asked once a case has closed.
  await addColumn("support_ticket", "csat_rating", (table) => {
    table.integer("csat_rating").unsigned().nullable();
  });
  await addColumn("support_ticket", "csat_note", (table) => {
    table.text("csat_note").nullable();
  });
  await addColumn("support_ticket", "csat_rated_at", (table) => {
    table.timestamp("csat_rated_at").nullable();
  });
  // Closing the rating card is a decision, and it must not come back on
  // another device — without this it is dismissed per browser, which reads
  // as the product nagging.
  await addColumn("support_ticket", "csat_dismissed_at", (table) => {
    table.timestamp("csat_dismissed_at").nullable();
  });

  // What a message *is*, where that changes how it has to be shown: the
  // fixed emergency redirect is not a chat bubble, and the line saying a
  // person has taken over is not a reply. Null for ordinary text.
  await addColumn("support_message", "kind", (table) => {
    table.string("kind", 16).nullable();
  });

  // A client-generated id, unique per message. The one thing that makes the
  // offline outbox safe: replaying a send that half-succeeded finds the row
  // already there instead of posting it twice.
  await addColumn("support_message", "client_id", (table) => {
    table.string("client_id", 64).nullable();
    table.unique(["client_id"], { indexName: "support_message_client_id" });
  });

  await addColumn("support_ticket", "reopen_count", (table) => {
    table.integer("reopen_count").unsigned().notNullable().defaultTo(0);
  });

  // When the desk acknowledged a message — the second tick in the thread.
  // Null on everything written before this shipped, which reads as "sent"
  // and is as much as can honestly be said about them.
  await addColumn("support_message", "delivered_at", (table) => {
    table.timestamp("delivered_at").nullable();
  });

  // The desk's own id for a reply it delivered here — the handle the
  // per-reply thumbs post back with, so "didn't help" lands on the exact
  // message that missed. Null on anything not delivered from the desk.
  await addColumn("support_message", "qdesk_message_id", (table) => {
    table.integer("qdesk_message_id").unsigned().nullable();
  });

  // The customer's own thumbs on a desk reply, kept here as well as
  // forwarded, so the thread can render their choice without a round
  // trip to the desk.
  await addColumn("support_message", "feedback", (table) => {
    table.string("feedback", 8).nullable();
  });

  async function addColumn(
    tableName: string,
    columnName: string,
    build: (table: Knex.AlterTableBuilder) => void,
  ): Promise<boolean> {
    const { schema } = knex;
    if (!(await schema.hasColumn(tableName, columnName))) {
      await schema.alterTable(tableName, build);
      return true;
    }
    return false;
  }
}
