# Deferred to phase 2

Work that is understood, partly built, and parked — recorded here so the
investigation behind each item does not have to be repeated.

## Microsoft sign-in

**Status: complete in code, blocked on credentials only.**

Nothing is missing from the application. `MicrosoftAdapter` is implemented and
tested (`packages/keylearn-oauth/lib/adapter/microsoft/`), wired into the DI
container (`packages/server/lib/app/auth/module.ts`), and the sign-in button
with its mark and messages exists in `AuthPage.tsx`. The button is gated on
`AUTH_MICROSOFT_CLIENT_ID` being non-empty, so an unconfigured deployment simply
does not show it — verified: `/login` currently renders Google and Facebook only.

To finish, an Azure app registration must supply:

| Key | Notes |
| --- | --- |
| `AUTH_MICROSOFT_CLIENT_ID` | Application (client) ID from the Overview page |
| `AUTH_MICROSOFT_CLIENT_SECRET` | The secret **Value**, not the Secret ID |
| `AUTH_MICROSOFT_TENANT` | Keep `common` |

The redirect URI must be exactly `<APP_URL>auth/oauth-callback/microsoft`, and
the scope the server requests is `https://graph.microsoft.com/User.Read`.

Keep the tenant on `common`. Pinning it to one organisation would let only that
organisation's members sign in, turning away every public user. The security
cost of `common` is already handled: because Microsoft Graph reports no
email-verification state, and any tenant can set a user's `mail` to an address
it does not own (nOAuth), `parseProfileResponse` always returns
`emailVerified: null` — a Microsoft address can create a new unverified account
but can never claim an existing one.

**Why it stalled.** Azure portal sign-in itself failed, before reaching the app
registration:

> Selected user account does not exist in tenant 'Microsoft Services' and cannot
> access the application c44b4083-3bb0-49c1-b47d-974e53cbdf3c in that tenant.

That GUID is the Azure Portal. The account being used has no Entra directory, or
is being routed at one it does not belong to. Resuming means either creating a
free Entra tenant (`entra.microsoft.com` → Manage tenants → Create; no
subscription or card needed for app registrations) or using a fresh personal
Microsoft account with no prior organisation history. The full URL of the error
page names the target tenant and is the fastest way to tell those apart.

## support@keylearn.org cannot receive mail

**Status: live risk, not merely deferred.**

`keylearn.org` publishes no MX records, so the address accepts nothing. It works
only as a Brevo *sending* identity. The `support`, `r.support` and `img.support`
CNAMEs are Brevo's branded sending and tracking hosts — `support.keylearn.org`
the hostname is unrelated to `support@keylearn.org` the mailbox, and no CNAME
creates one.

The address is nevertheless printed in the footer and in the privacy policy's
data-rights section (commit `981ddc1c`). Until MX exists, a user exercising a
stated data right gets a bounce. Either finish the mailbox or take the address
back out of the UI.

Google Workspace was chosen. Outstanding:

1. Create the Workspace account with `support` as the admin user.
2. Add Google's domain-verification TXT **alongside** the existing
   `google-site-verification=` record, not replacing it.
3. `MX @ priority 1 → smtp.google.com` (one record; the five-record
   `ASPMX.L.GOOGLE.COM` set is legacy).
4. **Update SPF to include Google**, see below.
5. Generate DKIM in Admin console → Gmail → Authenticate email, publish at
   `google._domainkey`, then Start authentication.

### The SPF change is not optional

Current record, verified live:

```
v=spf1 include:spf.brevo.com ~all
```

Once replies are sent from `support@keylearn.org` through Workspace, they leave
Google's servers, not Brevo's. DMARC is `p=reject` with strict alignment
(`adkim=s; aspf=s`), so without `include:_spf.google.com` those replies fail
authentication and are rejected. The final record should be:

```
v=spf1 include:spf.brevo.com include:_spf.google.com ~all
```

### Mail authentication as it stands

Verified against live DNS, all healthy:

| Record | State |
| --- | --- |
| SPF | authorises Brevo, softfail otherwise |
| DKIM | `brevo1`/`brevo2._domainkey` resolve to real RSA keys, signed as `d=keylearn.org` |
| DMARC | `p=reject; sp=reject; adkim=s; aspf=s` |

DMARC passes on the DKIM leg, which is why app mail reaches recipients today.
Squarespace's "Email Security" preset — a null `v=DKIM1; p=` key, and
`v=spf1 -all` authorising nobody — has been deleted and replaced with custom
records.

## Microsoft mail lands in Junk

**Status: delivered and authenticated, filtered anyway — expected for a new domain.**

Verified 2026-08-15: mail to an Outlook/Hotmail address arrives and passes
DMARC, but lands in Junk rather than the inbox. Not a code or DNS bug —
Microsoft weighs sender reputation and send history heavily on top of
SPF/DKIM/DMARC, and `keylearn.org` has almost none yet. Two contributing
factors on top of that, worth fixing when the Google Workspace SPF change
above happens anyway:

- DMARC currently only passes via the **DKIM** leg — Brevo's envelope sender
  (`Return-Path`) doesn't align with `keylearn.org` under the strict `aspf=s`
  policy, so SPF-alignment fails and only DKIM saves the DMARC check. Still a
  pass, but a weaker signal to aggressive filters than a double pass.
- Sending through Brevo's shared IP pool ties reputation partly to other
  Brevo customers on the same IPs.

What actually helps, roughly in order of effort: mark the test messages "Not
junk" / add `support@keylearn.org` to Safe Senders (trains that mailbox
specifically); keep sending a steady trickle of real transactional mail
rather than bursts, since reputation builds over days/weeks of consistent
legitimate volume; check Brevo's dashboard for domain/sender reputation
stats; consider Brevo's paid dedicated-IP add-on if this needs to improve
faster than organic warm-up. Re-check once Google Workspace mail is live —
`support@keylearn.org` will also send from Google's infrastructure, which
carries its own (generally stronger) reputation with Microsoft.

## The rest of the accessibility work (tier 3)

**Status: two of the three built, the third argued against.**

Tiers 1 and 2 are in and verified. What was scoped as tier 3 stands as:

| Item | State |
| --- | --- |
| An announcement when a lesson finishes | **Done** — `PracticeScreen` writes one sentence to a polite live region after every result, since the figures otherwise change in place and silently |
| The kids coach's line announced | **Done** — the `.say` line is a polite live region; it is the only thing on that page saying what to do next |
| A fuller screen-reader pass over the kids game | **Deferred** |
| A plain-language toggle | **Not recommended** — see below |

### The kids game and a screen reader

What is left is the game itself rather than its captions: the world is a
canvas with no accessible name, the score, combo and hero-level chips update
silently, and nothing announces a hatching or a new land. It is reachable and
typable by keyboard today — that is how it is played — but a learner using a
screen reader gets the lesson text and none of the game around it.

Doing it properly means deciding what a screen reader should say about a
running game at all: every combo would be noise, and nothing at all is what it
does now. The likely answer is a small set of announced moments — a letter
unlocked, a land reached, a companion hatched — and an accessible name and
description on the canvas that says what is being drawn rather than trying to
narrate it.

### Why the plain-language toggle is not recommended

It would fork every instruction in the app into two versions, doubling the
translation surface across 55 locales, and the second version would drift out
of date the moment anyone edited the first. Where the current wording is too
dense, the honest fix is to rewrite that line once, for everybody — a copy
pass, not a setting.
