import { test } from "node:test";
import { StaffAuditEvent } from "@keylearn/database";
import { equal } from "rich-assert";
import { TestContext } from "../test/context.ts";
import { StaffAuditSweep } from "./sweep.ts";

/**
 * The staff audit log had no retention at all; this is the window and the
 * sweep that applies it. Two rows, one inside the window and one past it,
 * and the flag read live so both settings are tried against the same table.
 */

const context = new TestContext();
const DAY = 24 * 60 * 60 * 1000;

async function seed(now: number) {
  await StaffAuditEvent.query().delete();
  const fresh = await StaffAuditEvent.query().insert({
    action: "staff-signin",
    detail: "fresh",
    ip: "203.0.113.10",
  });
  const stale = await StaffAuditEvent.query().insert({
    action: "staff-signin",
    detail: "stale",
    ip: "203.0.113.11",
  });
  await StaffAuditEvent.query()
    .findById(fresh.id!)
    .patch({ createdAt: new Date(now - 10 * DAY) } as any);
  await StaffAuditEvent.query()
    .findById(stale.id!)
    .patch({ createdAt: new Date(now - 400 * DAY) } as any);
}

async function details(): Promise<string[]> {
  const rows = await StaffAuditEvent.query().orderBy("id");
  return rows.map((r) => r.detail ?? "");
}

test("with a window set, rows past it are dropped and the rest kept", async () => {
  const now = Date.now();
  await seed(now);
  const saved = process.env.STAFF_AUDIT_RETENTION_DAYS;
  process.env.STAFF_AUDIT_RETENTION_DAYS = "365";
  try {
    const dropped = await context.get(StaffAuditSweep).runOnce(now);
    equal(dropped, 1);
    equal((await details()).join(","), "fresh");
  } finally {
    if (saved == null) {
      delete process.env.STAFF_AUDIT_RETENTION_DAYS;
    } else {
      process.env.STAFF_AUDIT_RETENTION_DAYS = saved;
    }
  }
});

test("with no window (the shipped value), nothing is ever dropped", async () => {
  const now = Date.now();
  await seed(now);
  const saved = process.env.STAFF_AUDIT_RETENTION_DAYS;
  delete process.env.STAFF_AUDIT_RETENTION_DAYS;
  try {
    const dropped = await context.get(StaffAuditSweep).runOnce(now);
    equal(dropped, 0);
    equal((await details()).join(","), "fresh,stale");
  } finally {
    if (saved != null) {
      process.env.STAFF_AUDIT_RETENTION_DAYS = saved;
    }
  }
});
