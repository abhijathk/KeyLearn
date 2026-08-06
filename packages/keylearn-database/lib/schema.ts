import { type Knex } from "knex";
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
import { SecurityEvent } from "./security-event.ts";

export async function createSchema(knex: Knex): Promise<void> {
  const createTable = async ({
    tableName,
    createTable,
  }: {
    tableName: string;
    createTable: (knex: Knex, table: Knex.CreateTableBuilder) => void;
  }) => {
    const { schema } = knex;
    if (!(await schema.hasTable(tableName))) {
      await schema.createTable(tableName, (table) => {
        createTable(knex, table);
      });
    }
  };

  await createTable(User);
  await createTable(UserExternalId);
  await createTable(Order);
  await createTable(UserLoginRequest);
  await createTable(Profile);
  await createTable(Credential);
  await createTable(EmailVerification);
  await createTable(SecurityEvent);
  await createTable(CertificateSitting);
  await createTable(Certificate);

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
