// Telling a learner they can sit for their certificate, once.
//
// This lives here rather than in the practice page because the judgement
// belongs to the course: `assess` and the evidence builder are already here,
// and the practice page has no other reason to know what a certificate is.
// What the practice page contributes is the moment — it is where somebody
// actually is when they cross the line, and the Course pane, which is the
// only other place that computes this, is a pane nobody opens to be told
// something they do not yet know.

import { assess, DEFAULT_CRITERIA } from "@keylearn/certificate";
import { type CertificateCriteria } from "@keylearn/certificate";
import { type ProfileDetails } from "@keylearn/pages-shared";
import { type Letter } from "@keylearn/phonetic-model";
import { type Result } from "@keylearn/result";
import { typingEvidence } from "./evidence.ts";

/**
 * Profiles this tab has already asked about.
 *
 * The real record is `profile.exam_announced_at` on the server, which is what
 * makes this once-ever rather than once-per-tab. This set exists only to stop
 * a learner mid-session from posting the same claim after every lesson: the
 * server would answer "already announced" each time, correctly and uselessly,
 * several hundred times an hour.
 */
const asked = new Set<string>();

/**
 * Ask the server to announce, if the evidence looks like it qualifies.
 *
 * Deliberately fire-and-forget and deliberately silent on failure. Nothing
 * here is load-bearing: the certificate is available whether or not the badge
 * appears, the Course pane says so to anyone who looks, and a learner who is
 * mid-lesson should never see a network error about a notification.
 *
 * The client's verdict is a filter, not the decision — the server re-judges
 * with the criteria actually in force. That matters because these two can
 * legitimately disagree: the criteria are versioned and can change under a
 * tab that has been open since before they did.
 */
export function maybeAnnounceEligibility({
  profile,
  results,
  letters,
  criteria,
}: {
  readonly profile: ProfileDetails;
  readonly results: readonly Result[];
  readonly letters: readonly Letter[];
  readonly criteria?: CertificateCriteria;
}): void {
  const id = profile.id;
  if (id == null || asked.has(id)) {
    return;
  }
  // Coverage cannot be judged without an alphabet, and an empty set reads as
  // "nothing learned", which would never qualify anyway — but bailing out
  // here keeps a lesson type that has no letters (a quote, a custom list)
  // from spending a request to be told no.
  if (letters.length === 0 || results.length === 0) {
    return;
  }
  const evidence = typingEvidence(profile, results, letters);
  if (!assess(evidence, criteria ?? DEFAULT_CRITERIA).eligible) {
    return;
  }
  // Marked before the request, not after: a failed request that left this
  // unmarked would retry on the next lesson, which is the loop this set is
  // here to prevent. Missing one announcement is better than a retry storm,
  // and the next tab tries again.
  asked.add(id);
  void fetch(`/_/certificate/eligible/${id}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "typing",
      learned: evidence.learned,
      total: evidence.total,
      settled: evidence.settled,
      volume: evidence.volume,
      daysPractised: evidence.daysPractised,
      elapsedDays: evidence.elapsedDays,
      speed: evidence.speed,
      accuracy: evidence.accuracy,
    }),
  }).catch(() => {
    // See doc comment.
  });
}
