# Security Policy

KeyLearn is used by families and schools, and accounts hold children's names,
birth years and practice history. We take reports about that data seriously.

## Reporting a vulnerability

Please report privately, not as a public issue.

- **Preferred:** open a [private security advisory](https://github.com/abhijathk/keylearn/security/advisories/new)
  on GitHub.
- **Email:** abhijathka@gmail.com — put `SECURITY` in the subject.

Please include enough to reproduce it: affected URL or endpoint, the request,
what you expected, and what happened. A proof of concept helps, but a clear
description is enough — do not feel you need working exploit code to report.

We aim to acknowledge within **3 working days** and to give an assessment and a
fix timeline within **10 working days**. If you do not hear back, please chase —
a missed email is far more likely than a decision to ignore you.

## Scope

In scope: this repository and any deployment you run yourself.

If you are testing against a hosted instance you do not operate, please **use
your own test accounts and your own data**. Do not access, modify or retain
another person's account or a child's profile. If you inadvertently reach
someone else's data, stop, and say so in the report — we would much rather know.

Out of scope, unless you can show real impact:

- Missing headers or cookie flags with no demonstrated consequence.
- Rate limiting on endpoints that neither send email nor check a credential.
- Reports produced solely by an automated scanner, without a working scenario.
- Denial of service by brute volume, and anything requiring physical access to
  an unlocked device.
- Social engineering of users or staff.

## Please don't

Run destructive tests, mass-create accounts, send bulk email through the app, or
degrade the service for real users. Testing that is indistinguishable from an
attack in progress will be treated as one.

## Disclosure

We will keep you updated while we fix the issue, and we are happy to credit you
in the release notes and advisory — tell us how you would like to be named, or
that you would rather not be. Please give us a chance to ship a fix before
publishing. If a fix is taking unreasonably long, talk to us; we would rather
agree a date than be surprised.

We do not currently run a paid bug bounty.

## For self-hosters

Some of the protections in this codebase depend on how you deploy it:

- **`TRUSTED_PROXIES`** — leave it empty when the server is exposed directly.
  Set it only to the address of a proxy that overwrites `X-Forwarded-For`.
  Rate limiting and the adaptive CAPTCHA are keyed on the client address, and
  trusting a forwarded header from an untrusted peer defeats both.
- **`COOKIE_SECURE=true`** and serve over HTTPS in production. HSTS is only sent
  when this is on.
- **`AUTH_MICROSOFT_TENANT`** — the default (`common`) lets any Microsoft tenant
  present any email address. That is safe here because such an address can never
  claim an existing account, but pin it to your own tenant if you want Microsoft
  addresses to be authoritative.
- Keep dependencies current. CI fails on a high or critical advisory in
  production dependencies; do not merge past it.
