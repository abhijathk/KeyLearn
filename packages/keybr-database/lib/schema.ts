import { type Knex } from "knex";
import {
  Credential,
  EmailVerification,
  Order,
  Profile,
  User,
  UserExternalId,
  UserLoginRequest,
} from "./model.ts";

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
