# Handover: outstanding work (26 Sep 2026)

Moving from local multi-agent sessions to cloud coding. Everything below is
committed and pushed. Repos and branches:

| Repo | Branch |
|---|---|
| keylearn | `redesign-shell` |
| quakka-support-desk (QDesk) | `empathy-gateway-scoring-and-compassion` |
| support-desk-agent (Tab) | `work-orders-and-eval` |
| StudyBuddy | `platform-bridge-integration` |
| platform | `platform-bridge-integration` (local only, no remote) |

## Done in this pass (for context)

A full e2e test-and-fix pass across KeyLearn, QDesk, Tab and their connection:
- security fixes;
- privacy (masked PII, reason-gated reveal, no-PII push);
- certificates judged and keystroke-proctored on the server, surviving account deletion;
- the org-tier pricing copy;
- phone layouts (QDesk option A; the KeyLearn account window option A);
- floating layers that are never clipped;
- the Arabic-script font fix;
- test tickets excluded from stats;
- the transport https guards;
- guards on StudyBuddy's seed scripts.

Findings live on the owner's machine in the session scratchpad (`e2e/findings/*.md`).

## Outstanding: engineering

1. **QDesk Answers page: icon-only buttons.** New article, New rule and Import a file become icon-only, following the thread-toolbar style (`ToolButton`/`Icon*` in `ThreadPage.tsx`). Each keeps an aria-label and a tooltip with the old text, and New rule keeps its disabled state. File: `packages/app/lib/AnswersPage.tsx`. May be partly started; check the diff.
2. **QDesk modal sweep.** Click every button that opens a dialog and confirm each opens (one had `display:none` from a dead class; see the qdesk-dead-class-audit memory). Also check Esc and focus.
3. ~~KeyLearn verify keys/keystroke~~ **Done:** there's no mismatch. The DB stores `keys`, the API maps it to `keystroke`, and the page checks `keystroke`; verified in a browser for adult, kids and braille.
4. ~~Kids/braille sittings~~ **Done:** both pass end to end in a browser, and 8 of 8 forgeries are refused. **Open UI decision:** a kid who finishes the passage before the bell has nothing more to type.
5. **Account window at phone width:** a final visual check of every section at 390px (Security buttons and learner rows were just fixed).
6. **Kids, not yet browser-checked** (all committed; last commit `b6270677`, file `packages/page-kids/lib/world.ts` unless noted):
   - Kuttichathan in **lesson 38** at night (`tickStay`). Lesson 37 is checked. Run the night probe on 38 and confirm he appears after dark, on the rail, deck or island only.
   - Time Keepers lesson length for the **11+ band** (`KidsPage.tsx`, `fitPassageToRoad` in `run-length.ts`). 5–6, 7–8 and 9–10 are checked; 11+ opens Classic by default, so seed prefs `{classic:false}`.
   - Loader-to-picker handover: about 80 ms of overlap remains (`kids.module.less`, `.loadingOut` and `.pickerIn`); optional polish.
   - Check the rest of the chapter 3–4 Kuttichathan areas at night (lessons 24, 28, 32, 35); 27 and 36 are checked.

## Outstanding: owner actions

- **Drop the QDesk stash:** `git -C quakka-support-desk stash drop stash@{0}`. It's fully superseded; a patch backup exists on the owner's machine.
- **StudyBuddy:** if `seedSupportAdmin` ever ran on a deployed DB, rotate the password of `admin@studybuddy.support`.
- **HSTS** at the reverse proxy.
- **QDesk in production:** `npm ci && npm run compile && npm run build`, then `NODE_ENV=production node --enable-source-maps ./dist/index.js`. Build and restart together.
- **Live Tab services:** restart the Tab launchd services so they pick up the transport guard (`launchctl kickstart -k gui/$(id -u)/com.keylearn.support-triage` and `…support-worker`).
- **Release walkthrough checklist:** not yet written.

## Rules that matter (learned the hard way)

- **KeyLearn builds:** use `npm run build` (production) only. KeyLearn's test and live share `root/public`, so a build breaks the running server's assets until it restarts.
- **Boot-time migrations:** a KeyLearn/QDesk restart can apply them (certificate rebuild, stored-times normaliser, `log_hash`, `is_test`). Back up the DB first.
- **npm:** never run `npm audit fix --omit=dev`; it prunes devDependencies.
- **QDesk `npm test`:** it's safe now, because seed-answers runs with `--check`. Seeding is a deliberate `node scripts/seed-answers.mjs`.
- **Owner decisions** (settled; don't re-ask):
  - QDesk mobile option A with the logo header;
  - KeyLearn account window option A;
  - certificates verifiable after deletion;
  - PII reveal needs a reason;
  - push carries no PII;
  - individuals are free and organisations are licensed per seat.
