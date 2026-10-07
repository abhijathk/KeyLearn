# Changelog

Every notable change is recorded here, newest first. This is the source
document for the in-app release notes shown from the About page — keep
`packages/page-static/lib/release-notes.ts` in sync whenever this file
changes.

## 02.01.00 — 2026-10-06 23:16 UTC

### Added

- **Time Keepers**: the seven-shop market row with wooden shutters, each
  shop on its own hours (the tea shop opens at 6); new v2 houses in all
  four chapters, facing the road on levelled plots; a day voice and a
  night voice; Kuttichathan confined to his own lessons and kept away from
  sacred places.
- **Hero Trail / Dino Run**: bog boardwalk, landmarks in view, mist, frost
  and seasons; Dino Run landmarks and rain; bigger cast; the companion
  grows with the player.
- Kids-page PIN: optional PIN to leave the kids page (Account → Security),
  confirmed on and off.
- Guests on Guided practice and the KeyLearn keyboard; other choices are
  locked, with a notice inside the settings window.
- Round Graphite default for account holders; black legends on its yellow
  keys.
- Passkey step-up ("confirm it's you"); the owner is emailed and notified
  when an account deletion is cancelled.
- Support: closure notices with a return date; human check before sending.
- Control Centre: a switch for the learner's own progress page
  (`pages.profile.state`); the Practice menu link follows its switch.

### Changed

- Kids game and background sounds default to off.
- The first-run tour shows once per browser; nothing floats on the page a
  sign-out lands on.
- Kids loading: the picker opens in seconds instead of after the whole
  village; villagers 38% smaller on the wire.
- The support desk (QDesk) is served at keylearn.org/desk.
- Translations: 29 new interface messages and the User Guide's Getting
  help section plus nine updated sections, in all 53 other languages.
  The kids and practice pages stay English.

### Changed after release (7 Oct)

- A page switched off in the Control Centre is off for admins too. An admin
  checks one with `?preview` on its address. It had stayed visible to an
  admin, so switching Multiplayer off seemed not to work.
- Live: the leftover `MULTIPLAYER_ENABLED=false` was removed from the
  server env, so the Control Centre switch drives Multiplayer.

### Fixed

- MySQL: learner progress snapshots over 64 KB failed to save
  (`profile_data.payload` is now LONGBLOB); the QDesk outbox never marked
  a row delivered, and four desk dashboard figures read undefined, because
  raw rows come back camelCase on MySQL.
- The outbox index name was 65 characters, over MySQL's limit.
- Hero Trail no longer hatches eggs; it has its own companion.
- The kids-page PIN confirm dialog rendered message ids: its messages
  were never extracted for translation.
- 2FA recovery codes share the per-account lockout.
- The tea shop is lit at night; nothing grows inside the market.

## 02.00.00 — 2026-10-03 11:49 UTC

First recorded 7 Sep 2026; updated 3 Oct 2026 with everything shipped since.

### Added since 7 Sep

- **Time Keepers**, a new world in the kids game.
- **Hero Trail and Dino Run**: new characters and new places to explore.
- Classic practice moved to Play in the kids settings (ages 9-13).
- Kids assets content-addressed, compressed and kept on the device.
- App language follows the account; every learner syncs, offline too.
- Grown-up PIN before a kid switches to a grown-up profile.
- Reminder emails follow Preferences; guests can export kids' practice;
  the importer takes KeyLearn exports and kid profiles.
- Multiplayer shows words per minute.

### Changed since 7 Sep

- **Licensing**: Time Keepers' assets (models, textures, horizon, faces,
  cards, sounds and logo) are the AK 3D Pack, commercially licensed and
  not AGPL. They moved out of this repository into a private one and are
  merged in for production by `scripts/ak-pack-merge.mjs`. The About page
  says so. Hero Trail and Dino Run stay AGPL.
- Screen readers: named inputs, switches, pickers and progress bars, and
  the chosen option is announced.
- Default themes meet WCAG AA text contrast.
- Plain wording when a passkey prompt is cancelled.
- The remaining UI strings are translated into all 54 locales.
- HSTS at the reverse proxy; rate limits hold across workers.

### Fixed since 7 Sep

- The keystroke that ends a typing test discarded its report.
- Account export returned 500 for every account, and logged the ops key.
- The keyboard died after a new letter was woken, until a reload.

A major version: support moved inside the app, every learner can have
their own voice, what they set follows them between devices, and all 54
languages are complete.

### Added

- **Support inside KeyLearn.** A Support pane in the account window:
  write to us, read replies in a conversation of your own, attach a
  screenshot, and say whether a reply helped. Only a grown-up profile can
  write to us. Tickets are forwarded to the support desk and replies come
  back to the same conversation.
- **A help centre**, publishing the same articles the support team
  answers from.
- **Notifications** for the things a learner cannot discover on their
  own — a reply, a change to a conversation, a notice from us — carried
  on the header's bell.
- **A reading voice per learner**: real neural voices, named, and the
  same on every platform rather than whatever the browser offered.
- **Five keyboard styles** to practise on, chosen in Settings: KeyLearn,
  Flat Silver, Flat Midnight, Mechanical (tall sculpted caps, two-tone
  keyset, per-key RGB) and Round (K380-inspired circular caps, six
  colourways, one warm light).
- **Rainbow, a second finish for the kids keyboard** — green frame, red
  numbers and punctuation, blue alphabet, vowels a lighter blue, and signs
  rather than words on the frame keys, so it reads for a band that cannot
  read "enter" yet.
- **Five text sizes** in place of three, scaling the whole app rather
  than only body text.
- **A face and a voice for every learner by default**, so a new profile is
  usable without setting anything up — the previous defaults ("this
  device's own voice", no avatar) were defaults nobody had chosen.
- **The kids world is announced to a screen reader**: it now has an
  accessible name and says where in the world the learner is, rather than
  being a silent canvas beside the lesson text.
- **Virus scanning on support attachments.** Files are scanned before
  they are stored; an unreachable scanner refuses the file rather than
  keeping it unchecked.
- Organisations, behind an invitation while the tier is finished: a
  coordinator's desk, bulk invites, and learner and staff panes. The
  public offering stays hidden until the tier ships.

### Changed

- **What a learner sets follows them.** Accessibility settings, voice,
  theme and the rest are carried between devices instead of living in one
  browser's storage.
- **All 54 languages complete**, including the newest support and
  settings text, and weekday names now inflect in the thirteen languages
  that need it.
- One grown-up PIN gate across the app; a clearer security reset; two-step
  setup opens on the QR code rather than behind a second button.
- Resolved is final — a later reply starts a new conversation rather than
  reopening a closed one — and a learner can end their own conversation
  whenever they want.
- The header's icons, the keycaps' finish and the pointer trail were all
  brought onto one set of rules.

### Fixed

- An account could deadlock on its own transaction while being created.
- A star left with no words now counts as feedback, so the figures and
  the page agree.
- Multiplayer is genuinely closed by `MULTIPLAYER_ENABLED=false`, not
  just hidden from the menu.
- Real pages for a narrow screen and for an unreachable support desk,
  instead of a broken layout or a bare error.

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
