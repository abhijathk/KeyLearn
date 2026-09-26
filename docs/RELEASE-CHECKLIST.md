# Release walkthrough checklist

One pass, top to bottom, before anything goes live. Each step says how to
check it, and what "pass" means. Do it on a **test stack** (see
[HANDOVER.md](HANDOVER.md), "Test stack recipe") unless the step says live.

Tick each box as you go; a step that fails stops the release until it is
fixed or consciously waived (write down which, and why).

## 0. Before you start

- [ ] **Back up every database.** KeyLearn: `sqlite3 <db> ".backup <copy>"`.
      QDesk: a copy of `.data`. Restarts can run boot-time migrations
      (certificate rebuild, stored-times normaliser, `log_hash`, `is_test`),
      and there is no undo without the copy.
- [ ] **Branches merged and pushed**, on the commits you mean to ship. Note
      each repo's commit hash here: KeyLearn `____`, QDesk `____`, Tab `____`.
- [ ] **Never** `npm audit fix --omit=dev` (it prunes devDependencies).

## 1. Automated checks (each must be green)

- [ ] **KeyLearn compile:** `npm run compile` — 82 packages, 0 failures.
- [ ] **KeyLearn tests:** `DATABASE_CLIENT=sqlite npx lage test --no-cache --continue`
      — every package passes. (Without `DATABASE_CLIENT=sqlite` the
      database tests look for MySQL and fail to connect.)
- [ ] **KeyLearn build:** `npm run build` (production only; it overwrites
      `root/public`, which a running test/live server shares, so restart
      that server afterwards).
- [ ] **QDesk typecheck:** `npm run compile && npm run typecheck` — 0 errors.
- [ ] **QDesk tests:** `npm test` (safe: seed-answers runs with `--check`).
      Run `scripts/*.mjs` with `DATA_DIR` pointing at a *copy*.
- [ ] **Tab evals (offline):** in `support-desk-agent`,
      `node eval/routing.mjs`, `eval/reply-guards.mjs`,
      `eval/grounding-tenant.mjs`, `eval/booklet-relevance.mjs`,
      `eval/deletion-routing.mjs`, `eval/transport-guard.mjs`,
      `eval/recent-replies.mjs`, then `npm run eval:standalone` and
      `npm run eval:release`. Note that `eval:exemplar-ab` needs live Groq.
- [ ] **Tab evals (live Groq), capped:** `eval:humanlike` pointed at the
      **test** desk, not the live one, with a call cap.

## 2. KeyLearn by hand (test stack)

- [ ] **Sign in** by email link (`MAIL_TRANSPORT=log` puts the link in the
      log) and by password.
- [ ] **Account window** at 1400px and at 390px, light and dark, English and
      `/ar`: every section opens, nothing scrolls sideways, Security's
      buttons all match.
- [ ] **Profiles:** create a kid profile (consent given), switch learners,
      and confirm a kid profile cannot open Account.
- [ ] **Practice, Typing Test, Multiplayer:** one run each; results save.
- [ ] **Kids, Time Keepers:** one lesson per band (5–6, 7–8, 9–10, 11+;
      11+ needs prefs `{classic:false}`). Passages share the 64-unit lesson
      evenly and the last one lands on the milestone.
- [ ] **Kids, night:** with `?perf&hour=11` and the moon, Kuttichathan
      appears in his areas (lessons 4–8, 15–18, 24, 27–28, 32, 35–36) while
      the child walks and while they sit, and on the crossing (37–38) on
      the rail, deck or island only. `__world.kutti()` and
      `__world.hurry()` help on a slow machine.
- [ ] **Certificates:** one adult, one kid and one braille sitting end to
      end; a kid who finishes a passage early gets the next one; a
      certificate still verifies after its account is deleted.
- [ ] **Support:** raise a ticket signed in and signed out; a reply comes
      back split into short messages; an emergency message on a *second*
      turn names the country's own number.

## 3. QDesk by hand (test stack)

- [ ] **Every dialog opens**, and Esc closes it (Export tickets, Send later,
      the composer's insert windows, confirms, the release notes, settings).
- [ ] **Answers:** the three icon buttons (tooltips and names read right,
      New rule disabled with no articles); the **Import CSV/JSON round trip**.
- [ ] **Staff composer reply** on a real thread reaches the customer.
- [ ] **Signed-in performance:** inbox, search and dashboard load quickly
      with a staff session.
- [ ] **Site-config publish** with the passkey step-up (by hand, or a
      virtual authenticator).

## 4. Deploy

- [ ] **QDesk:** `npm ci && npm run compile && npm run build`, then
      `NODE_ENV=production node --enable-source-maps ./dist/index.js`.
      Build and restart together.
- [ ] **KeyLearn:** build, then restart. Watch the boot log for migrations
      and for any `Configuration error:` line; production refuses to start
      with one.
- [ ] **Tab:** restart both services —
      `launchctl kickstart -k gui/$(id -u)/com.keylearn.support-triage` and
      `…support-worker` — so they pick up new code.
- [ ] **nginx:** `nginx -t`, then reload.

## 5. After deploy (live)

- [ ] **HTTPS and HSTS:** `curl -sI https://<site>/ | grep -i strict`
      shows exactly one `Strict-Transport-Security` header;
      `curl -sI http://<site>/` shows none.
- [ ] **Mail:** one real sign-in email through Brevo (port 587,
      `requireTLS`) arrives.
- [ ] **Tab:** triage and worker are running and pass their transport guard
      (the logs show them polling, no guard refusal).
- [ ] **Smoke:** sign in, one practice run, one kids lesson, one support
      ticket, one QDesk reply.
- [ ] **Watch the logs for 15 minutes** for errors that were not there
      before.

## 6. If something is wrong

- Stop the service, restore the database copy from step 0, redeploy the
  previous commit, restart. Note what failed in HANDOVER.md.
