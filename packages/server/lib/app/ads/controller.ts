import { createHash } from "node:crypto";
import { body, controller, http, pathParam } from "@fastr/controller";
import { Context } from "@fastr/core";
import { NotFoundError } from "@fastr/errors";
import { injectable } from "@fastr/invert";
import { type RouterState } from "@fastr/middleware-router";
import { type SessionState } from "@fastr/middleware-session";
import { AdCampaign, AdSeen, AdStat } from "@keylearn/database";
import { z } from "zod";
import { clientIp } from "../auth/ratelimit.ts";
import { type AuthState } from "../auth/types.ts";
import { zod } from "../auth/zod.ts";
import { adsAllowed } from "./eligibility.ts";
import { previewPage, whyThisAdPage } from "./pages.ts";
import { adDwellSeconds, adMaxRotation } from "./readers.ts";
import { noticeHoldsTheBar } from "./sweep.ts";

const pId = zod(z.coerce.number().int().positive());
const pScreen = zod(z.coerce.number().int().min(0).max(2));
const pToken = zod(z.string().trim().min(8).max(64));

const TAdView = z.object({
  id: z.number().int().positive(),
  screen: z.number().int().min(0).max(2),
});
type TAdView = z.infer<typeof TAdView>;
const PAdView = zod(TAdView);

/** One reader is counted once per campaign screen per day, and no longer. */
const SEEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * A hash, never an identifier.
 *
 * What goes in is the session id, the campaign, the screen and the day;
 * what is stored is the digest. It answers "have I already counted this
 * one?" and it answers nothing else. The row cannot be turned back into a
 * session, and it is deleted within the day either way.
 */
function seenHash(
  sessionId: string,
  campaignId: number,
  screen: number,
  day: string,
): string {
  return createHash("sha256")
    .update(`${sessionId} ${campaignId} ${screen} ${day}`)
    .digest("hex")
    .slice(0, 48);
}

/**
 * The paid line above the header: the reader's half of it.
 *
 * These routes sit under `/_/ads` and `/go/ad`, deliberately not under
 * `/_/support`. That whole prefix is routed to the support desk's cookie
 * (see desk-session.ts), and everything here is the learner's own session.
 *
 * Three rules shape the endpoints:
 *
 * 1. **Eligibility is decided here, not in the browser.** A reader who may
 *    not see a campaign gets an empty feed, cannot be counted for one and
 *    cannot be redirected by one.
 * 2. **A click carries an id, never a URL.** The destination is read from
 *    the stored campaign, so no request can turn this domain into an open
 *    redirect however the link is typed.
 * 3. **Nothing about the reader reaches the advertiser.** A view or a click
 *    increments a daily counter and that is the entire record of it.
 */
@injectable()
@controller()
export class AdsController {
  /**
   * Every campaign this reader should see, with the timing the bar rotates
   * on. An empty list is a normal answer, not an error.
   */
  @http.GET("/_/ads")
  async feed(ctx: Context<RouterState & AuthState>) {
    const allowed = await adsAllowed(ctx.state.user, ctx.state.publicUser);
    const all = allowed ? await AdCampaign.liveNow() : [];
    // A site notice owns this line while it is up. A campaign that chose
    // to stand aside for one steps out here and is credited the minutes by
    // the sweep, so the promise costs the advertiser nothing.
    const held = all.length > 0 && (await noticeHoldsTheBar());
    const live = held ? all.filter((row) => !row.pauseForNotices) : all;
    // Sole occupancy is a bought guarantee: the first live campaign that
    // asked for the bar to itself takes it, and the rest wait their turn
    // on another day rather than sharing it.
    const sole = live.find((row) => Boolean(row.soleOccupancy));
    const shown = (sole != null ? [sole] : live).slice(0, adMaxRotation());
    ctx.response.body = {
      ads: shown.map((row) => row.toPublic()),
      dwellSeconds: adDwellSeconds(),
    };
    // Short, and private: two readers are not entitled to the same answer,
    // because one of them may be signed in to a paying account.
    ctx.response.headers.set("Cache-Control", "private, max-age=30");
  }

  /**
   * Counts one view. Repeated within the day for the same reader and the
   * same screen it counts nothing and still answers 200, because a browser
   * that re-renders must not be able to inflate a number, and must not be
   * told whether it did.
   */
  @http.POST("/_/ads/view")
  async view(
    ctx: Context<RouterState & SessionState & AuthState>,
    @body.json(PAdView) input: TAdView,
  ) {
    ctx.response.body = { ok: true };
    ctx.response.headers.set("Cache-Control", "private, no-store");
    if (!(await adsAllowed(ctx.state.user, ctx.state.publicUser))) {
      return;
    }
    const campaign = await AdCampaign.query().findById(input.id);
    if (campaign == null || !campaign.live()) {
      return;
    }
    const day = new Date().toISOString().slice(0, 10);
    // A signed-in reader has a session; a first-time visitor has not got
    // one yet, and counting them once per render would inflate every
    // number an advertiser is shown. The fallback is the address and the
    // browser string, which is enough to recognise the same visitor for a
    // day and is hashed rather than stored either way.
    const session = ctx.state.session.id ?? "";
    const who =
      session !== ""
        ? session
        : `${clientIp(ctx)} ${ctx.request.headers.get("user-agent") ?? ""}`;
    const hash = seenHash(who, input.id, input.screen, day);
    if (await AdSeen.first(hash, SEEN_TTL_MS)) {
      await AdStat.bump(input.id, input.screen, "views");
    }
  }

  /**
   * Where a click goes. The id names the campaign and the screen; the
   * destination comes from the row, so a crafted link cannot send anybody
   * anywhere the advertiser did not book.
   */
  @http.GET("/go/ad/{id}/{screen}")
  async click(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
    @pathParam("screen", pScreen) screen: number,
  ) {
    const campaign = await AdCampaign.query().findById(id);
    if (campaign == null) {
      throw new NotFoundError();
    }
    const target = campaign.screenList[screen];
    if (target == null || !isSafeHref(target.href)) {
      throw new NotFoundError();
    }
    // Counted even when the campaign has just ended: the reader clicked a
    // line that was on their screen, and the advertiser paid for it.
    if (await adsAllowed(ctx.state.user, ctx.state.publicUser)) {
      await AdStat.bump(id, screen, "clicks");
    }
    ctx.response.headers.set("Cache-Control", "private, no-store");
    // No referrer: the advertiser learns that somebody arrived from
    // KeyLearn, which they know, and not which page they were reading.
    ctx.response.headers.set("Referrer-Policy", "no-referrer");
    ctx.response.redirect(target.href, 302);
  }

  /** The advertiser's logo, served from this domain so nothing third-party loads. */
  @http.GET("/_/ads/logo/{id}")
  async logo(
    ctx: Context<RouterState & AuthState>,
    @pathParam("id", pId) id: number,
  ) {
    const campaign = await AdCampaign.query().findById(id);
    if (campaign?.logo == null) {
      throw new NotFoundError();
    }
    const parsed = parseDataUri(campaign.logo);
    if (parsed == null) {
      throw new NotFoundError();
    }
    ctx.response.headers.set("Content-Type", parsed.type);
    ctx.response.headers.set("Cache-Control", "public, max-age=3600");
    // A logo is supplier-supplied bytes served from our own origin, so it
    // is pinned shut: no script may run out of it whatever it claims to be.
    ctx.response.headers.set("Content-Security-Policy", "default-src 'none'");
    ctx.response.headers.set("X-Content-Type-Options", "nosniff");
    ctx.response.body = parsed.bytes;
  }

  /**
   * The page a reader reaches from "Why this ad?": what was shown, who
   * paid for it, and what was not done to decide it.
   */
  @http.GET("/why-this-ad")
  async why(ctx: Context<RouterState & AuthState>) {
    const live = await AdCampaign.liveNow();
    ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
    ctx.response.headers.set("Cache-Control", "private, max-age=60");
    ctx.response.body = whyThisAdPage(live.map((row) => row.toDetails()));
  }

  /**
   * The advertiser's own preview, reached by an unguessable link in their
   * booking mail. It renders the campaign exactly as a reader sees it, in
   * both themes, and it is readable without an account because the person
   * checking their own advertisement does not have one.
   */
  @http.GET("/ad-preview/{token}")
  async preview(
    ctx: Context<RouterState & AuthState>,
    @pathParam("token", pToken) token: string,
  ) {
    const campaign = await AdCampaign.findByToken(token);
    if (campaign == null) {
      throw new NotFoundError();
    }
    ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
    // Never cached by anything in between: the link is the credential.
    ctx.response.headers.set("Cache-Control", "private, no-store");
    ctx.response.headers.set("X-Robots-Tag", "noindex, nofollow");
    ctx.response.body = previewPage(campaign.toDetails());
  }
}

/** Only a plain https link off this site, never javascript: or data:. */
export function isSafeHref(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Splits a stored logo back into its bytes and its declared type. */
export function parseDataUri(
  value: string,
): { readonly type: string; readonly bytes: Buffer } | null {
  const match =
    /^data:([a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+);base64,(.+)$/i.exec(value);
  if (match == null) {
    return null;
  }
  const type = match[1]!.toLowerCase();
  if (!ALLOWED_LOGO_TYPES.has(type)) {
    return null;
  }
  try {
    return { type, bytes: Buffer.from(match[2]!, "base64") };
  } catch {
    return null;
  }
}

/**
 * What an advertiser may send as a logo.
 *
 * SVG is the one everybody asks for and the one that carries script, so it
 * is accepted only after the sanitiser in `logo.ts` has stripped everything
 * executable, and it is served under a `default-src 'none'` policy on top.
 */
export const ALLOWED_LOGO_TYPES: ReadonlySet<string> = new Set([
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
