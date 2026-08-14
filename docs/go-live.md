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
- [x] Decide the app's hostname. `keylearn.org` currently resolves to Squarespace
      (`198.49.23.145`), so either the app gets a subdomain or that DNS moves.
      Decided and done: apex domain, DNS moved to Cloudflare. DNSSEC was
      enabled at Squarespace and had to be disabled and confirmed cleared from
      the `.org` registry (DS record) before switching nameservers, or the
      domain could have gone fully unresolvable — confirmed cleared 2026-08-14
      via direct trace to the `.org` registry plus 3 independent resolvers.
      Nameservers switched to `huxley.ns.cloudflare.com` /
      `kay.ns.cloudflare.com` at Squarespace 2026-08-14 2:47pm. Fully
      propagated same day — confirmed via direct trace to the `.org` registry
      and Google/Cloudflare/Quad9/OpenDNS all resolving `keylearn.org` to
      `46.224.186.58` correctly, all mail records (SPF, both Brevo DKIM
      CNAMEs, DMARC) intact.
- [x] Reverse proxy (nginx) terminating TLS and forwarding `/_/game/` to the game
      worker. `GAME_URL` is then left **empty** so the browser uses its own origin.
      nginx + Certbot installed 2026-08-14. Real Let's Encrypt certificate
      issued for `keylearn.org` + `www.keylearn.org` (expires 2026-11-12,
      auto-renewal scheduled by Certbot), HTTP→HTTPS redirect configured by
      Certbot. Live-verified: `https://keylearn.org/` returns 200 with a
      valid cert, plain HTTP redirects to HTTPS, JS/CSS assets load with
      correct MIME types, `/_/game/` proxying configured for the ws worker.
      Auto-renewal itself verified, not just scheduled: `certbot renew --dry-run`
      succeeds, and `snap.certbot.renew.timer` is confirmed active with a
      real next-run time.
      Found and fixed one bug along the way: `@fastr/core`'s `behindProxy`
      mode requires **both** `X-Forwarded-Proto` and `X-Forwarded-Host` — my
      nginx config only set the former, and the app threw a bare 400 on every
      request as a result. Added `X-Forwarded-Host $host;` to both proxy
      blocks.
- [x] Process supervision (systemd). Confirm a restart leaves exactly **one**
      master running — several masters can bind the same port simultaneously and
      serve stale code from whichever one wins a given request.
      Unit installed at `/etc/systemd/system/keylearn.service`: runs as a
      dedicated `keylearn` system user (not root), loads `/etc/keylearn/env`
      via `EnvironmentFile=`, `KillMode=control-group`. Started 2026-08-14 —
      correct process topology (1 master + 4 HTTP workers + 1 game/ws worker).
      Restart tested directly: exactly 1 master process before and after,
      all old PIDs fully replaced, nothing orphaned. Enabled on boot.
- [x] Cloudflare in front for DNS/TLS/CDN is a good fit. Keep every mail record
      **unproxied** (grey cloud); proxying an MX host breaks delivery.
      Zone live (see hostname item above). `A` and `www` flipped to Proxied
      2026-08-14. Live-verified afterward (forcing resolution to Cloudflare's
      edge IP to bypass local DNS caching, which had bitten this exact check
      once already): `server: cloudflare` + a `cf-ray` header present, real
      app content (`<title>Practice</title>`) actually loading through the
      proxy, no redirect loop (0 redirects, single 200), `www` correctly
      redirecting to the apex. Mail-related records (both DKIM CNAMEs, the
      Brevo link-tracking CNAME) correctly left DNS-only.
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
- [x] Run `packages/devenv/lib/initdb.ts` (or `npm run start-docker`, which does
      it) to create the schema. **A plain `npm start` does not apply schema
      changes**, so a new table or column silently does not exist until this is
      run — a fresh empty database is otherwise fine.
      **Do not actually run `initdb.ts` (or `start-docker`, which calls it)
      against production as documented** — it also inserts a hardcoded
      dev-convenience login (`email=user@localhost`, access token literally
      `"xyz"`, printed as a working `/login/xyz` magic link) with no guard
      against `NODE_ENV=production`. Running it against the real database
      would plant a public authentication bypass. Ran `createSchema(knex)`
      directly instead (schema only, skipped the login-request insert) —
      2026-08-14, all 14 tables created and verified via `SHOW TABLES`. This
      is a real gap in the repo's own tooling, worth fixing upstream
      (guard the test-login insert on `NODE_ENV !== "production"`) separately
      from this deploy.
      Also hit and fixed two host-level issues along the way, unrelated to
      the schema itself: MySQL 8.4 disabled the `mysql_native_password`
      plugin by default, which the app's (deliberately legacy) `mysql` npm
      driver requires instead of `caching_sha2_password` — enabled it via
      `/etc/mysql/mysql.conf.d/mysql_native_password.cnf` and switched the
      `keylearn` DB user to it. And `/etc/keylearn`'s directory ownership
      was `root:root` instead of `root:keylearn`, silently blocking the
      `keylearn` OS user from reading its own env file when run directly
      (outside systemd, which reads it as root and never hit this) — fixed.
- [x] Automated backups of the database. Learner history and braille progress
      are snapshotted into `profile_data` every `DATA_SNAPSHOT_MINUTES`, so a
      database backup now carries them — but `DATA_DIR` still holds the working
      copies, the sessions, and `certificate.key`, which the database does not
      have. Back up both.
      Set up 2026-08-14: `/usr/local/bin/keylearn-backup.sh` (`mysqldump` +
      `tar` of `/var/lib/keylearn`, gzip'd, 14-day local retention) run
      nightly at 03:30 UTC via `keylearn-backup.timer`/`.service`. Ran it
      manually to verify — found and fixed one real gap along the way: the
      `keylearn` DB user only had privileges on its own database, and
      `mysqldump` needs the global `PROCESS` privilege too (for tablespace
      metadata) or it errors; granted it. Confirmed the resulting dump has
      real content (28 `CREATE TABLE`/data statements matching the 14
      tables). These backups are **local to the same disk** as the database
      they back up — good enough to survive a bad deploy or accidental data
      loss, not a hardware failure or a compromised host. Worth adding
      off-box storage (Hetzner Storage Box, S3-compatible object storage, etc.)
      before this is a real disaster-recovery story — that needs an account
      decision only you can make.
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

- [x] Google Cloud Console → Credentials: add
      `<APP_URL>auth/oauth-callback/google` as an authorised redirect URI.
      Added 2026-08-14: `https://keylearn.org/auth/oauth-callback/google`,
      alongside the existing `http://localhost:4000/auth/oauth-callback/google`
      for dev. Verified live: hitting `/auth/oauth-init/google` on the
      production site redirects to Google with
      `redirect_uri=https://keylearn.org/auth/oauth-callback/google` — matches
      exactly what's registered. An actual click-through sign-in still needs
      a real Google account and browser, which needs you.
- [x] Meta for Developers → Facebook Login: add
      `<APP_URL>auth/oauth-callback/facebook`.
      Added 2026-08-14: `https://keylearn.org/auth/oauth-callback/facebook`.
      Meta allows `localhost` implicitly, so unlike Google it didn't need a
      separate explicit entry. Verified live the same way as Google: hitting
      `/auth/oauth-init/facebook` on the production site redirects to
      Facebook with `redirect_uri=https://keylearn.org/auth/oauth-callback/facebook`
      — matches exactly. A real click-through sign-in still needs a live
      Facebook account, which needs you.
- [x] Keep the localhost URIs alongside the production ones so development keeps
      working. Done for Google explicitly; Meta covers it automatically.
- [x] Both consoles need a hosted privacy-policy URL before an app can be
      published to external users. Set 2026-08-14. Google's OAuth consent
      screen: home page, privacy policy (`/privacy-policy`), and Terms of
      Service (`/terms-of-service`) links, all live and confirmed reachable.
      Meta's Settings → Basic: same privacy policy and Terms of Service URLs
      — both were still pointing at Meta's own placeholder
      (`https://www.facebook.com/`) until caught and fixed here. Also set
      Meta's required Data Deletion Instructions URL to
      `https://keylearn.org/account`, the actual self-service page where a
      signed-in user can delete their account through any configured factor
      — a stronger answer than pointing at prose in the privacy policy.
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
      **Needs you** — blocked on Section 4's OAuth redirect URIs, which need
      the Google Cloud Console / Meta for Developers, no access from here.
- [ ] Trigger a magic link, a verification code, and an account-deletion code.
      **Open one and check the links point at the production host, not localhost.**
      **Needs you** — this sends real mail and needs an inbox to check the
      link in; didn't want to fire real email or create a live account
      unsupervised. `APP_URL=https://keylearn.org/` is correctly set, so the
      generated links should be right, but that's inference from config, not
      a live-observed link.
- [ ] Complete an account deletion with each configured factor (emailed code,
      passkey, authenticator, password) on a throwaway account.
      **Needs you** — same reasoning as above.
- [ ] Send mail to a Microsoft address (Outlook/Hotmail) as well as Gmail —
      Microsoft enforces DMARC far more strictly.
      **Needs you** — needs a real Microsoft inbox to check.
- [x] Confirm the session cookie carries `Secure` and `HttpOnly`.
      Verified in code (`session.ts`): `secure: Env.getBoolean("COOKIE_SECURE", true)`
      and `httpOnly: Env.getBoolean("COOKIE_HTTP_ONLY", true)`, and
      `COOKIE_SECURE=true` is set in `/etc/keylearn/env`. Didn't observe a
      live `Set-Cookie` header — anonymous homepage browsing doesn't touch
      session state, so no cookie gets issued yet; the flags are enforced
      the moment one is.
- [x] Confirm rate limiting sees real client addresses, not the proxy's.
      Verified live 2026-08-14: nginx's access log shows distinct real
      client IPs per visitor (including background internet scanner traffic
      already probing the box within minutes of going live — harmless,
      correctly 404s, nothing exposed), not a single shared proxy address.
- [x] Visit a missing URL and force an error: both should render the branded
      404 and 500 pages, not framework defaults. Confirmed working on this
      code path in dev earlier (2026-08-14): a live 404 rendered the branded
      `ErrorPage`, and `error-handler.test.ts` exercises the identical
      component for 500. **Now also confirmed live in production**: a
      request to a nonexistent path on `https://keylearn.org/` correctly
      returned the branded "404 - Not Found" page, not a framework default.
- [ ] Practise a lesson end to end and confirm the result is saved and appears in
      the profile.
