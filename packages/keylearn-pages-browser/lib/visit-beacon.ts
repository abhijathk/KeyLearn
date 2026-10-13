import { expectType, request } from "@keylearn/request";

const TAGS = ["utm_source", "utm_medium", "utm_campaign"] as const;

/**
 * Tells the server where this visit came from, once per page load.
 *
 * Only the campaign words in our own address and the host of the page that
 * linked here are sent; the server keeps a daily count per source and
 * nothing about the visitor (see server/lib/app/visits). The campaign words
 * are then taken out of the address bar, so a link copied from it does not
 * credit the same campaign again.
 */
export function sendVisitBeacon(): void {
  try {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    let referrer: string | null = null;
    try {
      referrer = document.referrer ? new URL(document.referrer).host : null;
    } catch {
      referrer = null;
    }
    const input = {
      source: params.get("utm_source"),
      medium: params.get("utm_medium"),
      campaign: params.get("utm_campaign"),
      referrer,
    };
    request
      .use(expectType("application/json"))
      .POST("/_/visit")
      .send(input)
      .catch(() => {
        // A counter must never trouble the page.
      });
    if (TAGS.some((tag) => params.has(tag))) {
      for (const tag of TAGS) {
        params.delete(tag);
      }
      window.history.replaceState(window.history.state, "", url.toString());
    }
  } catch {
    // Nothing here is worth an error on screen.
  }
}
