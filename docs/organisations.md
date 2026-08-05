# Organisations — phase 2 specification

Status: **draft for review** · Owner: Abhijath · Last updated: 2026-08-05

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

**P4 — A learner belongs to exactly one owner.** A household or an
organisation, never both, never neither, and the database enforces it rather
than the code remembering to.

**P5 — Children in an organisation are still children.** Every protection the
kids product already applies — no ads, no public leaderboard, no
behavioural analytics — applies at school too, and by default rather than by
configuration.

---

## 2. The structure

```
Household (phase 1, unchanged)        Organisation (phase 2)
Account                               Organisation
  └── Profile                           ├── OrgMember → Account
      kind = adult | kid                │     ├── owner
      PIN optional                      │     └── admin
                                        └── Batch
                                              └── Profile   PIN required
```

Three levels, matching the roles the business actually has: the **owner** who
pays and is accountable, the **admin** who runs day-to-day teaching, and the
**learner** who practises.

A **batch** is a cohort — an intake, a timetabled group, "Tuesday 5pm
beginners". It groups learners for the admin's convenience. It is deliberately
_not_ an access boundary in this phase; see §7.

There is no educator role in phase 2. Batches are already the unit an educator
would be scoped to, so adding one later is data rather than schema.

---

## 3. Roles and permissions

|                                       | owner | admin | learner  |
| ------------------------------------- | ----- | ----- | -------- |
| Billing, seats, plan                  | ✓     |       |          |
| Delete the organisation               | ✓     |       |          |
| Transfer ownership                    | ✓     |       |          |
| Appoint and remove admins             | ✓     |       |          |
| Create and edit batches               | ✓     | ✓     |          |
| Create and edit learner profiles      | ✓     | ✓     |          |
| Set and reset learner PINs            | ✓     | ✓     |          |
| See any learner's progress in the org | ✓     | ✓     | own only |
| Practise                              |       |       | ✓        |

**Owner implies admin.** Implement it as a superset, not as two disjoint sets,
so no permission can ever exist that an admin has and an owner does not.

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

| Table               | Columns                                                               |
| ------------------- | --------------------------------------------------------------------- |
| `organization`      | `id`, `parent_id?`, `name`, `type`, `created_at`                      |
| `org_member`        | `id`, `organization_id`, `user_id`, `role`, `batch_id?`, `created_at` |
| `batch`             | `id`, `organization_id`, `name`, `starts_on?`, `ends_on?`             |
| `organization_plan` | `organization_id`, `seats`, `valid_until`, `provider`, `provider_ref` |

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

---

## 5. Access control

### 5.1 The single chokepoint

Today every profile-scoped endpoint calls `Profile.findOwned(userId, id)`.
Phase 2 replaces it with one resolver that answers _may this actor reach this
profile_, and branches internally:

- `profile.organization_id IS NULL` → the existing `user_id` comparison,
  unchanged. Household behaviour is then preserved by construction (P1).
- otherwise → the actor is a member of that organisation. Role decides what
  they may **do**; membership alone decides what they may **see**.

Every caller keeps its current shape. Adding a layer later — educators,
per-batch admins, shared access — is a branch in this function and a table, not
an audit of the codebase.

### 5.2 Learner sessions

A learner reaching their own data is the same question asked of a different
actor. When a profile session is active (§6), the resolver answers only for
that profile, whatever the request asks for.

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
- **Required in organisations, optional in households.** A household that sets
  no PIN behaves exactly as it does today (P1).
- **A PIN is never a password reset path** and never appears in a URL, a log or
  an error message.

---

## 7. Room to expand

Four seams are cut in phase 2 because retrofitting them is expensive and
leaving them open is nearly free. None of them is _built_ in phase 2.

| Seam                                                        | Cost now            | What it buys                                                            |
| ----------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------- |
| `organization.parent_id`                                    | one nullable column | school → campus, company → branch, without restructuring scoped queries |
| `org_member.batch_id`                                       | one nullable column | per-batch admins, and the educator role, as data rather than migration  |
| `role` as an open string + one `can(role, action)` function | none                | a new role is one string and one line; no DB enum migration             |
| `organization_plan` as a record                             | none                | a second plan shape does not become a second boolean                    |

**Deliberately not built:** custom roles with a permission editor, polymorphic
ownership, batch history, event-sourced membership. All plausible, none
requested, each one maintained through every schema change in between.

### 7.1 The expansion that would break the model

A learner who belongs to a household _and_ an organisation — a child who
practises at home and whose coaching centre also tracks them — is forbidden by
P4. The failure mode is two profiles, split progress and two sets of unlocked
keys, and it is very expensive to unpick after launch.

The answer is not to weaken ownership. It is to allow a **grant** rather than a
transfer:

```
profile_access(profile_id, organization_id, granted_by, scope, granted_at)
```

The household keeps the child; the organisation sees progress because a parent
said so. Not in phase 2 — but the resolver (§5.1) is where it lands, and the
interesting part is consent, not schema.

---

## 8. Decisions still open

These are policy, not engineering, and they change the schema if answered late.

1. **Consent at school.** Profiles carry `parentalConsent` / `consentAt`, and
   `createProfile` refuses a child without it. In an organisation the lawful
   basis usually comes from the institution, not the parent. If organisations
   may create learners without a parent record, that must be decided before the
   schema hardens.
2. **Admin breadth.** Every admin currently sees every learner in the
   organisation. Right for a coaching centre; possibly too broad for a school
   of eight hundred. `org_member.batch_id` is the answer if it is, and costs
   nothing until then.
3. **Leaving an organisation.** What happens to a learner's history when a
   student changes school, and who may export a batch before it closes.
4. **Seat accounting.** Whether an inactive learner holds a seat, and what
   happens when a plan lapses mid-term — refusing sign-in to children mid-lesson
   is not acceptable, so the degraded state needs defining.

---

## 9. Milestones

Each ships independently and is useful on its own.

**M1 — Resolver refactor.** Replace `findOwned` with the actor/profile
chokepoint, still household-only behind it. Zero behaviour change, fully
testable, de-risks everything after it.

**M2 — PIN sign-in for households.** Opt-in. Exercises session-scoped profiles
with no organisation concepts, and closes the profile-switching gap that exists
in the product today.

**M3 — Organisations.** Organisation, members, roles, batches, learner
creation. The resolver gains its second branch.

**M4 — Organisation billing and admin UI.**

M1 and M2 are worth doing whether or not organisations ever ship.

---

## 10. Acceptance criteria

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
