import { type VisitOrigin } from "@keylearn/database";

/**
 * Where a visit came from, in the three words a marketing link carries.
 *
 * A link we hand out says so itself (`?utm_source=facebook&utm_medium=social
 * &utm_campaign=parents-oct`). A visit without one is named from the page
 * that sent it — only its host, never its path — and a visit with neither
 * is "direct". Everything is cut down to a short lowercase word, because
 * these values arrive in links anyone can write.
 */
export const DIRECT: VisitOrigin = {
  source: "direct",
  medium: "(none)",
  campaign: "(none)",
};

export type VisitClues = {
  readonly source?: string | null;
  readonly medium?: string | null;
  readonly campaign?: string | null;
  /** The referring page's host, e.g. "www.google.com". */
  readonly referrer?: string | null;
};

const SEARCH =
  /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|baidu|yandex|startpage|qwant|brave)\.[a-z.]+$/;
const SOCIAL =
  /(^|\.)(facebook|fb|instagram|t|x|twitter|linkedin|reddit|youtube|pinterest|whatsapp|wa|threads|tiktok|telegram|lnkd)\.[a-z.]+$/;

function word(value: string | null | undefined, max: number): string | null {
  if (value == null) {
    return null;
  }
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
  return clean === "" ? null : clean;
}

function host(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  let name = value.trim().toLowerCase();
  // Accept a whole URL too, and keep only its host.
  try {
    if (name.includes("/")) {
      name = new URL(name.includes("://") ? name : `https://${name}`).hostname;
    }
  } catch {
    return null;
  }
  name = name.replace(/^www\./, "").replace(/^m\./, "");
  return /^[a-z0-9.-]{1,64}$/.test(name) && name.includes(".") ? name : null;
}

/**
 * The origin of one visit. `ownHost` is this site's own host, so moving
 * between our own pages never reads as a referral.
 */
export function visitOrigin(clues: VisitClues, ownHost: string): VisitOrigin {
  const source = word(clues.source, 64);
  if (source != null) {
    return {
      source,
      medium: word(clues.medium, 32) ?? "(none)",
      campaign: word(clues.campaign, 64) ?? "(none)",
    };
  }
  const from = host(clues.referrer);
  const own = host(ownHost) ?? ownHost;
  if (from == null || from === own || from.endsWith(`.${own}`)) {
    return DIRECT;
  }
  const medium = SEARCH.test(from)
    ? "search"
    : SOCIAL.test(from)
      ? "social"
      : "referral";
  return { source: from, medium, campaign: "(none)" };
}

/** The cookie that carries an origin to the moment an account is made. */
export const ORIGIN_COOKIE = "kl_src";
/** Thirty days: a parent who comes back next week still counts. */
export const ORIGIN_COOKIE_SECONDS = 30 * 24 * 60 * 60;

export function encodeOrigin(origin: VisitOrigin): string {
  return [origin.source, origin.medium, origin.campaign]
    .map(encodeURIComponent)
    .join("|");
}

export function decodeOrigin(value: string | null | undefined): VisitOrigin {
  if (value == null || value === "") {
    return DIRECT;
  }
  const parts = value.split("|");
  if (parts.length !== 3) {
    return DIRECT;
  }
  try {
    const [s, m, c] = parts.map((p) => decodeURIComponent(p));
    // Re-cleaned on the way in: a cookie is as writable as a link.
    const source = word(s, 64);
    if (source == null) {
      return DIRECT;
    }
    return {
      source,
      medium: word(m, 32) ?? "(none)",
      campaign: word(c, 64) ?? "(none)",
    };
  } catch {
    return DIRECT;
  }
}
