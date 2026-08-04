/**
 * Whether an ad may be shown on this page, to this learner.
 *
 * Ads are for grown-ups. A child must never be shown one, and "child" has to
 * be decided from what the app actually knows right now — the page being
 * viewed and the learner who is signed in to it — not from a remembered
 * preference.
 *
 * The stored `keylearn.mode` flag alone was not that. It is written only when
 * somebody uses the drawer's grown-ups/kids switch, so for a household that
 * has never touched it the flag is absent, and for one that switched back
 * once it is stale — either way the kids page rendered an ad slot beside a
 * five-year-old. It is still consulted, as a household's stated preference,
 * but it can only take ads away, never grant them.
 *
 * Every unknown resolves to "no ad": no ad network configured, storage
 * unavailable, profile not loaded yet. An ad-free grown-up page costs a
 * little revenue; an ad beside a child is a different kind of problem.
 */
export function showAds({
  adNetworkConfigured,
  path,
  activeProfileKind,
  storedMode,
}: {
  /** False in development and self-hosted builds, which load no ad script. */
  readonly adNetworkConfigured: boolean;
  /** The route being rendered. */
  readonly path: string;
  /** The signed-in learner's kind, or null when none is selected. */
  readonly activeProfileKind: string | null;
  /** The household's remembered mode, or null when unset or unreadable. */
  readonly storedMode: string | null;
}): boolean {
  if (!adNetworkConfigured) {
    return false;
  }
  // The kids page is a child's page whoever happens to be signed in.
  if (path === "/kids") {
    return false;
  }
  // And a child learner stays ad-free wherever they are.
  if (activeProfileKind === "kid") {
    return false;
  }
  if (storedMode === "kids") {
    return false;
  }
  return true;
}
