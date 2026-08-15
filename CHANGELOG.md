# Changelog

Every notable change is recorded here, newest first. This is the source
document for the in-app release notes shown from the About page — keep
`packages/page-static/lib/release-notes.ts` in sync whenever this file
changes.

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

## 01.00.00 — 2026-08-14

- First public release.
