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

- [x] A host that runs a **persistent Node process with a real disk**. Sessions
      (`FileStore`), learner results, and `certificate.key` are all files under
      `DATA_DIR`. Serverless platforms with ephemeral storage lose all three.
      Hetzner CX23 (2 vCPU/4GB, Nuremberg) provisioned 2026-08-14 —
      `46.224.186.58`, Ubuntu 26.04, key-only SSH, UFW (22/80/443 only),
      `unattended-upgrades` confirmed active, Node 24.19.0 installed.
- [ ] Decide the app's hostname. `keylearn.org` currently resolves to Squarespace
      (`198.49.23.145`), so either the app gets a subdomain or that DNS moves.
      Decided: apex domain, DNS moving to Cloudflare. In progress — Cloudflare
      zone created, all records (A, both Brevo DKIM CNAMEs, the Brevo
      link-tracking CNAME, `www`, SPF/DMARC/verification TXT) verified correct
      and left **unproxied** for now. DNSSEC was enabled at Squarespace and had
      to be disabled and confirmed cleared from the `.org` registry (DS record)
      before switching nameservers, or the domain could have gone fully
      unresolvable — confirmed cleared 2026-08-14 via direct trace to the
      `.org` registry plus 3 independent resolvers. Nameservers switched to
      `huxley.ns.cloudflare.com` / `kay.ns.cloudflare.com` at Squarespace
      2026-08-14 2:47pm, confirmed saved by Squarespace; propagation in
      progress (registry still showing the old Squarespace nameservers as of
      this note — normal, can take up to 48h).
- [ ] Reverse proxy (nginx) terminating TLS and forwarding `/_/game/` to the game
      worker. `GAME_URL` is then left **empty** so the browser uses its own origin.
      nginx + Certbot installed 2026-08-14; reverse-proxy config live
      (`/` → `127.0.0.1:4000`, `/_/game/` → `127.0.0.1:4001` with upgrade
      headers), confirmed responding (502, correctly, since nothing is
      deployed upstream yet). HTTP only so far — TLS needs Certbot, which
      needs `keylearn.org` to actually resolve here, which is blocked on the
      DNS item above.
- [ ] Process supervision (systemd). Confirm a restart leaves exactly **one**
      master running — several masters can bind the same port simultaneously and
      serve stale code from whichever one wins a given request.
      Unit installed at `/etc/systemd/system/keylearn.service` 2026-08-14:
      runs as a dedicated `keylearn` system user (not root), loads
      `/etc/keylearn/env` directly via `EnvironmentFile=`, `KillMode=control-group`
      so a restart can't leave orphaned cluster workers behind. Not yet
      enabled/started — no app code deployed, no database, no real env values
      yet, so starting it now would just crash-loop. The "confirm a restart
      leaves exactly one master" behavior is unverified in practice until then.
- [ ] Cloudflare in front for DNS/TLS/CDN is a good fit. Keep every mail record
      **unproxied** (grey cloud); proxying an MX host breaks delivery.
      Cloudflare zone exists with all records unproxied (see hostname item
      above) — this is the same in-progress migration, not a separate task.

## 2. Database

- [x] Provision **MySQL 8**. `knex.ts` supports only `mysql` and `sqlite`; SQLite
      under five worker processes will contend on writes.
      MySQL 8.4.10 installed on the app host itself 2026-08-14 (Ubuntu
      package default), bound to `127.0.0.1` only — not reachable off-box,
      UFW doesn't even open 3306. Verified already-secure defaults (no
      anonymous users, no `test` database, `root` is socket-auth-only, no
      password/remote root login possible). Created a dedicated `keylearn`
      database and a `keylearn`@`localhost` user scoped only to that one
      database (generated password, stored root-readable-only at
      `/etc/keylearn/db-password` on the server, not in this repo).
      Connectivity verified: connects, sees only its own database plus the
      universally-visible `information_schema`/`performance_schema`, no
      access to the `mysql` system database.
- [ ] Set `DATABASE_CLIENT=mysql` plus `DATABASE_HOST`, `DATABASE_PORT`,
      `DATABASE_DATABASE`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`.
      **⚠** currently `sqlite`. Done — written into `/etc/keylearn/env` on
      the server 2026-08-14 along with the rest of Section 3, see below.
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

- [x] **⚠** `APP_URL=https://<host>/` (currently `http://localhost:4000/`).
      This is the single highest-impact value: every emailed link and both OAuth
      redirect URIs are derived from it.
      Set to `https://keylearn.org/` 2026-08-14.
- [x] **⚠** `COOKIE_SECURE=true` and `COOKIE_DOMAIN=<host>` (or leave
      `COOKIE_DOMAIN` unset for a host-only cookie, which is usually what you
      want). Development sets these to `false`/`localhost`, which is correct
      there and unsafe in production. Enforced at startup.
      `COOKIE_SECURE=true` set, `COOKIE_DOMAIN` left unset (host-only cookie,
      single origin, no `www` in play) — matches the doc's own recommendation.
- [x] **⚠** `TRUSTED_PROXIES=loopback` when behind nginx (currently empty,
      which is correct only for a directly-exposed server).
      Rate limiting and the adaptive CAPTCHA key on the client address; behind a
      proxy with this unset, every visitor shares the proxy's address and the
      limits apply to all of them collectively. Set it *only* as wide as the
      proxies you actually run — a client that can forge `X-Forwarded-For`
      bypasses both protections.
      Set to `loopback`, correct for the current single-proxy chain (nginx
      only, on the same host). **Revisit this** if/when the Cloudflare `A`/`www`
      records get flipped from DNS-only to Proxied later — that adds a second
      proxy hop in front of nginx, and either nginx needs its `real_ip` module
      configured to trust Cloudflare's IP ranges and rewrite to the true
      client IP, or the client-IP logic breaks.
- [x] `DATA_DIR` on the persistent volume, not a home directory.
      Set to `/var/lib/keylearn` — the local SSD, owned by the dedicated
      `keylearn` system user, matching the systemd unit's `ReadWritePaths`.
- [x] `NODE_ENV=production`.
      Set directly in the systemd unit's `Environment=` line (not the env
      file) — it has to be known before the app can even decide which env
      file variant to probe, so it can't live in the file it's used to select.
- [x] `MULTIPLAYER_ENABLED=false` until live practice is finished.
      Set explicitly (matches the dev default already, but stated explicitly
      for a production file rather than relying on an implicit default).
- [x] `CERTIFICATE_SECRET` — leave unset for a single server (a key is generated
      into `DATA_DIR/certificate.key`). Set it explicitly **before issuing any
      certificate** if more than one machine will issue them; changing it later
      changes every certificate's number.
      Left unset, as recommended — single server. Same treatment given to
      `TOTP_ENCRYPTION_KEY` (added this session, not in the original doc,
      same single-server reasoning).
- [ ] `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` — the adaptive CAPTCHA is
      disabled entirely while the secret is unset. Worth enabling on a public
      deployment.
      Left blank for now — needs a Turnstile widget created in the Cloudflare
      dashboard to get real keys. Optional, safe to add later since the
      feature just stays off until set.
- [x] `BREACH_CHECK=true` (already the default).
      Set explicitly in the file for the same reason as `MULTIPLAYER_ENABLED`.

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
