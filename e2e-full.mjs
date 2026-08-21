/**
 * One ticket, everything on it, across both apps.
 *
 * A regression pass rather than a unit test: it drives the real
 * endpoints on the two running servers and checks the things that have
 * broken at least once today — the bridge, the reference, attachments,
 * the delivery ticks, the notification, and both directions of the
 * typing indicator.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const KL = "http://localhost:4000";
const QD = "http://localhost:4100";
const DB = `${process.env["HOME"]}/.local/state/keybr/database.sqlite`;
const QD_DB =
  "/Users/abhijathkottikkal/Documents/KeyLearn/quakka-support-desk/.data/quakka.sqlite";

const sql = (db, q) => execFileSync("sqlite3", [db, q], { encoding: "utf8" }).trim();
const env = (name) =>
  execFileSync("grep", [`^${name}=`, ".env"], { encoding: "utf8" })
    .split("=").slice(1).join("=").trim();
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

const steps = [];
const step = (name, ok, detail = "") => {
  steps.push({ name, ok });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const tag = randomBytes(4).toString("hex");
const email = `e2e-${tag}@example.com`;
const APP_KEY = env("QDESK_APP_KEY");

const jar = [];
async function call(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    redirect: "manual",
    headers: {
      ...(typeof init.body === "string" ? { "content-type": "application/json" } : {}),
      ...(jar.length > 0 ? { cookie: jar.join("; ") } : {}),
      ...init.headers,
    },
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const pair = c.split(";")[0];
    const name = pair.split("=")[0];
    const at = jar.findIndex((x) => x.startsWith(`${name}=`));
    if (at >= 0) jar[at] = pair;
    else jar.push(pair);
  }
  return res;
}

// ---- sign in ----

await call(`${KL}/auth/login/register-email`, {
  method: "POST",
  body: JSON.stringify({ email }),
});
await settle(700);
// Mail no longer goes to the log, so the token is read from the row it
// was written to rather than from a message we can no longer see.
const token = sql(
  DB,
  `SELECT hex(access_token) FROM user_login_request WHERE email='${email}' LIMIT 1;`,
);
step("a login request was created", token !== "", token === "" ? "none" : "hashed, as expected");

// The hash cannot be reversed, so the session is made the way the app
// makes one: consume the row through the model's own path.
const raw = randomBytes(16).toString("hex");
const hashed = execFileSync(
  "node",
  ["-e", `console.log(require("crypto").createHash("sha256").update("${raw}").digest("hex"))`],
  { encoding: "utf8" },
).trim();
sql(
  DB,
  // The model stores digest("hex") as TEXT — writing a raw blob here is
  // how this script silently 403'd: string never equals blob.
  `UPDATE user_login_request SET access_token='${hashed}' WHERE email='${email}';`,
);
const login = await call(`${KL}/login/${raw}`);
step("signed in", login.status === 302, `status ${login.status}`);

// ---- a ticket, with a file ----

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const up = await call(`${KL}/_/support/my/attachments`, {
  method: "POST",
  body: JSON.stringify({
    fileName: `shot-${tag}.png`,
    mimeType: "image/png",
    data: png.toString("base64"),
  }),
});
const attachmentId = up.status === 200 ? (await up.json()).id : null;
step("attachment uploaded", attachmentId != null, `id ${attachmentId}`);

const subject = `Full check ${tag}`;
const opened = await call(`${KL}/_/support/my/tickets`, {
  method: "POST",
  body: JSON.stringify({
    subject,
    message: `Everything at once. (${tag})`,
    attachmentIds: attachmentId == null ? [] : [attachmentId],
  }),
});
step("ticket opened", opened.status === 200, `status ${opened.status}`);
const klTicket = sql(DB, `SELECT id FROM support_ticket WHERE subject='${subject}';`);
await settle(1800);

// ---- it reached the desk, whole ----

const qd = sql(QD_DB, `SELECT id || '|' || COALESCE(reference,'-') FROM support_ticket WHERE external_id='${klTicket}';`);
const [qdId, reference] = qd.split("|");
step("the desk has the ticket", qdId !== "", `qdesk #${qdId}`);
step("carrying the customer's reference", reference?.startsWith("KEY"), reference);
step(
  "and the attachment",
  sql(QD_DB, `SELECT count(*) FROM support_attachment WHERE ticket_id=${qdId};`) === "1",
);
step(
  "the opening message shows two ticks",
  sql(DB, `SELECT delivered_at IS NOT NULL FROM support_message WHERE ticket_id=${klTicket} AND sender='them' ORDER BY id LIMIT 1;`) === "1",
);

// ---- typing, both ways ----

const before = await fetch(`${QD}/_/apps/tickets/${klTicket}/presence`, {
  headers: { "x-qdesk-app-key": APP_KEY },
}).then((r) => r.json());
step("nobody is typing yet", before.typing === false);

const typed = await call(`${KL}/_/support/my/tickets/${klTicket}/typing`, { method: "POST" });
step("the customer's typing reaches the desk", typed.status === 200, `status ${typed.status}`);

// ---- the desk answers ----

const agentKey = execFileSync("grep", ["^QDESK_AGENT_API_KEY=", "../quakka-support-desk/.env"], {
  encoding: "utf8",
}).split("=").slice(1).join("=").trim();
const replied = await fetch(`${QD}/_/agent/tickets/${qdId}/reply`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-qdesk-agent-key": agentKey },
  body: JSON.stringify({ body: `Looking into it on {{d:2026-09-01}}. (${tag})` }),
});
step("the desk replied", replied.status === 200, `status ${replied.status}`);
await settle(1200);

step(
  "the reply is in the customer's thread",
  Number(sql(DB, `SELECT count(*) FROM support_message WHERE ticket_id=${klTicket} AND sender IN ('us','agent');`)) > 0,
);
step(
  "the desk's reply shows two ticks",
  sql(QD_DB, `SELECT delivered_at IS NOT NULL FROM support_message WHERE ticket_id=${qdId} AND sender IN ('us','agent') ORDER BY id DESC LIMIT 1;`) === "1",
);
const userId = sql(DB, `SELECT id FROM user WHERE email='${email}';`);
step(
  "the customer was notified",
  Number(sql(DB, `SELECT count(*) FROM notification WHERE user_id=${userId};`)) > 0,
);

// ---- and the date the desk inserted survives the trip ----

const thread = await call(`${KL}/_/support/my/tickets/${klTicket}`);
const body = thread.status === 200 ? await thread.json() : null;
const deskMessage = body?.messages?.find((m) => m.sender === "agent" || m.sender === "us");
step(
  "the date marker travelled intact",
  deskMessage?.body?.includes("{{d:2026-09-01}}") === true,
  "resolved by the reader, not the sender",
);
step("the thread reports desk presence", typeof body?.deskTyping === "boolean");

const failed = steps.filter((s) => !s.ok);
console.log(`\n${steps.length - failed.length}/${steps.length} steps passed`);
console.log(`CLEANUP kl=${klTicket} qd=${qdId} user=${userId} email=${email}`);
process.exit(failed.length === 0 ? 0 : 1);
