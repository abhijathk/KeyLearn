import { createHash } from "node:crypto";
import { body, controller, http } from "@fastr/controller";
import { Context } from "@fastr/core";
import { injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { type SessionState } from "@fastr/middleware-session";
import { Env } from "@keylearn/config";
import { AdSeen, VisitStat } from "@keylearn/database";
import { Logger } from "@keylearn/logger";
import { z } from "zod";
import { clientIp } from "../auth/ratelimit.ts";
import { type AuthState } from "../auth/types.ts";
import { zod } from "../auth/zod.ts";
import {
  decodeOrigin,
  DIRECT,
  encodeOrigin,
  ORIGIN_COOKIE,
  ORIGIN_COOKIE_SECONDS,
  visitOrigin,
} from "./origin.ts";

const clue = z.string().max(200).nullish();
const TVisit = z.object({
  source: clue,
  medium: clue,
  campaign: clue,
  referrer: clue,
});
type TVisit = z.infer<typeof TVisit>;
const PVisit = zod(TVisit);

/** One browser counts as one visit a day. */
const SEEN_TTL_MS = 24 * 60 * 60 * 1000;

const BOT =
  /bot|crawl|spider|slurp|preview|fetch|headless|lighthouse|pingdom|monitor|curl|wget|python|axios|node-fetch/i;

/** A hash, never an identifier; it is swept within the day like the ads'. */
function seenHash(who: string, day: string): string {
  return createHash("sha256")
    .update(`visit ${who} ${day}`)
    .digest("hex")
    .slice(0, 48);
}

function cookieOptions() {
  return {
    path: "/",
    maxAge: ORIGIN_COOKIE_SECONDS,
    sameSite: "Lax" as const,
    secure: Env.getBoolean("COOKIE_SECURE", true),
    httpOnly: true,
  };
}

/**
 * Counts visits by where they came from, for the desk's traffic widgets.
 *
 * The page sends one beacon when it first loads, carrying the campaign words
 * from its own address and the host of the page that linked to it. What is
 * kept is a day's counter per source; nobody is recorded. A visit from a
 * campaign also leaves a small cookie holding only those campaign words, so
 * that an account made later can be counted against the same source.
 */
@injectable()
@controller()
export class VisitController {
  @http.POST("/_/visit")
  async visit(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PVisit) input: TVisit,
  ) {
    ctx.response.body = { ok: true };
    ctx.response.headers.set("Cache-Control", "private, no-store");
    const agent = ctx.request.headers.get("user-agent") ?? "";
    if (agent === "" || BOT.test(agent)) {
      return;
    }
    const origin = visitOrigin(input, ctx.request.headers.get("host") ?? "");
    if (origin !== DIRECT) {
      // The newest campaign wins; plain direct visits leave it alone.
      ctx.cookies.set(ORIGIN_COOKIE, encodeOrigin(origin), cookieOptions());
    }
    const day = new Date().toISOString().slice(0, 10);
    const session = ctx.state.session.id ?? "";
    const who = session !== "" ? session : `${clientIp(ctx)} ${agent}`;
    try {
      if (await AdSeen.first(seenHash(who, day), SEEN_TTL_MS)) {
        await VisitStat.bump(origin, "visits");
      }
    } catch (err) {
      // A counter must never break a page.
      Logger.warn(err as Error, "Could not count a visit");
    }
  }
}

/**
 * Counts one new account against the source that brought it, then forgets
 * the source. Call it only from a path that has just created an account.
 */
export async function countSignup(ctx: Context): Promise<void> {
  const origin = decodeOrigin(ctx.cookies.get(ORIGIN_COOKIE));
  try {
    await VisitStat.bump(origin, "signups");
  } catch (err) {
    Logger.warn(err as Error, "Could not count a signup");
  }
  if (ctx.cookies.has(ORIGIN_COOKIE)) {
    ctx.cookies.set(ORIGIN_COOKIE, null, cookieOptions());
  }
}
