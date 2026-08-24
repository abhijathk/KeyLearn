import { body, controller, http, pathParam } from "@fastr/controller";
import { Context } from "@fastr/core";
import { ForbiddenError } from "@fastr/errors";
import { injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import {
  assess,
  type CertificateEvidence,
  certificateNumber,
  certificateTemplate,
  fitName,
  judge,
  nameCapacity,
  type NumberingKey,
  sequenceOf,
  type Sitting,
} from "@keylearn/certificate";
import { DataDir } from "@keylearn/config";
import { Certificate, CertificateSitting, Profile } from "@keylearn/database";
import { actorFor } from "../access/actor.ts";
import { reachProfile } from "../access/resolver.ts";
import { type AuthState, rateLimit } from "../auth/index.ts";
import { numberingKey } from "./key.ts";
import { flag, millis } from "./timestamp.ts";

/**
 * Issuing and checking certificates.
 *
 * The number comes from here and nowhere else. A device cannot mint one:
 * uniqueness is a property of a sequence, and a sequence needs somewhere
 * authoritative to live. That is also why certificates are for signed-in
 * households only — it is a real cost, and it buys a number that can be
 * checked by somebody who does not trust the person holding it.
 */
@injectable()
@controller()
export class Controller {
  constructor(readonly dataDir: DataDir) {}

  /** The deployment's own scramble — see `numberingKey`. */
  get #key() {
    return numberingKey(this.dataDir.dataPath());
  }

  /**
   * Record one sitting.
   *
   * Stored rather than scored: the verdict is the median of the last three,
   * so a single sitting is never the answer to anything, and there is nothing
   * to be gained by sending a flattering one.
   */
  @http.POST("/_/certificate/sitting/{pid:[0-9]+}")
  async postSitting(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
    @body.json(null, { maxLength: 4096 }) value: unknown,
  ) {
    // A sitting is a minute of typing at least, so anything near this is a
    // script rather than a learner, and each row is a row in the table the
    // verdict reads.
    rateLimit(ctx, "certificate-sitting", 20, 60_000);
    const profile = await this.owned(ctx, pid);
    const sitting = readSitting(value);
    await CertificateSitting.query().insert({
      profileId: profile.id!,
      kind: sitting.kind,
      language: sitting.language,
      speed: sitting.speed,
      accuracy: sitting.accuracy,
      runs: sitting.runs,
      seconds: sitting.seconds,
    });
    ctx.response.status = 204;
  }

  /**
   * Issue a certificate, if it has actually been earned.
   *
   * The evidence arrives from the client because that is where a learner's
   * practice history lives, and it is re-judged here rather than trusted. This
   * is not proctoring and does not pretend to be: a determined forger with a
   * console can post whatever they like, which is exactly why the printed
   * wording claims a programme completed in practice conditions rather than an
   * examination passed. What this does stop is a certificate appearing because
   * of a bug on one page.
   */
  @http.POST("/_/certificate/{pid:[0-9]+}")
  async issue(
    ctx: Context<RouterState & AuthState>,
    @pathParam("pid") pid: string,
    @body.json(null, { maxLength: 8192 }) value: unknown,
  ) {
    // Issuing re-judges over every stored sitting, so it is the most expensive
    // thing here and the one most worth repeating blindly.
    rateLimit(ctx, "certificate-issue", 10, 60_000);
    const user = ctx.state.requireUser();
    const profile = await this.owned(ctx, pid);
    const { evidence, language, nameVisible } = readClaim(value, profile);

    const eligibility = assess(evidence);
    if (!eligibility.eligible) {
      ctx.response.status = 409;
      ctx.response.body = {
        error: "not-eligible",
        outstanding: eligibility.outstanding,
      };
      return;
    }

    const rows = await CertificateSitting.query()
      .where({ profileId: profile.id!, language })
      .orderBy("created_at", "asc");
    const sittings: readonly Sitting[] = rows.map((row) => {
      const at = millis(row.createdAt);
      return {
        at,
        kind: row.kind as Sitting["kind"],
        // A stored sitting is already the median of its own runs; presenting
        // it as a single run keeps the judge's arithmetic identical either way.
        runs: [
          {
            at,
            speed: row.speed!,
            accuracy: row.accuracy!,
            seconds: row.seconds!,
          },
        ],
      };
    });
    // The practice pace goes in as well as the sittings. Without it the
    // retention rule is inert — an absolute speed alone cannot tell somebody
    // typing by touch from somebody typing fast while glancing at the keys,
    // and the second collapses the moment the picture is taken away.
    const verdict = judge(sittings, evidence, evidence.speed);
    if (!verdict.passed || verdict.level == null) {
      ctx.response.status = 409;
      ctx.response.body = { error: "not-passed", verdict };
      return;
    }

    // Already held at this level in this language: the same document, not a
    // second one. Reissuing would mint a number for nothing.
    const existing = await Certificate.query().findOne({
      profileId: profile.id!,
      language,
      level: verdict.level,
    });
    if (existing != null) {
      ctx.response.body = toDetails(existing, this.#key);
      return;
    }

    // The paper and the printed name are decided once, here, and stored. Both
    // depend on facts that move — an age, an editable surname — and a document
    // that restyles itself after it has been issued is not a document.
    const sheet = certificateTemplate(evidence.age, evidence.audience);
    const name = fitName(
      profile.firstName!,
      profile.lastName ?? null,
      nameCapacity(sheet, evidence.kind),
    );

    const inserted = await Certificate.query().insert({
      // The sequence is the row's own identity, taken after insertion so two
      // concurrent requests cannot pick the same one.
      sequence: 0,
      profileId: profile.id!,
      userId: user.id!,
      kind: evidence.kind,
      audience: evidence.audience,
      language,
      level: verdict.level,
      sheet,
      speed: verdict.speed!,
      accuracy: verdict.accuracy!,
      name,
      nameVisible,
    });
    const saved = await Certificate.query()
      .patchAndFetchById(inserted.id!, { sequence: inserted.id! })
      .throwIfNotFound();
    ctx.response.body = toDetails(saved, this.#key);
  }

  /**
   * Whether verification may name the holder.
   *
   * Off by default and changeable afterwards, because the decision belongs to
   * the moment somebody actually shares the thing rather than to the moment it
   * was earned. A child's certificate is never named whatever anybody asks
   * for, so this refuses rather than storing a preference it would then ignore.
   */
  @http.POST("/_/certificate/named/{number:[A-Za-z0-9]+}")
  async setNamed(
    ctx: Context<RouterState & AuthState>,
    @pathParam("number") number: string,
    @body.json(null, { maxLength: 256 }) value: unknown,
  ) {
    rateLimit(ctx, "certificate-named", 20, 60_000);
    const user = ctx.state.requireUser();
    const sequence = sequenceOf(number, this.#key);
    if (sequence == null) {
      throw new ForbiddenError();
    }
    // Scoped to the caller's own account. Without this, a well-formed number
    // belonging to somebody else would be enough to unmask them.
    const found = await Certificate.query().findOne({
      sequence,
      userId: user.id!,
    });
    if (found == null) {
      throw new ForbiddenError();
    }
    if (found.audience === "kid") {
      ctx.response.status = 409;
      ctx.response.body = { error: "child" };
      return;
    }
    const nameVisible =
      (value as { nameVisible?: unknown })?.nameVisible === true;
    await Certificate.query().patchAndFetchById(found.id!, { nameVisible });
    ctx.response.body = { nameVisible };
  }

  /**
   * Every certificate this household holds.
   *
   * Signed in only, and scoped to the caller's own account — a list of who has
   * what is exactly the sort of thing that should never be reachable by
   * guessing a user id.
   */
  @http.GET("/_/certificate/mine")
  async mine(ctx: Context<RouterState & AuthState>) {
    const user = ctx.state.requireUser();
    const key = this.#key;
    const rows = await Certificate.query()
      .where({ userId: user.id! })
      .orderBy("created_at", "asc");
    ctx.response.body = rows.map((row) => ({
      ...toDetails(row, key),
      profileId: row.profileId,
    }));
  }

  /**
   * Check a number.
   *
   * Public on purpose — a certificate nobody can check is decoration. It says
   * as little as it can: whether the number was issued, at what level, when,
   * and in which alphabet. The holder is named only if they asked for that,
   * and a child is never named whatever anybody asked for.
   */
  @http.GET("/_/certificate/verify/{number:[A-Za-z0-9]+}")
  async verify(ctx: Context, @pathParam("number") number: string) {
    // The only endpoint here a stranger can reach, so the only one that can be
    // hammered by somebody without an account. Thirty a minute is far above
    // what a person checking a certificate does — a school office with a stack
    // of them is still one every few seconds — and far below what walking the
    // register would need.
    rateLimit(ctx, "certificate-verify", 30, 60_000);
    // The check character rejects a mistyped number before any lookup, which
    // also keeps this from being a way to enumerate what exists. Inverting the
    // scramble turns the rest into an indexed read rather than a scan over
    // every certificate ever issued.
    const sequence = sequenceOf(number, this.#key);
    if (sequence == null) {
      ctx.response.body = { valid: false };
      return;
    }
    const found = await Certificate.query().findOne({ sequence });
    if (found == null) {
      ctx.response.body = { valid: false };
      return;
    }
    ctx.response.body = {
      valid: true,
      level: found.level,
      language: found.language,
      kind: found.kind,
      issued: new Date(millis(found.createdAt)).toISOString(),
      name:
        found.audience === "kid" || !flag(found.nameVisible)
          ? null
          : found.name,
    };
  }

  private async owned(
    ctx: Context<RouterState & AuthState>,
    pid: string,
  ): Promise<Profile> {
    const user = ctx.state.requireUser();
    const profile = await reachProfile(
      actorFor(ctx, user),
      Number(pid),
      "read",
    );
    if (profile == null) {
      throw new ForbiddenError();
    }
    return profile;
  }
}

function toDetails(row: Certificate, key: NumberingKey) {
  return {
    number: certificateNumber(row.sequence!, key),
    level: row.level,
    sheet: row.sheet,
    kind: row.kind,
    audience: row.audience,
    language: row.language,
    speed: row.speed,
    accuracy: row.accuracy,
    name: row.name,
    nameVisible: flag(row.nameVisible),
    // Always ISO. SQLite hands back "2026-08-07 02:00:09", which is not a
    // format `new Date()` is required to parse and which browsers disagree
    // about — so the wire format is pinned here rather than left to whichever
    // database is underneath.
    issued: new Date(millis(row.createdAt)).toISOString(),
  };
}

const num = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const str = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.length > 0 && value.length <= 32
    ? value
    : fallback;

function readSitting(value: unknown) {
  const v = (value ?? {}) as Record<string, unknown>;
  return {
    kind: v.kind === "braille" ? "braille" : "typing",
    language: str(v.language, "en"),
    speed: Math.max(0, num(v.speed)),
    accuracy: Math.min(1, Math.max(0, num(v.accuracy))),
    runs: Math.max(1, Math.min(10, Math.round(num(v.runs, 1)))),
    seconds: Math.max(0, Math.min(600, Math.round(num(v.seconds)))),
  } as const;
}

function readClaim(value: unknown, profile: Profile) {
  const v = (value ?? {}) as Record<string, unknown>;
  const kind = v.kind === "braille" ? "braille" : "typing";
  const evidence: CertificateEvidence = {
    kind,
    // Taken from the stored profile, never from the request: a claim to be a
    // child, or not to be, decides which bar applies.
    audience: profile.kind === "kid" ? "kid" : "adult",
    age:
      profile.birthYear == null
        ? null
        : new Date().getFullYear() - profile.birthYear,
    learned: num(v.learned),
    total: num(v.total),
    settled: num(v.settled),
    volume: num(v.volume),
    daysPractised: num(v.daysPractised),
    elapsedDays: num(v.elapsedDays),
    speed: num(v.speed),
    accuracy: Math.min(1, Math.max(0, num(v.accuracy))),
  };
  return {
    evidence,
    language: str(v.language, "en"),
    nameVisible: v.nameVisible === true,
  };
}
