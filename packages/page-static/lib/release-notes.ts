export type ReleaseNote = {
  readonly version: string;
  /** ISO 8601 with time — shown localized in the release notes dialog. */
  readonly date: string;
  readonly changes: readonly string[];
};

// Newest first — prepend new entries here. Mirrors CHANGELOG.md at the repo
// root, which is the source document; keep the two in sync by hand. Kept as
// plain English rather than react-intl catalog entries deliberately: this is
// fast-moving internal changelog copy, not the app's core translated
// surface, and 54-locale translation churn on every release isn't worth it.
export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: "01.01.00",
    date: "2026-08-15T00:21:00Z",
    changes: [
      "Added a brief note explaining why to support KeyLearn before the coffee link opens Buy Me a Coffee, and moved that link to the About page.",
      "Fixed two-step verification setup, which never actually showed a scannable QR code.",
      "Fixed profile pictures and names not updating correctly when signing in with a different linked provider (e.g. Facebook after Google).",
      "Fixed the About page crediting itself as its own origin instead of the real one, keybr.",
      "Faster page loads: the kids page's graphics no longer load on every page, and the User Guide's 54 languages now load one at a time instead of all together.",
    ],
  },
  {
    version: "01.00.00",
    date: "2026-08-14T00:00:00Z",
    changes: ["First public release."],
  },
];
