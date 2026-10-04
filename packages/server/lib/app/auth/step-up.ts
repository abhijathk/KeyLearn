import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  closeSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { join } from "node:path";
import { Env } from "@keylearn/config";

/**
 * Step-up confirmation for the desk's destructive calls.
 *
 * The ops key (`OPS_API_KEY`) proves "this request came from QDesk". It does
 * not prove a person decided anything, so on its own a stolen key could
 * export, reveal, merge, delete and re-plan at will. Each of those calls now
 * also carries a short-lived token that KeyLearn minted only after the
 * acting staff member confirmed with their own passkey or authenticator
 * code (`POST /_/internal/staff-auth/step-up`). The token names one action
 * on one target for one staff member, lives two minutes, and is spent once.
 *
 * Token: `base64url(JSON{sub, em, act, tgt, exp, jti}) "." base64url(HMAC-
 * SHA256(secret, payloadPart))`.
 *
 * The secret, in order:
 *
 * 1. `KEYLEARN_STEP_UP_SECRET` — set it on any deployment that runs on more
 *    than one machine, since every machine must agree.
 * 2. `step-up.key` in the data directory, created once with an exclusive
 *    open (the same pattern as `totp.key`), so every cluster worker on the
 *    machine reads the same bytes and a token minted by one worker verifies
 *    on another.
 * 3. Random bytes for this process only — a read-only data directory. Tokens
 *    then verify only on the worker that minted them.
 *
 * It is deliberately NEVER derived from `OPS_API_KEY`: the whole point is
 * that the ops key alone is not enough, and a secret computable from it
 * would let whoever holds the key mint their own confirmations.
 *
 * Single use: a spent `jti` is remembered in memory until it expires AND
 * marked by an exclusive-create file under `step-up-used/` in the data
 * directory, which is what makes "once" hold across cluster workers (an
 * `O_EXCL` create is atomic on one filesystem). If that directory cannot be
 * written the in-memory map still holds per worker — best effort, as agreed.
 */

export const STEP_UP_ACTIONS = [
  "account-export",
  "account-reveal-email",
  "account-merge",
  "account-delete",
  "org-create",
  "org-plan",
] as const;

export type StepUpAction = (typeof STEP_UP_ACTIONS)[number];

/** How long a minted token lives. */
export const STEP_UP_TTL_MS = 120_000;

/** How long a passkey challenge from `passkey-options` stays usable. */
export const CHALLENGE_TTL_MS = 300_000;

export type StepUpClaims = {
  readonly sub: number;
  readonly em: string;
  readonly act: StepUpAction;
  readonly tgt: string;
  readonly exp: number;
  readonly jti: string;
};

/** `STAFF_STEP_UP=off` switches enforcement off (emergencies, tests). */
export function stepUpEnforced(): boolean {
  return Env.getString("STAFF_STEP_UP", "on").trim().toLowerCase() !== "off";
}

// --- secret -----------------------------------------------------------------

const KEY_FILE = "step-up.key";
const USED_DIR = "step-up-used";

let cached: { readonly from: string; readonly key: Buffer } | null = null;

function secretFor(dataDir: string): Buffer {
  const configured = Env.getString("KEYLEARN_STEP_UP_SECRET", "");
  const from = configured !== "" ? `env:${configured}` : `dir:${dataDir}`;
  if (cached != null && cached.from === from) {
    return cached.key;
  }
  const key =
    configured !== ""
      ? Buffer.from(configured, "utf8")
      : Buffer.from(secretFromDisk(dataDir), "hex");
  cached = { from, key };
  return key;
}

function secretFromDisk(dataDir: string): string {
  const path = join(dataDir, KEY_FILE);
  const read = (): string | null => {
    try {
      const existing = readFileSync(path, "utf8").trim();
      return /^[0-9a-f]{64}$/.test(existing) ? existing : null;
    } catch {
      return null;
    }
  };
  const existing = read();
  if (existing != null) {
    return existing;
  }
  const fresh = randomBytes(32).toString("hex");
  try {
    mkdirSync(dataDir, { recursive: true });
    // Exclusive, so two workers starting together cannot each write a
    // different key; the loser reads the winner's.
    const fd = openSync(path, "wx", 0o600);
    try {
      writeSync(fd, `${fresh}\n`);
    } finally {
      closeSync(fd);
    }
    return fresh;
  } catch {
    return read() ?? fresh;
  }
}

function mac(key: Buffer, data: string | Buffer): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

// --- tokens -----------------------------------------------------------------

export function issueStepUpToken(
  claims: {
    readonly sub: number;
    readonly em: string;
    readonly act: StepUpAction;
    readonly tgt: string;
  },
  dataDir: string,
  now: number = Date.now(),
): { readonly token: string; readonly expiresAt: number } {
  const exp = now + STEP_UP_TTL_MS;
  const payload = {
    sub: claims.sub,
    em: claims.em,
    act: claims.act,
    tgt: claims.tgt,
    exp,
    jti: randomBytes(16).toString("hex"),
  } satisfies StepUpClaims;
  const part = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const sig = mac(secretFor(dataDir), part).toString("base64url");
  return { token: `${part}.${sig}`, expiresAt: exp };
}

/**
 * The claims of a token whose signature verifies and which has not expired;
 * null for anything else. Does NOT spend it — see {@link spendStepUp}.
 */
export function readStepUpToken(
  token: string | null | undefined,
  dataDir: string,
  now: number = Date.now(),
): StepUpClaims | null {
  if (typeof token !== "string" || token.length > 2048) {
    return null;
  }
  const parts = token.trim().split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [part, sig] = parts as [string, string];
  const expected = mac(secretFor(dataDir), part);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  let raw: any;
  try {
    raw = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    raw == null ||
    typeof raw !== "object" ||
    !Number.isInteger(raw.sub) ||
    typeof raw.em !== "string" ||
    !STEP_UP_ACTIONS.includes(raw.act) ||
    typeof raw.tgt !== "string" ||
    typeof raw.exp !== "number" ||
    typeof raw.jti !== "string" ||
    !/^[0-9a-f]{32}$/.test(raw.jti)
  ) {
    return null;
  }
  if (now >= raw.exp) {
    return null;
  }
  return {
    sub: raw.sub,
    em: raw.em,
    act: raw.act,
    tgt: raw.tgt,
    exp: raw.exp,
    jti: raw.jti,
  };
}

/** Why a presented token does not admit this call, or null when it does. */
export function stepUpMismatch(
  claims: StepUpClaims | null,
  want: {
    readonly act: StepUpAction;
    readonly tgt: string;
    readonly actor: number | null | undefined;
  },
): string | null {
  if (claims == null) {
    return "missing, forged or expired";
  }
  if (claims.act !== want.act) {
    return `minted for ${claims.act}`;
  }
  if (claims.tgt !== want.tgt) {
    return `minted for target ${claims.tgt}`;
  }
  if (want.actor == null || claims.sub !== want.actor) {
    return `minted for staff ${claims.sub}, acting ${want.actor ?? "none"}`;
  }
  return null;
}

// --- single use -------------------------------------------------------------

/** Bound on remembered ids per worker. Full of live ids → refuse (fail closed). */
const MAX_REMEMBERED = 10_000;
const used = new Map<string, number>();
let lastSweep = 0;

function forgetExpired(now: number): void {
  for (const [id, exp] of used) {
    if (exp <= now) {
      used.delete(id);
    }
  }
}

function sweepMarkers(dir: string, now: number): void {
  if (now - lastSweep < 60_000) {
    return;
  }
  lastSweep = now;
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    try {
      const at = join(dir, name);
      // Both tokens and challenges are dead well inside ten minutes.
      if (now - statSync(at).mtimeMs > 600_000) {
        unlinkSync(at);
      }
    } catch {
      // Another worker got there first.
    }
  }
}

/**
 * Spends `id` once. False when it was already spent here, by another
 * worker, or the bounded memory is full of live ids.
 */
function spendOnce(id: string, exp: number, dataDir: string, now: number) {
  if (used.has(id)) {
    return false;
  }
  if (used.size >= MAX_REMEMBERED) {
    forgetExpired(now);
    if (used.size >= MAX_REMEMBERED) {
      return false;
    }
  }
  const dir = join(dataDir, USED_DIR);
  try {
    mkdirSync(dir, { recursive: true });
    const fd = openSync(join(dir, id), "wx", 0o600);
    closeSync(fd);
  } catch (err: any) {
    if (err?.code === "EEXIST") {
      used.set(id, exp);
      return false;
    }
    // Unwritable data directory: memory alone, per worker.
  }
  used.set(id, exp);
  sweepMarkers(dir, now);
  return true;
}

export function spendStepUp(
  claims: StepUpClaims,
  dataDir: string,
  now: number = Date.now(),
): boolean {
  return spendOnce(`t-${claims.jti}`, claims.exp, dataDir, now);
}

// --- passkey challenges -----------------------------------------------------

const CHALLENGE_DOMAIN = Buffer.from("keylearn:step-up:challenge:", "utf8");

/**
 * A challenge KeyLearn can later recognise as its own: 16 random bytes, the
 * expiry, and a MAC over both. `passkey-options` hands these out; step-up
 * accepts only these, and each once — otherwise an assertion captured from
 * any earlier ceremony (synced passkeys report a signature counter of 0, so
 * the counter check does not catch a replay) could be presented again with
 * its own old challenge.
 */
export function issuePasskeyChallenge(
  dataDir: string,
  now: number = Date.now(),
): Uint8Array<ArrayBuffer> {
  const body = Buffer.alloc(24);
  randomBytes(16).copy(body, 0);
  body.writeBigUInt64BE(BigInt(now + CHALLENGE_TTL_MS), 16);
  const tag = mac(secretFor(dataDir), Buffer.concat([CHALLENGE_DOMAIN, body]));
  return new Uint8Array(Buffer.concat([body, tag.subarray(0, 16)]));
}

/** Whether `challenge` (base64url) is ours, fresh, and not yet spent — spends it. */
export function spendPasskeyChallenge(
  challenge: string,
  dataDir: string,
  now: number = Date.now(),
): boolean {
  const raw = Buffer.from(challenge, "base64url");
  if (raw.length !== 40) {
    return false;
  }
  const body = raw.subarray(0, 24);
  const expected = mac(
    secretFor(dataDir),
    Buffer.concat([CHALLENGE_DOMAIN, body]),
  ).subarray(0, 16);
  if (!timingSafeEqual(raw.subarray(24), expected)) {
    return false;
  }
  const exp = Number(body.readBigUInt64BE(16));
  if (now >= exp) {
    return false;
  }
  return spendOnce(
    `c-${body.subarray(0, 16).toString("hex")}`,
    exp,
    dataDir,
    now,
  );
}

// --- daily caps -------------------------------------------------------------

const CAP_DEFAULTS: Record<StepUpAction, readonly [string, number]> = {
  "account-export": ["STAFF_DAILY_CAP_EXPORT", 20],
  "account-reveal-email": ["STAFF_DAILY_CAP_REVEAL_EMAIL", 40],
  "account-merge": ["STAFF_DAILY_CAP_MERGE", 10],
  "account-delete": ["STAFF_DAILY_CAP_DELETE", 5],
  "org-plan": ["STAFF_DAILY_CAP_ORG_PLAN", 20],
  "org-create": ["STAFF_DAILY_CAP_ORG_CREATE", 10],
};

/** How many of `action` one staff member may complete in 24 hours. */
export function dailyCap(action: StepUpAction): number {
  const [name, fallback] = CAP_DEFAULTS[action];
  const value = Number(Env.getString(name, ""));
  return Env.getString(name, "") !== "" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

/** Only for tests. */
export function resetStepUp(): void {
  cached = null;
  used.clear();
  lastSweep = 0;
}
