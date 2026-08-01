# Premium & AI — feature specification

Status: **draft for review** · Owner: Abhijath · Last updated: 2026-08-01

This document specifies the paid tier and the AI-assisted learning that follows
it. It exists because premium currently gates two things — four extra learner
profiles and a badge in multiplayer — while advertising benefits that do not
exist. Everything below is written to be built against and tested against.

Acceptance criteria are written so that a person who did not design the feature
can decide, without asking, whether it is done.

---

## 1. Principles

These constrain every feature in this document. Where a feature appears to
conflict with a principle, the principle wins and the feature changes.

**P1 — Learning to type is free, completely.** A child must be able to go from
nothing to touch-typing the full alphabet without anyone paying. No lesson, no
letter, no part of the kids world is ever behind the paywall.

**P2 — Premium sells insight and structure, never access to your own data.**
Withholding *analysis* is fair. Withholding the learner's own history, or their
export, is not.

**P3 — The payer and the learner are different people.** The parent buys; the
learner wants. A feature that serves neither is not a premium feature.

**P4 — Never route the ask through a child.** No feature may be designed so
that a child asks a parent to pay. This rules out gating kids-world content,
characters, and cosmetics.

**P5 — No manufactured anxiety.** Reporting a child's real progress is
legitimate. Comparing them unfavourably to other children, or threatening the
loss of something they have earned, is not.

**P6 — Nothing gets worse when the product improves.** Existing subscribers see
new capability first and are never downgraded by a launch.

---

## 2. Commercial structure

### F1 — Tier and cadence matrix

Billing cadence and feature set are **independent axes**. A customer who wants
AI and annual billing must be able to buy exactly that.

|                   | Yearly | Monthly |
| ----------------- | ------ | ------- |
| **Premium**       | £30    | £4      |
| **Premium + AI**  | £60    | £7      |

Prices are indicative and may change before launch; the *structure* is the
decision being recorded here.

**Acceptance criteria**

- [ ] All four combinations are purchasable from the account page.
- [ ] A customer on any plan can move to any other plan without contacting
      support.
- [ ] Upgrading mid-term credits the unused portion of the current term against
      the new plan, pro rata to the day.
- [ ] Downgrading takes effect at the end of the paid term, never mid-term, and
      never refunds silently.
- [ ] The plan currently held is stated on the account page with its renewal
      date and price.
- [ ] No plan is described anywhere in the app or marketing as "lifetime".
- [ ] Cancelling retains premium until the end of the paid term.

**Out of scope:** lifetime purchases, per-learner pricing, school/site licences.

---

### F2 — Payment integrity (prerequisite, security)

Found during the security audit. **Both must be closed before a single
subscription is sold.**

The Paddle webhook grants premium based on `customData.id`, which is chosen by
whoever initiates the checkout — so a buyer can direct premium to any account.
The handler also grants premium on *any* completed transaction without checking
what was purchased.

**Acceptance criteria**

- [ ] The account credited is derived from the authenticated session that
      started the checkout, held server-side, and not from webhook-supplied
      custom data.
- [ ] Where custom data must be used, it is verified against a server-side
      record created at checkout initiation, and mismatches are rejected and
      logged.
- [ ] The handler verifies the purchased price/product identifier against an
      allowlist before granting anything.
- [ ] A transaction for an unknown or non-subscription product is logged and
      grants nothing.
- [ ] Replaying an already-processed webhook is idempotent and does not extend
      or duplicate entitlement.
- [ ] `/_/checkout` returns a clean 503 rather than a 500 when Paddle
      configuration is absent.
- [ ] Signature verification failure returns 400 and grants nothing (already
      true — add a regression test).

---

## 3. Parent-facing features

The parent pays. Their want is not typing — it is evidence that this is
working, delivered without them having to look for it.

### F3 — Weekly progress report email

**The flagship feature.** Highest value, closest to already built: the mailer,
the branded templates, per-profile results and the daily sweep all exist.

One email per week per household, covering every learner, in plain language a
parent reads in fifteen seconds.

**Content:** days practised out of seven · speed at start and end of week ·
accuracy trend · the two slowest keys or pairs, named · one concrete
suggestion · a link to the learner's page.

**Acceptance criteria**

- [ ] Sends once per week, on the household's chosen day, in the account's time
      zone.
- [ ] Covers every learner in the household in one email, not one email each.
- [ ] A learner who did not practise at all appears with an honest line saying
      so, not an invented positive.
- [ ] Speeds are stated in the account's chosen unit (wpm or cpm).
- [ ] Contains no comparison to other children or to any population average
      (P5).
- [ ] Renders correctly in Gmail, Apple Mail and Outlook, light and dark.
- [ ] Every email carries a working one-click unsubscribe that stops only this
      email type.
- [ ] Suppressed entirely if the household has no verified email.
- [ ] A send failure is logged and never retried in a way that produces a
      duplicate.
- [ ] Localised to the account language.

**Depends on:** existing `Notifier`, `ReminderSweep`, email templates.

---

### F4 — First report free (parent unlock moment)

The parent's conversion trigger. They cannot value a report they have never
seen, so they get one, unprompted, before being asked for anything.

**Acceptance criteria**

- [ ] The first weekly report is sent free to every household after the first
      week in which any learner practised on at least three separate days.
- [ ] The free report is complete — not truncated, not watermarked, not a
      preview.
- [ ] It ends with a plain statement that weekly reports are part of premium,
      with a link, and no countdown, urgency or scarcity language.
- [ ] Only one free report is ever sent per household.
- [ ] Declining to subscribe produces no further prompts by email.

---

### F5 — Household view

One page showing every learner side by side: current speed, days practised this
week, streak, trend arrow, and who has not practised in a while.

**Acceptance criteria**

- [ ] All learners visible without scrolling on a 1280px viewport for a
      household of up to eight.
- [ ] Each learner shows speed, accuracy, days practised this week, and days
      since last practice.
- [ ] A learner inactive for more than seven days is visually distinguished —
      calm, not alarming (P5).
- [ ] Selecting a learner opens their existing profile page.
- [ ] Reachable from the account area in one click.
- [ ] Non-premium accounts see the page with real learner names and a locked
      state on the comparative data, not a marketing page.

---

### F6 — More learners

Already implemented: four free, eight with premium.

**Acceptance criteria**

- [ ] Free accounts may create four learners; the fifth attempt explains the
      limit and offers premium.
- [ ] Premium accounts may create eight.
- [ ] If a subscription lapses while more than four exist, **no learner is
      deleted and no data is lost**; creation is blocked until the count is
      back under the free limit (P6, P2).

---

## 4. Learner-facing features

The learner's desire exists at exactly one moment: when guided practice runs out
of letters and there is no obvious next thing.

### F7 — Diagnostics

The "why am I stuck" charts: slowest key transitions, per-key speed
distribution, and the key-frequency heatmap. Most of these views already exist
on the profile page.

**Acceptance criteria**

- [ ] Available to premium accounts for every learner in the household.
- [ ] Each chart states, in one sentence of plain language, what it is telling
      the reader.
- [ ] The slow-transitions view names the specific pairs (e.g. "th", "er") and
      the cost of each in wpm.
- [ ] Non-premium accounts see the chart rendered with **their own real data**
      and partially obscured, not a generic illustration (endowment, P2 — the
      analysis is gated, the data is not).
- [ ] Every diagnostic is reachable from the unlock moment (F9).

---

### F8 — Targeted drills

A lesson generated from the learner's own diagnostics, drilling their slowest
pairs rather than the general alphabet. The bottleneck drill already selects
the slowest pair; this makes it a first-class, explained lesson type.

**Acceptance criteria**

- [ ] Selectable as a practice mode by premium accounts.
- [ ] The lesson states which pairs it is drilling and why.
- [ ] The pairs are drawn from that learner's own recorded transitions, not a
      static list.
- [ ] Results feed back into the normal progress record — a drill is a real
      lesson, not a sandbox.
- [ ] Regenerates as the learner's weak pairs change.

---

### F9 — The unlock moment (learner conversion trigger)

Shown once, when a learner unlocks the final letter of the alphabet. This is
the only moment in the product where desire reliably exists.

**Acceptance criteria**

- [ ] Triggers on unlocking the 26th letter (or the alphabet's full size for the
      active layout), once per learner, never again.
- [ ] Opens by acknowledging the achievement before mentioning anything paid.
- [ ] Shows the learner's **own** slow-transition data, partially obscured.
- [ ] Contains no feature grid, no price table, no countdown.
- [ ] Dismissible in one action, and dismissal is remembered permanently.
- [ ] Appears for kid profiles in age-appropriate language, and **never asks a
      child to pay or to ask a parent to pay** (P4) — for kid profiles it
      celebrates only, and any commercial follow-up reaches the parent by email.

---

### F10 — Real material

Books, code and custom text as practice sources.

> **Decision required.** These are currently free. Moving them behind the
> paywall is a takeaway, which is only clean because the product has not
> launched. Either gate them now or accept they stay free permanently — do not
> gate them after acquiring users.

**Acceptance criteria (if gated)**

- [ ] Guided practice, classic course, frequent words and number drills remain
      free (P1).
- [ ] Selecting a gated source shows a sample lesson, then explains the
      requirement.
- [ ] Any custom text a user has already saved remains readable and exportable
      regardless of plan (P2).

---

### F11 — The twelve-week programme

**The strongest differentiator in this document, and the most work.**

Parents do not buy practice; they buy programmes. A structured course with
weekly targets and an explicit endpoint — "25 to 60 wpm in 12 weeks" — is the
difference between a tool and a course.

**Acceptance criteria**

- [ ] A learner can start a programme and see all twelve weeks, each with a
      stated goal.
- [ ] Each week has a measurable target (speed, accuracy, or consistency) and a
      recommended number of sessions.
- [ ] Progress through the programme is visible at a glance, including weeks
      missed.
- [ ] Falling behind adjusts the plan rather than declaring failure (P5).
- [ ] Completing a week is acknowledged; completing the programme produces a
      certificate (F12).
- [ ] The programme uses the existing lesson engine — it schedules and targets,
      it does not fork the generator.
- [ ] A learner may leave and rejoin without losing position.
- [ ] Weekly targets appear in the parent report (F3).

---

### F12 — Certificates

Cheap to build, disproportionately valued, and produces a shareable artifact.

**Acceptance criteria**

- [ ] Issued on completing the alphabet, completing a programme, and on reaching
      defined speed milestones.
- [ ] Contains the learner's first name, the achievement, the date, and a speed
      figure where relevant.
- [ ] Printable on A4 and US Letter without clipping.
- [ ] Downloadable as PDF.
- [ ] Contains no external tracking, no QR code to a signup page, and no
      surname or email (children's data minimisation).
- [ ] Available to free accounts for the alphabet milestone (P1 — finishing the
      free curriculum deserves the certificate); programme certificates are
      premium.

---

## 5. AI-assisted learning

Two loops at different tempos, owning **different variables** so they cannot
oscillate against each other.

### F13 — Separation of concerns

**Acceptance criteria**

- [ ] The existing engine (BKT, spaced repetition, decay, confidence) remains
      the sole authority over **content**: which letters are in play, which
      pairs to drill, when a key unlocks.
- [ ] The AI is the sole authority over **session shape**: intensity, session
      length, when to ease off, when to stop, coaching tone.
- [ ] No variable is written by both systems. A written record of the split
      exists in code comments at both boundaries.

---

### F14 — Nightly analysis

An LLM call producing a *settings delta* and a human-readable summary, not a
lesson.

**Acceptance criteria**

- [ ] Runs only for accounts on the AI plan.
- [ ] Triggered by **events** — plateau, regression, milestone, return after a
      gap, week end — not on a fixed nightly schedule for every learner.
- [ ] Output conforms to a declared schema; anything else is discarded and
      logged.
- [ ] Every numeric field is clamped to a range the existing settings already
      permit.
- [ ] Produces a one-sentence plain-language rationale suitable for showing to
      the learner (F16).
- [ ] Cost per learner per month is measured and reported.

---

### F15 — Session controller

The fast loop. Owns when to push, when to ease, and when to stop.

**Acceptance criteria**

- [ ] Can end a session early with an encouraging message when disengagement or
      fatigue is detected.
- [ ] Never extends a session beyond the learner's configured daily goal without
      an explicit choice by the learner.
- [ ] Never reduces difficulty below a level already mastered on the basis of a
      single poor session.
- [ ] Per-session change is capped so difficulty cannot swing sharply day to
      day.
- [ ] Falls back to the existing engine's defaults when the backend is
      unreachable — **offline must not mean broken**.
- [ ] Adds no perceptible latency between lessons.

**Note on claims.** Build against *struggle, fatigue and disengagement*, which
the signal supports. Avoid describing this as mood or emotion detection: the
accuracy claim is weaker than it sounds, and emotion inference involving
children carries regulatory exposure under the EU AI Act.

---

### F16 — Visible adaptation

Invisible tuning is indistinguishable from no tuning, and it is the thing being
paid for.

**Acceptance criteria**

- [ ] When the plan changes, the learner sees a plain-language sentence saying
      what changed and why.
- [ ] The parent report includes what the AI focused on this week.
- [ ] No jargon, no model names, no confidence scores in user-facing text.

---

### F17 — Privacy, disclosure and data minimisation

**Blocking. Nothing leaves the server until every item here is true.**

Typing dynamics are behavioural biometrics; a stable pseudonymous id is
*pseudonymisation*, not anonymisation, and remains personal data.

**Acceptance criteria**

- [ ] Only aggregates cross the boundary — per-key medians, error rates, counts,
      bigram latencies. **No raw keystroke timing streams.**
- [ ] No name, email, birth year, or any text the learner typed is transmitted.
- [ ] The identifier is opaque, held server-side, and cannot be reversed by the
      receiving service.
- [ ] The privacy policy names the third-party processor, the categories of data
      sent, and the purpose, **before the first call is made**.
- [ ] A data processing agreement is in place with the provider.
- [ ] For learners under 13, verifiable parental consent covers AI processing
      specifically, not just account creation.
- [ ] A household can use premium with AI processing declined, and the app
      degrades to the classic engine.
- [ ] Data export includes anything derived and retained about the learner.

---

### F18 — Existing-customer AI trial

Existing subscribers see new capability first (P6).

**Acceptance criteria**

- [ ] Every existing paying customer receives the AI features free for one month.
- [ ] The trial begins at a per-customer moment when the AI has something to
      show — a plateau — rather than on a fixed calendar date.
- [ ] Usage is quota-capped so a single household cannot generate unbounded cost;
      the cap is high enough that normal use never reaches it.
- [ ] At the end of the trial the customer is offered an **upgrade** with their
      remaining term credited pro rata. No downgrade path is presented.
- [ ] Declining leaves their existing plan exactly as it was, with no reduction
      in what they already had.
- [ ] The end of the trial is communicated before it happens, not after.

---

## 6. Measurement

### F19 — Holdout

Without this, the outcome claim is a hope, and neither you nor the customer can
know whether the AI helped.

**Acceptance criteria**

- [ ] A defined share of AI-plan subscribers remain on the classic engine as a
      control, assigned at random and stable per household.
- [ ] Assignment is recorded and never silently changed.
- [ ] Speed progression **and retention** — days practised per week, weeks
      active — are compared across arms over at least eight weeks.
- [ ] Retention is treated as the primary measure; per-key speed is secondary.
- [ ] Results are recorded whether or not they favour the AI.
- [ ] No marketing claim about outcomes is published before the comparison has
      run.

---

## 7. Build order

Value per unit of work, highest first.

1. **F2 — payment integrity.** Blocking. Nothing may be sold before this.
2. **F3 + F4 — weekly report and first-free.** Highest value, closest to done.
3. **F1 — tier structure.** Must be right before the first subscription exists.
4. **F5 — household view.** Small, and makes F3 feel like a product.
5. **F9 — unlock moment.** Cheap; it is where learner conversion happens.
6. **F12 — certificates.** Cheap win, disproportionate affection.
7. **F11 — twelve-week programme.** The real differentiator, and the most work.
8. **F17 — privacy work.** Must complete before any AI ships.
9. **F13–F16 — AI loops.**
10. **F19 — holdout.** Ship with the AI, not after it.
11. **F7, F8 — diagnostics and drills.** Genuinely useful, fewest users.
12. **F18 — existing-customer trial.** Timed with the AI launch.

---

## 8. Open decisions

| # | Decision | Blocks |
| - | -------- | ------ |
| 1 | Do books/code/custom text become premium, or stay free permanently? | F10 |
| 2 | Final pricing for all four cells of the matrix. | F1 |
| 3 | Which speed milestones earn a certificate? | F12 |
| 4 | Holdout share — 10%, 20%? | F19 |
| 5 | Does the AI plan include everything in Premium, or is it strictly additive? | F1 |
| 6 | Programme length — is twelve weeks right, or should it vary by starting speed? | F11 |

---

## 9. Explicitly out of scope

- Advertising of any kind (decided: the COPPA exposure and brand cost outweigh
  the revenue at this scale).
- Lifetime purchases.
- Gating any part of the kids world, including characters and cosmetics (P4).
- Streak-loss or expiry pressure as a conversion mechanic (P5).
- Percentile comparison of a child against other children (P5).
- Card-required free trials.
