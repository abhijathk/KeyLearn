# Organisations — phase 2 specification

Status: **draft for review, revision 2** · Owner: Abhijath · Last updated: 2026-08-24

> **Revision 2** folds in the consequences of a decision taken 2026-08-24:
> **Aksharavazhi — the Malayalam weekend-school module — will sit under this
> structure as its first tenant** (see `aksharavazhi-project-spec.md`). Its
> school → coordinator → teacher → guardian → learner model stress-tests this
> spec in three places, and this revision resolves all three: the enrolment
> grant moves from "future seam" to launch scope (§4.4, §5.1), the teacher
> role arrives in phase 2 (§3), and Aksharavazhi's invite chain becomes the
> tier's one membership mechanism (§5.3). It also resolves three of the four
> previously open decisions (§9) and adds the tier-level features the first
> tenant makes worth building once (§8).

This document specifies the organisation tier: a second way to own learners,
for coaching centres, tutoring businesses and schools, sitting beside the
household model the app ships today. It also specifies PIN sign-in for
learners, which the household side needs regardless.

Phase 1 is the product as it stands — one account, one household, profiles
chosen by tapping a name. Phase 2 adds owner / admin / learner above and below
that, and makes "which learner is at the keyboard" something the server knows
rather than something the browser asserts.

Acceptance criteria are written so that a person who did not design the feature
can decide, without asking, whether it is done.

---

## 1. Principles

These constrain everything below. Where a feature appears to conflict with a
principle, the principle wins and the feature changes.

**P1 — The household product does not change.** Not its screens, not its
pricing, not one query it already runs. An existing family must be unable to
tell that this shipped. Anything that would alter household behaviour is out of
scope by definition, not by care.

**P2 — One place decides who may reach a learner.** Access is answered by a
single function. Two ownership models may live behind it; two answers to the
same question may not. This is the property that makes every later layer cheap
and its loss is how access-control bugs arrive.

**P3 — A PIN identifies, it does not protect.** Four digits pick one person out
of a known handful _inside_ an already-authenticated session. A PIN is never
the outermost thing between the internet and a child's data.

**P4 — A learner is OWNED by exactly one owner.** A household or an
organisation, never both, never neither, and the database enforces it rather
than the code remembering to. Ownership never splits — but **visibility may be
granted**: a family-owned learner can be enrolled into an organisation by an
explicit, revocable, parent-made grant (§4.4). The grant is how a weekend
school sees a child whose parent holds the account; it never moves the child.
(Revision 2: this was §7.1's "future expansion" until Aksharavazhi made it the
normal case — its guardians own the profiles, its schools enrol them.)

**P5 — Children in an organisation are still children.** Every protection the
kids product already applies — no ads, no public leaderboard, no
behavioural analytics — applies at school too, and by default rather than by
configuration.

**P6 — Modules extend; the spine stays agnostic.** (Revision 2.) The
organisation tables never learn a curriculum. Anything one module needs —
Aksharavazhi's `current_unit`, its term calendar, its content-bundle pinning —
lives in module-owned tables keyed by `organization_id`/`batch_id`, exactly as
its mastery engine owns `ATTEMPT`/`MASTERY_STATE`. This is what lets the
typing product and the Malayalam product share one org spine without either
leaking into it.

---

## 2. The structure

```
Household (phase 1, unchanged)        Organisation (phase 2)
Account                               Organisation  (type: school | centre | …)
  └── Profile                           ├── OrgMember → Account
      kind = adult | kid                │     ├── owner
      PIN optional                      │     ├── admin
                                        │     └── teacher      scoped to a batch
                                        └── Batch  ("class" at a school)
                                              ├── Profile        mode A: org-owned, PIN required
                                              └── ProfileAccess  mode B: family-owned, enrolled by grant
```

Four levels, matching the roles the business actually has: the **owner** who
pays and is accountable, the **admin** who runs day-to-day operations, the
**teacher** who runs one batch's sessions (revision 2 — Aksharavazhi's
coordinator/teacher split made this a launch role, not a seam), and the
**learner** who practises.

A **batch** is a cohort — an intake, a timetabled group, "Tuesday 5pm
beginners", a weekend-school class. Organisations of `type: school` label it
"class" in the UI; the schema keeps one word. (Revision 2:) a batch **is** an
access boundary for the teacher role — a teacher reaches their own batch's
learners and no others. Owners and admins still see the whole organisation.

Learners arrive in a batch one of two ways, and both live behind the same
resolver (§5.1):

- **Mode A — org-owned.** The organisation creates the profile
  (`organization_id` set, `user_id` null), sets a PIN, and is the data owner.
  The coaching-centre shape.
- **Mode B — family-owned, org-enrolled.** The profile stays under the
  guardian's account; an accepted invite writes a `profile_access` grant
  (§4.4). The organisation sees progress because a parent said so, sees it
  only while the grant stands, and never owns the child's history. The
  weekend-school shape, and Aksharavazhi's only shape.

---

## 3. Roles and permissions

|                                        | owner | admin | teacher    | learner  |
| -------------------------------------- | ----- | ----- | ---------- | -------- |
| Billing, seats, plan                   | ✓     |       |            |          |
| Delete the organisation                | ✓     |       |            |          |
| Transfer ownership                     | ✓     |       |            |          |
| Appoint and remove admins              | ✓     |       |            |          |
| Appoint and remove teachers            | ✓     | ✓     |            |          |
| Create and edit batches                | ✓     | ✓     |            |          |
| Create and edit learner profiles (A)   | ✓     | ✓     |            |          |
| Invite guardians / enrol learners (B)  | ✓     | ✓     | own batch  |          |
| Set, reset and unlock learner PINs     | ✓     | ✓     |            |          |
| Run a session / projection for a batch | ✓     | ✓     | own batch  |          |
| See learners' progress                 | org   | org   | own batch  | own only |
| Practise                               |       |       |            | ✓        |

**Roles are strict supersets: owner ⊇ admin ⊇ teacher.** Implement them that
way, not as disjoint sets, so no permission can ever exist that a teacher has
and an admin does not, or an admin has and an owner does not. One
`can(role, action)` function is the whole implementation (§7's seam, cashed
in).

**An organisation always has exactly one owner.** Deleting the last owner is
refused; ownership moves by transfer, which the receiving admin must accept.

**Role and `kind` are orthogonal.** `kind` (`adult` / `kid`) describes the
person and drives the age-appropriate experience. Role describes what an
account may do. An organisation's learners are usually `kid`; its admins are
accounts, not profiles. Conflating the two is the most likely modelling
mistake here.

---

## 4. Schema

Three new tables, two new columns. Everything is additive; no existing column
changes meaning.

| Table               | Columns                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organization`      | `id`, `parent_id?`, `name`, `type`, `created_at`                                                                                                                         |
| `org_member`        | `id`, `organization_id`, `user_id`, `role`, `batch_id?`, `created_at`                                                                                                    |
| `batch`             | `id`, `organization_id`, `name`, `starts_on?`, `ends_on?`                                                                                                                |
| `organization_plan` | `organization_id`, `seats`, `valid_until`, `provider`, `provider_ref`                                                                                                    |
| `profile_access`    | `id`, `profile_id`, `organization_id`, `batch_id?`, `granted_by_user_id`, `scope`, `granted_at`, `revoked_at?` — revision 2, §4.4                                        |
| `org_invite`        | `id`, `organization_id`, `batch_id?`, `role`, `token_hash`, `issued_by_user_id`, `expires_at`, `accepted_by_user_id?`, `accepted_at?`, `revoked_at?` — revision 2, §5.3 |

| Existing table                                                                          | Change                                   |
| --------------------------------------------------------------------------------------- | ---------------------------------------- |
| `profile.organization_id`                                                               | new, nullable — **null means household** |
| `profile.batch_id`                                                                      | new, nullable                            |
| `profile.user_id`                                                                       | becomes nullable                         |
| `profile.pin_hash`, `pin_failed_attempts`, `pin_locked_until`, `pin_permanently_locked` | new, all nullable                        |

### 4.1 The ownership constraint

`profile.user_id` is `notNullable` today. An organisation-owned learner has no
owning account, so it must become nullable — and the moment it does, "every
profile has exactly one owner" stops being guaranteed by the column and has to
be stated:

```sql
CHECK ((user_id IS NULL) <> (organization_id IS NULL))
```

This is P4 expressed where it cannot be forgotten. Do not model ownership
polymorphically (`owner_type` + `owner_id`) — it reads as flexibility and costs
real foreign keys, so the database can no longer prove an owner exists.

### 4.2 Batch membership

`profile.batch_id` records where a learner **is**, not where they have been.
Moving a learner between batches loses the history, which is correct until a
report asks otherwise; at that point add a dated join table. Do not build it
now.

### 4.3 Billing

Organisation plans are a record, never flags on the organisation row, and never
the household's `user.order`. The two products have different payers, different
units (seats vs learner places) and will have different plan shapes. Entangling
them is not reversible.

### 4.4 The enrolment grant (revision 2)

`profile_access` is mode B (§2): a family-owned learner made visible to an
organisation, batch-scoped, by the guardian accepting an invite. Three rules:

- **A grant grants visibility, never ownership.** The §4.1 CHECK is untouched;
  `user_id` stays set. Revoking the grant removes the organisation's access
  and nothing else — the history was always the family's.
- **The grant row is the consent artifact.** `granted_by_user_id` +
  `granted_at` record which guardian consented and when, which answers the
  consent-at-school question (§9.1) for this mode without a parallel consent
  system.
- **`revoked_at` is how a learner leaves.** Unenrolment is a timestamp, not a
  DELETE — the organisation's aggregate term reports must keep resolving after
  a student changes school (§9.3).

The scope column starts with one value (`progress`) and stays a string, same
reasoning as `role`.

### 4.5 Module extensions (revision 2)

P6 in schema form. Aksharavazhi's `SCHOOL` needs `country`, `timezone`,
`term_calendar`; its `CLASS` needs `level`, `current_unit`, `meeting_day`,
`meeting_time`, a pinned content version. None of these columns land on
`organization` or `batch` — they live in module-owned tables
(`aksharavazhi_school(organization_id, …)`, `aksharavazhi_class(batch_id, …)`)
exactly as its engine owns `ATTEMPT` and `MASTERY_STATE`. The org spine never
learns what a unit is, and a second curriculum module costs a second extension
table, not a schema argument.

---

## 5. Access control

### 5.1 The single chokepoint

Today every profile-scoped endpoint calls `Profile.findOwned(userId, id)`.
Phase 2 replaces it with one resolver that answers _may this actor reach this
profile_, and branches internally:

- `profile.organization_id IS NULL` and no grant in play → the existing
  `user_id` comparison, unchanged. Household behaviour is then preserved by
  construction (P1).
- `profile.organization_id` set (mode A) → the actor is a member of that
  organisation. Role decides what they may **do**; membership decides what
  they may **see** — except teachers, whose sight ends at their batch.
- (Revision 2) a live `profile_access` grant (mode B) → an org actor reaches a
  family-owned learner exactly as far as the grant's scope and batch allow,
  and the owning guardian's own access is never narrowed by the grant's
  existence.

Every caller keeps its current shape. Adding a layer later — educators,
per-batch admins, shared access — is a branch in this function and a table, not
an audit of the codebase.

### 5.2 Learner sessions

A learner reaching their own data is the same question asked of a different
actor. When a profile session is active (§6), the resolver answers only for
that profile, whatever the request asks for.

### 5.3 Membership: the invite chain (revision 2)

The original draft never said how anyone *joins* an organisation. Aksharavazhi
specified it completely (`aksharavazhi-project-spec.md` §3), and its mechanism
is adopted here as the tier's only one — for admins and teachers at a coaching
centre exactly as for guardians at a weekend school. There is no other door:
**no public org sign-up form exists anywhere**, and no new authentication
surface ships — an invite link lands on the existing auth page, and the
accepted invite is what attaches the resulting account to the organisation.
(This also answers the "organisation login button" question: the invite link
is the entry point; the login page needs nothing.)

Token properties, lifted from the module spec because every line of it earned
its place:

| Property   | Value                                                 | Reason                                                              |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------- |
| Scope      | One organisation, one role, one batch where relevant  | An invite cannot escalate role or move organisations                |
| Single use | Yes                                                   | Prevents forwarding into a WhatsApp group and uncontrolled sign-ups |
| Expiry     | 14 days default, configurable                         | Weekend-school cadence means two Saturdays to act                   |
| Revocable  | Yes, before acceptance                                | A mis-sent invite can be pulled                                     |
| Seat-bound | Consumes a seat on acceptance, releases on revocation | Licence enforcement without per-student billing friction            |
| Delivery   | Link, plus printable QR                               | Many guardians are handed paper in a hall on a Saturday morning     |

A guardian invite, accepted, does two things in one motion: attaches the
account (creating it first if needed) and writes the `profile_access` grants
for the children the guardian then adds — the acceptance flow is where mode
B's consent is actually collected.

---

## 6. PIN sign-in

### 6.1 The problem it solves

The active profile is a `localStorage` value. The server checks that the
profile belongs to the household, so one family cannot reach another's data —
but _within_ a household or an organisation, anyone at the keyboard may become
any learner, and results are written there. The practice-surface guard is
client-side and does not change this.

### 6.2 The flow

1. The household or organisation session is established as it is today.
2. `POST /_/profiles/{id}/enter` carries the PIN.
3. The server verifies it and writes the profile id **into the server session**.
4. Profile-scoped endpoints read the learner from the session, never from the
   request.

Step 4 is the feature. Until the profile comes from the session, a PIN is
decoration.

### 6.3 Rules

- **PINs are hashed with the existing password path** (`hashPassword` /
  `verifyPassword`, scrypt). No second credential implementation.
- **Lockout is keyed per profile, never per address.** A batch sits behind one
  school NAT; address-keyed limiting would have thirty children locking each
  other out within minutes. This is the easiest thing here to get wrong.
- **Lockout escalates**: failed attempts count, a threshold locks for a period,
  a further threshold locks permanently. Only an owner or admin clears it.
- **Required for org-owned learners (mode A), optional in households.** A
  household that sets no PIN behaves exactly as it does today (P1). A mode-B
  learner practises from the guardian's device under household rules —
  Aksharavazhi's children never sign in at school at all (the teacher
  projects; the class follows). A shared-device classroom mode — teacher's
  roster, tap a name, PIN or teacher unlock — is a later feature and changes
  nothing here.
- **A PIN is never a password reset path** and never appears in a URL, a log or
  an error message.

---

## 7. Room to expand

Four seams are cut in phase 2 because retrofitting them is expensive and
leaving them open is nearly free. None of them is _built_ in phase 2.

| Seam                                                        | Cost now            | What it buys                                                                                                                         |
| ----------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `organization.parent_id`                                    | one nullable column | school → campus, an association running schools in three countries (Aksharavazhi's real shape), without restructuring scoped queries |
| `org_member.batch_id`                                       | one nullable column | ~~per-batch admins, and the educator role, later~~ **cashed in by revision 2: the teacher role uses it at launch**                   |
| `role` as an open string + one `can(role, action)` function | none                | a new role is one string and one line; no DB enum migration — how `teacher` arrived without one                                      |
| `organization_plan` as a record                             | none                | a second plan shape does not become a second boolean                                                                                  |
| `profile_access.scope` as a string                          | none                | a narrower grant (aggregate-only, no per-attempt detail) is a value, not a table                                                      |

**Deliberately not built:** custom roles with a permission editor, polymorphic
ownership, batch history, event-sourced membership. All plausible, none
requested, each one maintained through every schema change in between.

### 7.1 The expansion that moved into phase 2 (revision 2)

The original draft kept this section's grant — a family-owned child made
visible to an organisation — as a future seam. Aksharavazhi ended that: its
guardians hold the accounts and its schools see the children, so the grant is
its *normal* case, not its edge case. The mechanism is now core: schema in
§4.4, resolver branch in §5.1, consent collected at invite acceptance in §5.3.
The reasoning the original gave — ownership is never weakened, the household
keeps the child, the interesting part is consent — survives unchanged; only
the schedule moved.

---

## 8. What the tier ships beyond the spine (revision 2)

Features that only make sense once, at tier level, and that the first tenant
makes worth building now. Each is small; none blocks a milestone before M4.

**Org-branded certificates and term reports.** The certificate machinery
exists (kids and adult certificates ship today). Adding the organisation's
name and a coordinator signature line to a per-batch, per-term certificate is
cheap — and it is the artifact weekend schools actually run on, because it is
what parents frame. Term reports export per batch, printable, because a
Saturday hall has paper and no projector spare.

**A projection shell, module-agnostic.** Aksharavazhi's teacher surface —
one-key projection modes, class-band defaults — is specced module-side, but
"teacher projects, the batch follows" is equally valuable for a typing class.
Build the shell (fullscreen, keyboard-driven, roster-aware) once at tier
level; modules plug content into it.

**A progress-summary interface per module.** Org dashboards consume one tiny
engine-agnostic shape — `learner → level, momentum, last-active` — which the
keybr-style typing engine and Aksharavazhi's yield-over-cost engine both
produce. Without it the batch dashboard couples to whichever engine shipped
first and the second bolts on ugly.

**An access audit for learner data.** Org staff viewing a child's progress is
recorded — who, whose, when — the same treatment a staff email-reveal already
gets on the support desk. Cheap now, painful to retrofit, and the first
question a school's data-protection officer asks.

**Org-aware support.** Coordinators and teachers will write to the desk; their
tickets carry organisation and role, so the assistant and staff see
"coordinator, 40-seat school, AU" in the context card before reading a word.

**The pricing honesty check.** The support assistant's product pitch and
billing Answers currently say — truthfully — that KeyLearn is free with no
subscriptions, ever. The day `organization_plan` ships, that sentence is a
lie waiting for the first invoice question. Before M4 completes: the pitch
becomes "free for families, licensed for organisations", and the billing
Answers for seats, invoices and lapses are written — otherwise the assistant
will confidently tell a paying school there is nothing to pay for.

---

## 9. Decisions still open

These are policy, not engineering, and they change the schema if answered late.

1. **Consent at school — resolved for mode B, open for mode A** (revision 2).
   A mode-B enrolment's consent is the guardian's accepted invite, recorded on
   the grant row (§4.4) — no parallel consent system. Mode A — an organisation
   creating a learner with no parent record — still needs the institutional
   lawful basis decided before the schema hardens, and remains open.
2. **Admin breadth.** Every admin currently sees every learner in the
   organisation. Right for a coaching centre; possibly too broad for a school
   of eight hundred. Revision 2 note: the teacher role now proves the
   batch-scoping mechanism works, so narrowing admins later is policy, not
   engineering.
3. **Leaving an organisation — resolved** (revision 2). Mode B: unenrolment is
   the grant's `revoked_at`; the organisation's access ends, the family's
   history was never anyone else's, and aggregate term reports keep resolving.
   Mode A: the organisation owns the data, so leaving produces an export
   bundle a guardian may claim; define the bundle's contents with M3.
4. **Seat accounting — resolved** (revision 2), by adopting Aksharavazhi's
   semantics tier-wide: a seat is consumed when an invite is accepted and
   released on revocation or unenrolment. A lapsed plan degrades to
   **read-only for staff — it never refuses a child mid-lesson** (the
   Saturday-morning constraint makes anything else unacceptable). Inactive
   learners hold their seat until unenrolled; hoarding is the coordinator's
   problem to see, so the seat list shows last-active.

---

## 10. Milestones

Each ships independently and is useful on its own.

> **Build status, 2026-08-25.** M1, M2 and the server half of M3 are
> **built and tested** — the resolver with all three branches, the schema
> with its constraint, the invite chain, the grant, the four roles, PIN
> sign-in and profile sessions, and the coordinator API. What remains of
> M3 is the coordinator's **UI** (mock 09 is the design); M4 is untouched.
> Implementation notes live beside the code:
> `packages/keylearn-database/lib/organizations.ts`,
> `packages/server/lib/app/access/resolver.ts`,
> `packages/server/lib/app/org/controller.ts`.

**M1 — Resolver refactor.** Replace `findOwned` with the actor/profile
chokepoint, still household-only behind it. Zero behaviour change, fully
testable, de-risks everything after it. **Done** — all 13 call sites
migrated, 202 server tests green, no behaviour change.

**M2 — PIN sign-in for households.** Opt-in. Exercises session-scoped profiles
with no organisation concepts, and closes the profile-switching gap that exists
in the product today. **Done** — `POST /_/profiles/{id}/enter` and
`/_/profiles/exit`, scrypt via the existing password path, per-profile
escalating lockout, and the resolver's §5.2 narrowing.

**M3 — Organisations.** (Grown by revision 2 — these are Aksharavazhi's
prerequisites, and none is separable:) organisation, members, **four** roles,
batches, mode-A learner creation, **the invite chain (§5.3), and the
enrolment grant (§4.4)**. The resolver gains its second and third branches.

**M4 — Organisation billing and admin UI.** Includes the pricing honesty
check (§8): the support pitch and billing Answers change before the first
invoice exists.

**M5 — Aksharavazhi** (revision 2). Schools, content bundles, the mastery
engine, missions, offline queue — the module spec's own phasing, landing on a
spine that already fits it. Tier-level features it leans on (§8: projection
shell, progress interface, certificates) ship with it or just before.

M1 and M2 are worth doing whether or not organisations ever ship.

---

## 11. Acceptance criteria

**A1.** A household account that existed before the change sees no difference:
same screens, same profile switching, same limits, and no PIN prompt anywhere.

**A2.** Exactly one of `user_id` / `organization_id` is set on every profile
row, and the database refuses a row where that is not true.

**A3.** Every profile-scoped endpoint reaches the resolver, and no endpoint
answers the access question itself. A test enumerates the endpoints and fails
if one bypasses it.

**A4.** An admin of organisation A, authenticated, cannot read, write or list
any profile of organisation B or of any household — by id, by batch, or by
enumeration.

**A5.** With a profile session active, a request naming a different profile is
refused, not silently served the session's profile.

**A6.** Wrong PINs lock the profile they were entered against, and no other
profile — proven with two learners behind one address.

**A7.** A locked learner is cleared only by an owner or admin of their
organisation, and the clearing is recorded in the security log.

**A8.** No PIN appears in any log line, URL, error body or exception message.

**A9.** An organisation's learners do not appear on the public leaderboard and
load no ad or analytics script, with no configuration required.

**A10.** Removing the last owner of an organisation is refused.

(Revision 2:)

**A11.** A teacher of batch X, authenticated, cannot read, write or list any
learner outside batch X — including learners of other batches in their own
organisation — by id, by enumeration, or through any report.

**A12.** Revoking a `profile_access` grant ends the organisation's access to
that learner within one request, leaves the guardian's own access untouched,
and leaves previously generated aggregate reports readable.

**A13.** Every acquired org membership traces to an accepted invite row —
there exists no code path that attaches an account to an organisation without
one — and an expired, revoked or reused invite link fails closed with no seat
consumed.

**A14.** A lapsed organisation plan blocks no learner from practising; staff
surfaces degrade to read-only and say why.

**A15.** Every staff view of an individual learner's progress writes an audit
row naming the viewer, the learner and the time, and the organisation's owner
can read that log.
