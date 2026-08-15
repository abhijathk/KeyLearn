# Changelog

Every notable change is recorded here, newest first. This is the source
document for the in-app release notes shown from the About page — keep
`packages/page-static/lib/release-notes.ts` in sync whenever this file
changes.

## 01.03.00 — 2026-08-15 09:05 UTC

### Added

- A "made for a bigger screen" message that now shows in place of the app on
  phones and other screens narrower than 640px, instead of a keyboard and
  practice layout that never had room to work there.

## 01.02.00 — 2026-08-15 06:40 UTC

### Added

- A contact card on the About page's Version section, linking to
  `support@keylearn.org`.
- A real banner image (light and dark) on the "Create a free account"
  prompt, replacing its plain wordmark header.

### Fixed

- `support@keylearn.org` can now receive mail. MX, SPF, and DKIM records
  published for the domain via an existing Google Workspace subscription;
  the address was previously advertised in the footer and privacy policy
  but bounced everything sent to it.

## 01.01.01 — 2026-08-15 01:38 UTC

### Fixed

- The "your alphabet" progress grid on the practice recap card could grow
  taller than the cards next to it for scripts with 50+ letters, since tile
  size was fixed and only row count scaled with the alphabet. Column count
  now scales with letter count instead, keeping a fixed height and shrinking
  the tiles for larger alphabets.
- The full-screen loading indicator shown while a page's code loads used a
  0.28s fade-in on top of its 0.2s hold-off delay, so it wasn't fully visible
  until 0.48s after a page change — a load finishing anywhere in that window
  showed a barely-visible flicker rather than a readable loading state. The
  fade is now 0.12s, so it reaches full visibility by 0.32s.

### Internal

- Added `npm run check-changelog`, wired into CI, which fails the build if
  `APP_VERSION`, `release-notes.ts`, and this file's versions/dates ever
  drift out of sync.

## 01.01.00 — 2026-08-15 00:21 UTC

### Added

- A brief "why support" dialog before the header coffee link hands off to
  Buy Me a Coffee, instead of navigating straight out.
- A "Support KeyLearn" section on the About page, with the Buy Me a Coffee
  link moved there from the navigation menu.
- In-app release notes, linked from the About page's Version section.

### Fixed

- Two-step verification setup never actually showed a scannable QR code —
  only the raw secret key and an "open in authenticator app" link. Added
  the missing QR code, verified end-to-end with a real generated code.
- Signing in with a different linked provider (e.g. Facebook after Google)
  could leave an old provider's name and picture stuck in place — whichever
  provider was linked first always won, rather than whichever was most
  recently used to sign in.
- The About page credited itself as its own origin ("a fork of the
  open-source keylearn engine") instead of the real upstream, keybr.

### Performance

- The kids page's dino-run world (and the three.js library it depends on)
  was loading on every single page — including adult practice sessions that
  never visit `/kids` — due to a shared icon import pulling in the whole
  package. Now isolated to its own on-demand chunk.
- The User Guide's 54 language translations were all bundled together and
  shipped with every About/Terms/Privacy/Accessibility/Guide page load,
  regardless of which one language was active. Each locale now loads only
  when it's actually needed.

## 01.00.00 — 2026-08-14 00:00 UTC

- First public release.
