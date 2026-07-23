import { type Knex } from "knex";
import { Order, User, UserExternalId, UserLoginRequest } from "./model.ts";

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

  // Additive column migrations for databases created before the column
  // existed — createTable above only runs when the table is missing.
  await addColumn("user", "password_hash", (table) => {
    table.string("password_hash", 128).nullable();
  });

  async function addColumn(
    tableName: string,
    columnName: string,
    build: (table: Knex.AlterTableBuilder) => void,
  ): Promise<void> {
    const { schema } = knex;
    if (!(await schema.hasColumn(tableName, columnName))) {
      await schema.alterTable(tableName, build);
    }
  }
}
