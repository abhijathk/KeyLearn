// The support desk's own version, separate from KeyLearn's own
// (`@keylearn/page-static`'s `APP_VERSION`) — two different products now,
// each on its own release cadence. Bumped by hand alongside this file,
// same convention as the learner app's `release-notes.ts`.
export const DESK_APP_VERSION = "01.00.00";

export type DeskReleaseNote = {
  readonly version: string;
  /** ISO date string. */
  readonly date: string;
  readonly changes: readonly string[];
};

// Newest first.
export const DESK_RELEASE_NOTES: readonly DeskReleaseNote[] = [
  {
    version: "01.00.00",
    date: "2026-08-17",
    changes: [
      "Ops Grid dashboard: attention card, signup trend with range and smoothing, tab automation stats, geo and language breakdowns.",
      "Confirmation dialogs for requesting or cancelling an account deletion, with a required reason on both.",
      "Account deletion emails now send through the same mailer as everything else, instead of only logging.",
      "Live site notices no longer show on the desk itself — the desk only ever sees the preview of what it's about to publish.",
      "Independent day/night theme: switching the desk's appearance no longer changes the learner-facing app's, and vice versa.",
      "A dedicated internal API for the separate ops app to reach the desk's account and staff-auth actions without sharing a database.",
    ],
  },
];
