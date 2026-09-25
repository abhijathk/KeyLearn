import { DESK_SESSION_HEADER } from "./desk-session.ts";
import { releaseDevice } from "./device-release.ts";
import { getPageData } from "./pagedata.tsx";

/** The longest sign-out waits on handing the device back, before going anyway. */
const RELEASE_BUDGET_MS = 4000;

/**
 * Signs out and returns to the given page.
 *
 * Sign-out is a POST rather than a link. With a `SameSite=Lax` session cookie a
 * GET endpoint still receives the cookie on any top-level navigation, so a
 * plain `/auth/logout` link can be triggered by any third-party page that
 * embeds it — harmless in isolation, but it lets someone else decide when a
 * user's session ends.
 *
 * `desk: true` ends the support desk's own session (a separate cookie from
 * the signed-in learner's, see `deskAwareSession`) — the two doors sharing
 * this one endpoint is exactly why the marker header exists.
 */
export async function logout(
  returnTo: string = "/",
  desk: boolean = false,
): Promise<void> {
  if (!desk) {
    // Before the session ends: the checks behind it need the account.
    await releaseHousehold();
  }
  try {
    await fetch("/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(desk ? { [DESK_SESSION_HEADER]: "1" } : {}),
      },
      // Send the session cookie, and mark this same-origin so the server's
      // cross-site guard sees a first-party request.
      credentials: "same-origin",
      body: "{}",
    });
  } finally {
    // Navigate regardless: if the request failed the session may still be live,
    // and landing on a fresh page load is the clearest signal of what happened.
    window.location.href = returnTo;
  }
}

/**
 * Takes this household's learners off the device, keeping only what the
 * account does not yet hold (see device-release.ts). Bounded: a slow network
 * delays sign-out by a few seconds at most, and then the device keeps
 * everything rather than risk dropping something half-sent.
 */
async function releaseHousehold(): Promise<void> {
  let ids: string[] = [];
  try {
    const data = getPageData();
    if (data?.user == null) {
      return;
    }
    ids = data.profiles.map((profile) => String(profile.id));
  } catch {
    return;
  }
  let expired = false;
  await Promise.race([
    releaseDevice(ids, () => expired).catch(() => {}),
    new Promise<void>((resolve) =>
      setTimeout(() => {
        expired = true;
        resolve();
      }, RELEASE_BUDGET_MS),
    ),
  ]);
}
