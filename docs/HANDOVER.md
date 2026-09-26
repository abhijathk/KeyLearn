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

1. ~~**QDesk Answers page: icon-only buttons.**~~ **Done** (was already in the checkpoint): each keeps its words as aria-label and tooltip, and New rule keeps its disabled state. New article, New rule and Import a file become icon-only, following the thread-toolbar style (`ToolButton`/`Icon*` in `ThreadPage.tsx`). Each keeps an aria-label and a tooltip with the old text, and New rule keeps its disabled state. File: `packages/app/lib/AnswersPage.tsx`. May be partly started; check the diff.
2. **QDesk modal sweep.** *Static pass done (26 Sep, cloud):* no class in `desk.css` hides outright, and the one Tailwind `hidden` near a dialog is the phone drawer's scrim. Export tickets, Send later and the composer's insert windows ignored Esc; fixed (`useModalKeys` in `ui/primitives.tsx`), on QDesk branch `claude/cool-albattani-4odtli`. *Still to do in a browser:* click every opener; QDesk will not build without `@platform/bridge`, which exists only on the owner's machine. Click every button that opens a dialog and confirm each opens (one had `display:none` from a dead class; see the qdesk-dead-class-audit memory). Also check Esc and focus.
3. ~~KeyLearn verify keys/keystroke~~ **Done:** there's no mismatch. The DB stores `keys`, the API maps it to `keystroke`, and the page checks `keystroke`; verified in a browser for adult, kids and braille.
4. ~~Kids/braille sittings~~ **Done:** both pass end to end in a browser, and 8 of 8 forgeries are refused. **Open UI decision:** a kid who finishes the passage before the bell has nothing more to type.
5. ~~**Account window at phone width:**~~ **Done:** all 9 sections plus the list view at 390px, light and dark, English and Arabic: no horizontal scroll, nothing off screen, no page errors. One open design question: on Security, "Add a passkey" is right-aligned (`.rightAction`) and smaller (`.subtleBtn`), while Two-step and Grown-up PIN use the larger left-aligned `.secBtn`. Both are deliberate in the CSS; unify if wanted. a final visual check of every section at 390px (Security buttons and learner rows were just fixed).
6. ~~**Kids, not yet browser-checked**~~ **All done (26 Sep, cloud):** lesson 38 (he arms after dark and stands on the island; 55 spots, all rail, deck or island); lessons 24, 28, 32 and 35 at *deep* night (`?hour=11` then the moon: he only comes out 22:00–04:00, so an evening night is one he never appears in); 11+ lesson 1 walks as two 36–37 character passages, 0→33→64, landing on the milestone; the 80 ms loader overlap is gone (`--after: 300ms`). The `?perf` hook now reports his wait, haunts, routine and deep-night flag, and `__world.hurry()` skips his wait. On a software renderer one game second is about 15 real ones. (all committed; last commit `b6270677`, file `packages/page-kids/lib/world.ts` unless noted):
   - Kuttichathan in **lesson 38** at night (`tickStay`). Lesson 37 is checked. Run the night probe on 38 and confirm he appears after dark, on the rail, deck or island only.
   - Time Keepers lesson length for the **11+ band** (`KidsPage.tsx`, `fitPassageToRoad` in `run-length.ts`). 5–6, 7–8 and 9–10 are checked; 11+ opens Classic by default, so seed prefs `{classic:false}`.
   - Loader-to-picker handover: about 80 ms of overlap remains (`kids.module.less`, `.loadingOut` and `.pickerIn`); optional polish.
   - Check the rest of the chapter 3–4 Kuttichathan areas at night (lessons 24, 28, 32, 35); 27 and 36 are checked.

## Found in the cloud pass (26 Sep)

- **Tab answered a follow-up with the opening answer**, and treated questions about itself as chit-chat. Fixed on Tab branch `claude/cool-albattani-4odtli`: follow-ups are marked as the question for the classifier and drafter, grounding searches the latest message first, and questions about the assistant are answered from `ABOUT_ASSISTANT` (policy.mjs).
- **The crisis script gave generic numbers on any message after the first.** QDesk's append path ignored the ticket's resolved country. Fixed on QDesk branch `claude/cool-albattani-4odtli`.
- **A short opener plus one long paragraph arrived as two bubbles**, the second a wall. The chunker now cuts long plain paragraphs at sentences (same QDesk branch).
- **Not a live bug, but worth knowing:** if the server's learner session (`/_/profiles/{id}/enter`) and the browser's saved learner disagree, every sync call is refused and the kids page crashes. Nothing in the app calls `/enter` today; handle it if a learner-PIN screen is ever added.

## Outstanding: owner actions

- **Drop the QDesk stash:** `git -C quakka-support-desk stash drop stash@{0}`. It's fully superseded; a patch backup exists on the owner's machine.
- **StudyBuddy:** if `seedSupportAdmin` ever ran on a deployed DB, rotate the password of `admin@studybuddy.support`.
- ~~**HSTS** at the reverse proxy.~~ **Done in the repo config** (`root/etc/nginx`): one header on HTTPS, none on HTTP. Copy it to the live proxy and reload.
- **QDesk in production:** `npm ci && npm run compile && npm run build`, then `NODE_ENV=production node --enable-source-maps ./dist/index.js`. Build and restart together.
- **Live Tab services:** restart the Tab launchd services so they pick up the transport guard (`launchctl kickstart -k gui/$(id -u)/com.keylearn.support-triage` and `…support-worker`).
- ~~**Release walkthrough checklist:** not yet written.~~ **Written:** [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md).

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

## Testing still to do (for agents)

None of these were covered in this pass. Run them on an isolated test stack, never on live.

**Test stack recipe.** The script isn't in the repo, so recreate it:
- **KeyLearn:** copy the DB with `sqlite3 .backup`, then run with env overrides. Values set in the environment win over `.env`. Set `SERVER_PORT=4200 SERVER_PORT_WS=4201 APP_URL=http://localhost:4200/`, point `DATA_DIR` and `DATABASE_FILENAME` at the copy, and set `MAIL_TRANSPORT=log` (sign-in links land in the log), `QDESK_URL=http://localhost:4300` and the Cloudflare always-pass Turnstile test keys.
- **QDesk:** set `PORT=4300`, `DATA_DIR` to a copy of `.data`, `KEYLEARN_API_URL=http://localhost:4200`, an empty `QDESK_HANDOFF_WEBHOOK_URL` and `ATTACHMENT_SCAN=off`, and empty the `push_subscription` table in the copy.
- **Ports:** kill by port, never with `pkill -f "keylearn master process"`.

**Untested so far:**
1. **Staff composer reply, live:** send a reply from QDesk's composer on a real thread. The delivery code is covered by the worker path only.
2. **QDesk signed-in performance:** measure inbox, search and dashboard latency with a staff session.
3. **Site-config publish:** needs a passkey step-up, which headless Chrome can't do. Use a virtual authenticator (WebAuthn in CDP) or test it by hand.
4. **Tab's humanlike eval:** `eval:humanlike` uses live Groq and defaults to the live desk. Point it at the test desk and cap the calls.
5. **KeyLearn mail with `requireTLS`:** send one real sign-in email through Brevo (port 587) after deploy, and confirm it arrives.
6. **Tab transport guard on live:** after restarting the launchd services, confirm triage and worker start and pass.
7. **QDesk Answers:**
   - the icon-only buttons once built;
   - the full modal sweep: every dialog opens, and Esc and focus behave;
   - the Import CSV/JSON round trip on the live build.
8. **Account window at 390px:** check every section in light and dark, English and Arabic. The Security buttons and learner-row wrap fixes landed last and are only lightly checked.
9. **Kids:**
   - lesson 38 Kuttichathan at night;
   - chapter 3–4 night areas (lessons 24, 28, 32, 35);
   - Time Keepers lesson length for the 11+ band (seed prefs `{classic:false}`).
10. ~~**Certificates, pending the owner's decision:**~~ **Decided and done (26 Sep):** the next passage comes straight away (not browser-checked: needs an eligible learner). a kid who finishes the passage before the bell gets nothing more to type. Mock it first; the fix goes in the `KidsPage.tsx` finished-line assessment branch (bump `setPassageNonce`).
11. **Regression before release:** *KeyLearn's side is green (26 Sep, cloud):* all 72 test packages pass with `DATABASE_CLIENT=sqlite`, after breaking a widget ↔ pages-shared dependency cycle that stopped `lage` running anything, and fixing two tests (a real network call at teardown, and a text query racing its own panel). `@fastr/fetch` is patched (`patches/`) so an unread, aborted response body is no longer an uncaught "Request aborted" in the page. Still to do:
    - every package's tests, one package at a time;
    - QDesk typecheck (must be 0) and `scripts/*.mjs` with `DATA_DIR` on a copy;
    - agent evals, including `eval:standalone` and `eval:release`;
    - a headless crawl of both apps at 1400 and 390px, light and dark, and in `/ar`.
