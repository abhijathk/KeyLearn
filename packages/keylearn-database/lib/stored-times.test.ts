import { test } from "node:test";
import { Model } from "objection";
import { deepEqual, equal } from "rich-assert";
import { normalizeStoredTimes } from "./stored-times.ts";
import { SupportTicket } from "./support-ticket.ts";
import { useDatabase } from "./testing.ts";

useDatabase();

/**
 * On SQLite a row that took a `CURRENT_TIMESTAMP` default holds its time as
 * text, which sorts after every epoch-millisecond row and reads as local
 * time. The normaliser turns those into the epoch milliseconds the rest of
 * the table holds, once.
 */

async function ticket(subject: string): Promise<number> {
  const { ticket } = await SupportTicket.create({
    userId: null,
    kind: "support",
    name: "n",
    email: "n@example.com",
    subject,
    message: "m",
    status: "open",
    confirmed: true,
  });
  return ticket.id!;
}

test("text timestamps become epoch milliseconds, once, and sort correctly", async (t) => {
  const knex = Model.knex();
  if (!/sqlite/i.test(String(knex.client.dialect))) {
    t.skip("SQLite only: MySQL stores real datetimes");
    return;
  }
  const older = await ticket("older");
  const newer = await ticket("newer");
  // What the column default and an old writer left behind.
  await knex.raw(
    "update support_ticket set updated_at = '2026-08-21 07:23:33' where id = ?",
    [older],
  );
  await knex.raw(
    `update support_ticket set updated_at = '"2026-08-22T09:00:00.500Z"' where id = ?`,
    [newer],
  );
  // Something that is not a date at all is left exactly as it is.
  const odd = await ticket("odd");
  await knex.raw(
    "update support_ticket set updated_at = 'not a date' where id = ?",
    [odd],
  );

  const first = await normalizeStoredTimes(knex);
  equal(first.unparsed, 1);
  const rows = (await knex.raw(
    "select id, updated_at as u, typeof(updated_at) as t from support_ticket where id in (?, ?) order by id",
    [older, newer],
  )) as { id: number; u: number; t: string }[];
  deepEqual(
    rows.map((r) => [r.t, r.u]),
    [
      ["integer", Date.UTC(2026, 7, 21, 7, 23, 33)],
      ["integer", Date.UTC(2026, 7, 22, 9, 0, 0, 500)],
    ],
  );

  // Newest first, now that both are numbers.
  await knex.raw("delete from support_ticket where id = ?", [odd]);
  const order = await SupportTicket.query()
    .whereIn("id", [older, newer])
    .orderBy("updatedAt", "desc");
  deepEqual(
    order.map((r) => r.id),
    [newer, older],
  );

  // A second run finds nothing to change.
  deepEqual(await normalizeStoredTimes(knex), { fixed: 0, unparsed: 0 });
});
