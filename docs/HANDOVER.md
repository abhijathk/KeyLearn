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
3. **KeyLearn verify: "keys" vs "keystroke".** New certificates store evidence `"keys"`; the verify API was reported to return `"keystroke"`, and `/verify` shows the "Keystroke-checked" note only for `"keys"`. Confirm with a real proctored certificate. If they differ, share one constant (packages `keylearn-certificate`, server certificate controller, `keylearn-pages-browser/lib/pages/verify.tsx`), and add tests for the API response and the rendered note.
4. **Kids and braille certificate sittings:** drive them end to end in a browser (they're only unit-tested). The latest fixes: braille progress pulled before eligibility, braille sitting cells not recorded as practice, kids passages not counted twice.
5. **Account window at phone width:** a final visual check of every section at 390px (Security buttons and learner rows were just fixed).

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
