import { Pages } from "@keylearn/pages-shared";

/**
 * Every practice drill belongs to exactly one kind of learner. The adult
 * drills are built around watching a line of text move under a caret; the
 * kids page is the same lesson engine wrapped in a game; braille practice is
 * reached by ear and by chord. A learner on the wrong one gets either a page
 * that is unusable for them or a lesson that quietly writes progress into the
 * wrong curriculum.
 */
export type PracticeSurface = "adult" | "kids" | "braille";

const PRACTICE_DRILLS: ReadonlyMap<string, PracticeSurface> = new Map([
  [Pages.practice.path, "adult"],
  [Pages.typingTest.path, "adult"],
  [Pages.kids.path, "kids"],
  [Pages.braille.path, "braille"],
]);

const SURFACE_HOME: Readonly<Record<PracticeSurface, string>> = {
  adult: Pages.practice.path,
  kids: Pages.kids.path,
  braille: Pages.braille.path,
};

/** What a surface decision needs to know about the active learner. */
export type SurfaceProfile = {
  readonly kind: string;
  readonly visionSupport: boolean;
};

/** Which practice surface this learner belongs on. Vision support wins. */
export function practiceSurfaceOf(profile: SurfaceProfile): PracticeSurface {
  if (profile.visionSupport) {
    return "braille";
  }
  return profile.kind === "kid" ? "kids" : "adult";
}

/**
 * Where a learner standing on `pathname` must be sent instead, or null when
 * they may stay.
 *
 * Non-drill pages are never redirected, and with no learner selected
 * (anonymous practice, or the admin between profiles) nothing is restricted.
 */
export function practiceRedirect(
  profile: SurfaceProfile | null,
  pathname: string,
): string | null {
  if (profile == null) {
    return null;
  }
  const drill = PRACTICE_DRILLS.get(pathname);
  if (drill == null) {
    return null;
  }
  const surface = practiceSurfaceOf(profile);
  return drill === surface ? null : SURFACE_HOME[surface];
}

/**
 * Pages a kid profile must never reach, whatever else is true of the
 * request — account settings and profile management, both of which hold
 * the household owner's real name and email, a delete-account control, and
 * an edit action on every profile including the grown-ups'. Unlike a
 * practice drill, there is no "kid version" of these to redirect between;
 * the only right answer is away, to the kids surface.
 *
 * A locked, inert nav link already keeps a kid from clicking through to
 * either page — this exists because a bookmark, a typed URL, or the back
 * button all reach the route directly, bypassing that link entirely.
 */
const KID_RESTRICTED: ReadonlySet<string> = new Set([
  Pages.account.path,
  Pages.profiles.path,
]);

/**
 * Where a kid profile standing on `pathname` must be sent instead, or null
 * when they may stay (including: no learner selected, or the active
 * learner isn't a kid).
 */
export function kidRestrictedRedirect(
  profile: SurfaceProfile | null,
  pathname: string,
): string | null {
  if (profile == null || profile.kind !== "kid") {
    return null;
  }
  return KID_RESTRICTED.has(pathname) ? Pages.kids.path : null;
}
