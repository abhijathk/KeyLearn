# Go-live checklist

Ordered roughly by dependency.

The development `.env` is correct **for development** — `COOKIE_SECURE=false` and
`COOKIE_DOMAIN=localhost` are right there and wrong in production. The danger is
shipping that file, not the file itself. Items marked **⚠** are the ones that
differ.

Several of these are now enforced rather than merely listed: with
`NODE_ENV=production`, the primary process runs `checkProductionConfig()` before
forking any worker and **refuses to start** on a localhost or plain-HTTP
`APP_URL`, an insecure cookie, a `COOKIE_DOMAIN` that cannot cover the host, or
`MAIL_TRANSPORT=log`. SQLite and an empty `TRUSTED_PROXIES` are warned about and
allowed. That guard is a backstop, not a substitute for this list — it cannot
know your hostname is the right one.

Confirmed live 2026-08-14, not just by reading the code: booted with a bad
config under `NODE_ENV=production` and watched it log the 3 fatal errors, exit
1, and leave nothing running; booted again with a fully valid config and
watched the same check pass silently. `config-check.test.ts` also passes
(9/9).

## 1. Host

- [ ] A host that runs a **persistent Node process with a real disk**. Sessions
      (`FileStore`), learner results, and `certificate.key` are all files under
      `DATA_DIR`. Serverless platforms with ephemeral storage lose all three.
- [ ] Decide the app's hostname. `keylearn.org` currently resolves to Squarespace
      (`198.49.23.145`), so either the app gets a subdomain or that DNS moves.
- [ ] Reverse proxy (nginx) terminating TLS and forwarding `/_/game/` to the game
      worker. `GAME_URL` is then left **empty** so the browser uses its own origin.
- [ ] Process supervision (systemd). Confirm a restart leaves exactly **one**
      master running — several masters can bind the same port simultaneously and
      serve stale code from whichever one wins a given request.
- [ ] Cloudflare in front for DNS/TLS/CDN is a good fit. Keep every mail record
      **unproxied** (grey cloud); proxying an MX host breaks delivery.

## 2. Database

- [ ] Provision **MySQL 8**. `knex.ts` supports only `mysql` and `sqlite`; SQLite
      under five worker processes will contend on writes.
- [ ] Set `DATABASE_CLIENT=mysql` plus `DATABASE_HOST`, `DATABASE_PORT`,
      `DATABASE_DATABASE`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`.
      **⚠** currently `sqlite`.
- [ ] Run `packages/devenv/lib/initdb.ts` (or `npm run start-docker`, which does
      it) to create the schema. **A plain `npm start` does not apply schema
      changes**, so a new table or column silently does not exist until this is
      run — a fresh empty database is otherwise fine.
- [ ] Automated backups of the database. Learner history and braille progress
      are snapshotted into `profile_data` every `DATA_SNAPSHOT_MINUTES`, so a
      database backup now carries them — but `DATA_DIR` still holds the working
      copies, the sessions, and `certificate.key`, which the database does not
      have. Back up both.
- [x] **Rehearse the restore before you need it**:
      `npx tsnode packages/server-cli/lib/main.ts restore-data --dry-run`, then
      without `--dry-run` against an empty `DATA_DIR`. It refuses to overwrite
      existing files unless `--force`, because a file on disk is newer than any
      snapshot of it. Sessions and `certificate.key` are NOT in the snapshot —
      losing the key changes what every issued certificate number means.
      Rehearsed 2026-08-14 against a disposable `/tmp` directory, not the real
      one: `--dry-run` correctly reported the 5 files it would write with
      correct byte counts; a real run wrote all 5; a second real run correctly
      skipped all 5 as already existing. Worth re-rehearsing once against the
      real production `DATA_DIR` after it exists, but the command itself is
      confirmed to work as documented.

## 3. Configuration

- [ ] **⚠** `APP_URL=https://<host>/` (currently `http://localhost:4000/`).
      This is the single highest-impact value: every emailed link and both OAuth
      redirect URIs are derived from it.
- [ ] **⚠** `COOKIE_SECURE=true` and `COOKIE_DOMAIN=<host>` (or leave
      `COOKIE_DOMAIN` unset for a host-only cookie, which is usually what you
      want). Development sets these to `false`/`localhost`, which is correct
      there and unsafe in production. Enforced at startup.
- [ ] **⚠** `TRUSTED_PROXIES=loopback` when behind nginx (currently empty,
      which is correct only for a directly-exposed server).
      Rate limiting and the adaptive CAPTCHA key on the client address; behind a
      proxy with this unset, every visitor shares the proxy's address and the
      limits apply to all of them collectively. Set it *only* as wide as the
      proxies you actually run — a client that can forge `X-Forwarded-For`
      bypasses both protections.
- [ ] `DATA_DIR` on the persistent volume, not a home directory.
- [ ] `NODE_ENV=production`.
- [ ] `MULTIPLAYER_ENABLED=false` until live practice is finished.
- [ ] `CERTIFICATE_SECRET` — leave unset for a single server (a key is generated
      into `DATA_DIR/certificate.key`). Set it explicitly **before issuing any
      certificate** if more than one machine will issue them; changing it later
      changes every certificate's number.
- [ ] `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` — the adaptive CAPTCHA is
      disabled entirely while the secret is unset. Worth enabling on a public
      deployment.
- [ ] `BREACH_CHECK=true` (already the default).

## 4. Sign-in providers

- [ ] Google Cloud Console → Credentials: add
      `<APP_URL>auth/oauth-callback/google` as an authorised redirect URI.
- [ ] Meta for Developers → Facebook Login: add
      `<APP_URL>auth/oauth-callback/facebook`.
- [ ] Keep the localhost URIs alongside the production ones so development keeps
      working.
- [ ] Both consoles need a hosted privacy-policy URL before an app can be
      published to external users.
- [ ] Microsoft sign-in is deferred — see `deferred.md`. The button stays hidden
      while `AUTH_MICROSOFT_CLIENT_ID` is empty, so nothing breaks by omitting it.

## 5. Mail

- [ ] `MX @ priority 1 → smtp.google.com` once Google Workspace exists, so
      `support@keylearn.org` can receive. **It is printed in the footer and the
      privacy policy today and bounces everything.**
- [ ] SPF must authorise Google as well as Brevo once replies are sent from
      Workspace:
      `v=spf1 include:spf.brevo.com include:_spf.google.com ~all`.
      Without it, DMARC `p=reject` rejects your own replies.
- [ ] Google DKIM published at `google._domainkey`, then *Start authentication*
      in the Admin console.
- [ ] Confirm `brevo1`/`brevo2._domainkey` and `_dmarc` survive any DNS move.

## 6. Verify after deploying

- [ ] Sign in with Google and with Facebook, both a new account and an existing one.
- [ ] Trigger a magic link, a verification code, and an account-deletion code.
      **Open one and check the links point at the production host, not localhost.**
- [ ] Complete an account deletion with each configured factor (emailed code,
      passkey, authenticator, password) on a throwaway account.
- [ ] Send mail to a Microsoft address (Outlook/Hotmail) as well as Gmail —
      Microsoft enforces DMARC far more strictly.
- [ ] Confirm the session cookie carries `Secure` and `HttpOnly`.
- [ ] Confirm rate limiting sees real client addresses, not the proxy's.
- [ ] Visit a missing URL and force an error: both should render the branded
      404 and 500 pages, not framework defaults. Already confirmed working on
      this same code path in dev (2026-08-14): a live 404 rendered the branded
      `ErrorPage`, and `error-handler.test.ts` exercises the identical
      component for 500. Re-check after deploying anyway — this only proves
      the code path, not the production reverse-proxy/error-page config.
- [ ] Practise a lesson end to end and confirm the result is saved and appears in
      the profile.
