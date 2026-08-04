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
