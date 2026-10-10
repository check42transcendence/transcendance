# P0 Database Contract

Status: Draft  
Scope: P0  
Owner: Tech Lead  
Product baseline: Frozen P0 Scope / PRD / Business Rules v2 — 2026-10-09  
Depends on: `00-DOMAIN_VOCABULARY.md`, `01-ARCHITECTURE.md`, `02-DOMAIN_MODEL.md`, `03-AUTH_CONTRACT.md`

## Purpose

This document defines the shared P0 persistence contract for PostgreSQL + Prisma.

It translates the frozen product/domain rules into database rules that all Vertical Slices must respect.

This contract defines:

- persisted entities and fields;
- database data types;
- primary/foreign keys;
- unique constraints and indexes;
- deletion behaviour;
- transaction boundaries;
- optimistic and pessimistic concurrency requirements;
- Prisma migration rules.

The database is not allowed to invent product behaviour that conflicts with the frozen P0 Business Rules.

---

# 1. Database Baseline

P0 uses:

```text
PostgreSQL
Prisma ORM
UUID primary keys
```

General conventions:

- application/domain identifiers use UUID;
- persisted audit timestamps use PostgreSQL `TIMESTAMPTZ`;
- Trip/Itinerary calendar dates use `DATE`;
- P0 Activity schedule times use `TIME`;
- enum-like values are represented by PostgreSQL/Prisma enums where practical;
- nullable fields are used only when the product rule genuinely allows absence.

P0 Activity does **not** support crossing midnight.

Therefore:

```text
ItineraryDay.date  = DATE
Activity.start_time = TIME
Activity.end_time   = TIME nullable
```

and:

```text
end_time IS NULL OR end_time >= start_time
```

---

# 2. Canonical P0 Persisted Models

P0 persists these eight core models:

```text
user
trip
trip_member
trip_invitation
itinerary_day
activity
proposal
proposal_vote
```

The names above follow the current ERD vocabulary.

Prisma model names may use normal TypeScript/Prisma casing as long as the meaning remains identical.

---

# 3. `user`

## Required fields

| Field | Type | Null | Rule |
|---|---|---:|---|
| `id` | UUID | No | Primary Key |
| `email` | VARCHAR(254) | No | Case-insensitive unique identity |
| `username` | VARCHAR(50) | No | Case-insensitive unique identity |
| `password_hash` | VARCHAR(255) | No | Argon2id hash only |
| `created_at` | TIMESTAMPTZ | No | Server/DB generated |

## Rules

- `email` and `username` are trimmed before storage/lookup.
- Email and Username uniqueness must be case-insensitive.
- Original casing may be preserved for display.
- Password plaintext must never be stored.
- P0 has no account deletion feature.

## Required uniqueness

Database migrations must enforce the equivalent of:

```text
UNIQUE(lower(email))
UNIQUE(lower(username))
```

A PostgreSQL functional unique index or an equivalent reviewed implementation is acceptable.

---

# 4. `trip`

## Required fields

| Field | Type | Null | Rule |
|---|---|---:|---|
| `id` | UUID | No | Primary Key |
| `title` | VARCHAR(120) | No | Required |
| `destination` | VARCHAR(120) | No | Required |
| `description` | TEXT | Yes | Optional |
| `start_date` | DATE | No | Required |
| `end_date` | DATE | No | Required |
| `created_by` | UUID | No | FK → `user.id`; historical Creator only |
| `created_at` | TIMESTAMPTZ | No | Server/DB generated |
| `updated_at` | TIMESTAMPTZ | No | Initialized at creation; P0 exposes no Trip update |

## Rules

- `created_by` records historical creation only.
- `created_by` must **not** be used to authorize Owner actions.
- Owner authority comes only from `trip_member.role = OWNER`.
- Trip base data is immutable after creation in P0.
- P0 has no Edit Trip endpoint.

## Check constraint

```text
end_date >= start_date
```

## P0 technical guardrail

The inclusive Trip date range must not exceed:

```text
90 calendar days
```

This avoids accidentally generating an unbounded number of ItineraryDay rows in the MVP.

The check may be implemented in backend validation and/or a database check constraint.

---

# 5. `trip_member`

`trip_member` is the current Membership table for both Owner and normal Members.

## Required fields

| Field | Type | Null | Rule |
|---|---|---:|---|
| `id` | UUID | No | Primary Key |
| `trip_id` | UUID | No | FK → `trip.id` |
| `user_id` | UUID | No | FK → `user.id` |
| `role` | ENUM | No | `OWNER` or `MEMBER` |
| `joined_at` | TIMESTAMPTZ | No | Server/DB generated |

## Enum

```text
MembershipRole:
OWNER
MEMBER
```

## Required constraints

### One Membership per User per Trip

```text
UNIQUE(trip_id, user_id)
```

### At most one Owner per Trip

Database migration must enforce:

```text
for each trip_id:
at most one row where role = OWNER
```

Recommended PostgreSQL implementation:

```text
partial UNIQUE index on trip_id WHERE role = 'OWNER'
```

### Exactly one Owner

The database unique index guarantees **at most** one Owner.

The application transaction that creates a Trip must guarantee **at least** one Owner by creating:

```text
Trip
+
Creator's trip_member(role = OWNER)
```

in the same transaction.

P0 does not allow deleting or changing the Owner Membership independently.

---

# 6. `trip_invitation`

## Required fields

| Field | Type | Null | Rule |
|---|---|---:|---|
| `id` | UUID | No | Primary Key |
| `trip_id` | UUID | No | FK → `trip.id` |
| `invited_by` | UUID | No | FK → `user.id` |
| `invitee_id` | UUID | No | FK → `user.id` |
| `status` | ENUM | No | `PENDING / ACCEPTED / REJECTED` |
| `created_at` | TIMESTAMPTZ | No | Server/DB generated |
| `responded_at` | TIMESTAMPTZ | Yes | Set on Accept/Reject |

## Enum

```text
InvitationStatus:
PENDING
ACCEPTED
REJECTED
```

## Rules

- only the current Owner may create an Invitation;
- Invitee must already exist as a registered User;
- Pending does not create Membership;
- Accept creates a `MEMBER` Membership;
- Reject creates no Membership;
- rejected Users may be invited again later.

## Pending uniqueness

For one:

```text
trip_id + invitee_id
```

there may be at most one current `PENDING` Invitation.

Because historical ACCEPTED/REJECTED rows may remain, a normal global:

```text
UNIQUE(trip_id, invitee_id)
```

must **not** be used.

The migration must use a partial unique constraint/index equivalent to:

```text
UNIQUE(trip_id, invitee_id)
WHERE status = 'PENDING'
```

---

# 7. `itinerary_day`

All P0 Itinerary Days are generated when the Trip is created.

## Required fields

| Field | Type | Null | Rule |
|---|---|---:|---|
| `id` | UUID | No | Primary Key |
| `trip_id` | UUID | No | FK → `trip.id` |
| `day_number` | INTEGER | No | Starts at 1 |
| `date` | DATE | No | Calendar date in Trip range |
| `created_at` | TIMESTAMPTZ | No | Server/DB generated |

## Required constraints

```text
UNIQUE(trip_id, date)
UNIQUE(trip_id, day_number)
day_number >= 1
```

## Rules

- one Day exists for every date from `start_date` through `end_date`, inclusive;
- Day rows are created automatically inside the Trip creation transaction;
- users cannot manually create, delete, shift, or renumber Days in P0;
- Trip dates are immutable;
- deleting the Trip deletes its Days.

---

# 8. `activity`

## Required fields

| Field | Type | Null | Rule |
|---|---|---:|---|
| `id` | UUID | No | Primary Key |
| `trip_id` | UUID | No | FK → `trip.id` |
| `itinerary_day_id` | UUID | No | FK → `itinerary_day.id` |
| `proposal_id` | UUID | Yes | Optional Proposal origin |
| `title` | VARCHAR(160) | No | Required |
| `start_time` | TIME | No | Required |
| `end_time` | TIME | Yes | Optional |
| `location` | VARCHAR(255) | Yes | Optional |
| `description` | TEXT | Yes | Optional |
| `version` | INTEGER | No | OCC version; starts at 1 |
| `created_by` | UUID | No | FK → `user.id` |
| `updated_by` | UUID | No | FK → `user.id`; current last editor |
| `created_at` | TIMESTAMPTZ | No | Server/DB generated |
| `updated_at` | TIMESTAMPTZ | No | Current last-edited time |

## Intentional differences from the current ERD

For Frozen P0:

```text
itinerary_day_id
```

is **mandatory**, not optional.

P0 has no Unscheduled Activity Pool.

The ERD field:

```text
is_locked
```

must not be part of the P0 Prisma schema because Activity Locking is outside P0.

The current ERD `timestamp` schedule fields are replaced by:

```text
start_time TIME
end_time TIME nullable
```

because P0 does not support cross-day Activities.

## Time check

```text
end_time IS NULL OR end_time >= start_time
```

## Proposal origin

`proposal_id` is:

- `NULL` for directly created Activities;
- set to the source Proposal ID when Activity is created through Adoption.

Required uniqueness:

```text
UNIQUE(proposal_id)
```

PostgreSQL permits multiple `NULL` values in a normal unique constraint, so direct Activities are not affected.

This guarantees:

```text
one Proposal
→ at most one current Proposal-sourced Activity
```

## Same-Trip consistency

The backend/database layer must guarantee:

```text
activity.trip_id
=
itinerary_day.trip_id
```

and, when `proposal_id` is not null:

```text
activity.trip_id
=
proposal.trip_id
```

A reviewed composite FK strategy or equivalent database constraint may be used.

The service must never trust unrelated IDs supplied by the client.

## Activity creation metadata

At creation:

```text
created_by = authenticated user
updated_by = authenticated user
created_at = now
updated_at = now
version = 1
```

---

# 9. Activity Optimistic Concurrency Control

P0 must prevent stale Activity updates from silently overwriting newer data.

The Activity `version` field is the concurrency token.

## Update contract

Client sends the version it last read:

```text
expected_version
```

Backend updates only if the stored version still matches.

Conceptually:

```sql
UPDATE activity
SET
  ...fields...,
  version = version + 1,
  updated_by = current_user_id,
  updated_at = now()
WHERE id = :activity_id
  AND version = :expected_version;
```

## Success

Exactly one row updated:

```text
save succeeds
version increments
updated_by / updated_at refresh
```

## Conflict

Zero rows updated because the version is stale:

```text
no overwrite occurs
```

The REST Contract must expose this as:

```text
409 Conflict
ACTIVITY_VERSION_CONFLICT
```

The client should keep the user's unsaved form values and offer the latest server state.

---

# 10. `proposal`

## Required fields

| Field | Type | Null | Rule |
|---|---|---:|---|
| `id` | UUID | No | Primary Key |
| `trip_id` | UUID | No | FK → `trip.id` |
| `title` | VARCHAR(160) | No | Required |
| `description` | TEXT | Yes | Optional |
| `is_adopted` | BOOLEAN | No | Default `false` |
| `created_by` | UUID | No | FK → `user.id` |
| `created_at` | TIMESTAMPTZ | No | Server/DB generated |

## Meaning of `is_adopted`

```text
false
= Proposal is currently not adopted

true
= Proposal has been manually adopted
```

`is_adopted` is a state marker.

It is not the Activity relationship itself.

No normal P0 API may directly toggle `is_adopted`.

It changes only through the Adoption / adopted-Activity deletion transactions defined below.

---

# 11. `proposal_vote`

## Required fields

| Field | Type | Null | Rule |
|---|---|---:|---|
| `id` | UUID | No | Primary Key |
| `proposal_id` | UUID | No | FK → `proposal.id` |
| `user_id` | UUID | No | FK → `user.id` |
| `decision` | ENUM | No | `AGREE` or `REJECT` |
| `voted_at` | TIMESTAMPTZ | No | Set/updated when current Vote changes |

## Enum

```text
VoteDecision:
AGREE
REJECT
```

## Important: no persisted `PENDING`

P0 does **not** persist:

```text
decision = PENDING
```

Instead:

```text
no proposal_vote row
=
not voted / logically pending
```

## One current Vote

```text
UNIQUE(proposal_id, user_id)
```

Changing:

```text
AGREE ↔ REJECT
```

updates the existing row.

P0 does not define a separate retract-to-unvoted action.

## Adopted Proposal

If:

```text
proposal.is_adopted = true
```

Vote creation/change is rejected.

---

# 12. Strict Majority Query Rule

For one Proposal:

```text
N = count of current trip_member rows for the Trip
A = count of current proposal_vote rows with decision = AGREE
```

Adoption is allowed only when:

```text
A > N / 2
```

Equivalent:

```text
A >= floor(N / 2) + 1
```

`N` includes:

- the Owner;
- every current Member;
- current participants with no Vote row.

A User who has left is not part of `N`.

Their previous Vote must not remain active.

---

# 13. Member Leave Transaction

A normal `MEMBER` may Leave Trip.

Leave affects both:

- Membership;
- that User's current Votes in the Trip.

The operation must be atomic.

## Required transaction

```text
BEGIN
  lock the Trip concurrency boundary
  verify current role = MEMBER
  delete this User's proposal_vote rows for Proposals in this Trip
  delete trip_member row
COMMIT
```

If any step fails:

```text
ROLLBACK
```

Historical Activities and Proposals created by the User remain.

This physical Vote deletion prevents old Votes from silently reappearing if the User is invited and joins again later.

---

# 14. Invitation Accept Transaction

Accepting an Invitation changes the current participant count `N`, so it must be consistent with concurrent Adoption.

Required behaviour:

```text
BEGIN
  lock Trip concurrency boundary
  lock / verify Invitation is still PENDING
  verify User is not already a current member
  create trip_member(role = MEMBER)
  set Invitation.status = ACCEPTED
  set responded_at = now
COMMIT
```

A duplicate Membership or already-processed Invitation must not create another Membership.

Rejecting an Invitation does not change Membership count and only changes:

```text
PENDING → REJECTED
```

plus `responded_at`.

---

# 15. Vote Change Transaction

Vote changes affect Adoption eligibility.

A Vote mutation must therefore use the same concurrency discipline as Adoption.

Required behaviour:

```text
BEGIN
  lock Trip row
  lock Proposal row
  verify current TripMembership
  verify Proposal belongs to Trip
  verify Proposal.is_adopted = false
  insert or update proposal_vote
COMMIT
```

Lock order must always be:

```text
Trip first
Proposal second
```

for all P0 flows that need both locks.

This reduces deadlock risk and makes the majority calculation stable.

---

# 16. Proposal Adoption Transaction

Adoption is a multi-row state change and must be atomic.

It must not trust a majority result calculated earlier in the frontend.

## Required sequence

```text
BEGIN
  1. lock Trip row
  2. lock Proposal row
  3. verify caller still has current TripMembership
  4. verify Proposal belongs to Trip
  5. verify Proposal.is_adopted = false
  6. count current Trip participants N
  7. count current AGREE Votes A
  8. require A > N / 2
  9. verify itinerary_day belongs to the same Trip
 10. validate start_time / end_time
 11. insert Activity with activity.proposal_id = proposal.id
 12. update Proposal.is_adopted = true
COMMIT
```

Only after commit may the Realtime layer broadcast the successful Adoption.

## Lost-majority race

Example:

```text
A opens Adopt form while majority is satisfied
B changes AGREE → REJECT
A submits
```

If B's transaction commits first, A must see the new state when A obtains the locks/recalculates.

If:

```text
A <= N / 2
```

then A's Adoption transaction must:

```text
ROLLBACK
create no Activity
leave is_adopted = false
```

The REST Contract must expose this as:

```text
409 Conflict
PROPOSAL_MAJORITY_LOST
```

## Concurrent double-Adopt

If two Users submit Adoption nearly together:

- the shared Trip/Proposal lock discipline serializes them;
- the first valid transaction may succeed;
- the second must see `is_adopted = true` and fail;
- `UNIQUE(activity.proposal_id)` is the final database safety net.

The REST Contract must map the second attempt to a conflict such as:

```text
409 Conflict
PROPOSAL_ALREADY_ADOPTED
```

---

# 17. Delete Proposal-Sourced Activity Transaction

When deleting an Activity:

## Direct Activity

If:

```text
activity.proposal_id IS NULL
```

delete normally.

## Proposal-sourced Activity

If:

```text
activity.proposal_id IS NOT NULL
```

the delete must atomically reopen the Proposal.

Required sequence:

```text
BEGIN
  lock Trip row
  lock referenced Proposal row
  verify current TripMembership
  delete Activity
  set Proposal.is_adopted = false
COMMIT
```

Existing Vote rows remain.

After commit:

- Proposal is unadopted;
- voting is available again;
- re-Adoption must recalculate current Strict Majority;
- a new Proposal-sourced Activity may be created later.

The system must never expose a committed state where:

```text
Proposal.is_adopted = true
```

but the adopted Activity has already been deleted.

---

# 18. Trip Creation Transaction

Trip creation must create one complete valid initial workspace.

Required sequence:

```text
BEGIN
  create Trip
  create trip_member(role = OWNER) for Creator
  generate all itinerary_day rows from start_date through end_date
COMMIT
```

If Day generation or Owner Membership creation fails:

```text
ROLLBACK entire Trip creation
```

A committed Trip must never exist with zero Owner Memberships or a partially generated Day range.

---

# 19. Trip Delete / Cascade

Only current Owner may request Trip deletion.

Deleting a Trip removes the complete P0 Workspace.

Required final result:

```text
Trip
TripMemberships
Invitations
ItineraryDays
Activities
Proposals
Votes
```

are removed.

P0 has no:

```text
Archive
Restore
Trash
```

Database FKs should use cascade behaviour for Trip-owned records where practical.

User records are not deleted.

Historical user references therefore use `RESTRICT / NO ACTION` semantics rather than cascading account deletion.

---

# 20. Foreign-Key Behaviour Summary

Conceptual deletion rules:

| Parent | Child | P0 rule |
|---|---|---|
| `trip` | `trip_member` | Delete with Trip |
| `trip` | `trip_invitation` | Delete with Trip |
| `trip` | `itinerary_day` | Delete with Trip |
| `trip` | `activity` | Delete with Trip |
| `trip` | `proposal` | Delete with Trip |
| `proposal` | `proposal_vote` | Delete with Proposal/Trip |
| `itinerary_day` | `activity` | Day cannot be deleted independently in P0; Trip teardown removes both |
| `proposal` | Proposal-sourced `activity` | No Proposal Delete endpoint in P0; Trip teardown removes both |
| `user` | historical references | Do not cascade-delete P0 history |

Exact Prisma `onDelete` declarations must reproduce these behaviours without creating cascade cycles or cross-Trip inconsistencies.

---

# 21. Required Indexes

In addition to PK/UNIQUE constraints, P0 should index common lookup paths.

Required/recommended indexes:

```text
trip_member(user_id)
trip_member(trip_id)

trip_invitation(invitee_id, status)
trip_invitation(trip_id)

itinerary_day(trip_id, date)

activity(trip_id)
activity(itinerary_day_id, start_time)
activity(proposal_id)

proposal(trip_id, created_at)

proposal_vote(proposal_id)
proposal_vote(user_id)
```

Indexes are for query performance.

They do not replace authorization or business validation.

---

# 22. Server-Controlled Fields

The client must not be trusted to directly set:

```text
id
created_by
updated_by
created_at
updated_at
voted_at
Membership role
Invitation status transitions
Proposal.is_adopted
Activity.version
```

The backend derives or controls them.

Examples:

- acting User comes from authenticated context;
- timestamps come from backend/DB time;
- `OWNER` is created only in the Trip creation flow;
- `MEMBER` is created only through valid Membership flow;
- `is_adopted` changes only inside Adoption/delete-adopted-Activity transactions.

---

# 23. Realtime Boundary

Database commit happens before Realtime success broadcast.

Required order:

```text
validate
→ transaction
→ COMMIT
→ broadcast
```

Never:

```text
broadcast success
→ database write later
```

If a transaction rolls back, no successful realtime mutation event may be emitted.

---

# 24. Prisma Migration Rules

Shared schema changes use committed Prisma migrations.

Required workflow:

```text
edit Prisma schema
→ create migration
→ inspect generated SQL
→ add reviewed raw SQL when Prisma cannot express a required constraint
→ test on clean PostgreSQL
→ commit schema + migration together
```

P0 may require reviewed raw SQL migrations for constraints such as:

- case-insensitive functional unique indexes;
- partial unique OWNER index;
- partial unique PENDING Invitation index;
- other PostgreSQL constraints Prisma cannot express directly.

Rules:

- do not use `prisma db push` as the shared/main schema strategy;
- do not manually mutate the shared database without migration;
- do not rewrite a migration after it has been merged and used by others;
- fix merged schema history with a new corrective migration.

---

# 25. Database Error / Conflict Mapping

Database/business-state conflicts must be converted by the backend into stable application errors.

The REST Contract will define final payloads, but P0 expects these mappings:

```text
stale Activity version
→ 409 ACTIVITY_VERSION_CONFLICT

Proposal majority lost before Adoption submit
→ 409 PROPOSAL_MAJORITY_LOST

Proposal already adopted / duplicate proposal_id Activity
→ 409 PROPOSAL_ALREADY_ADOPTED

duplicate current Membership
→ 409 MEMBERSHIP_ALREADY_EXISTS

duplicate effective Pending Invitation
→ 409 INVITATION_ALREADY_PENDING
```

Raw PostgreSQL/Prisma error strings must not be exposed directly to the frontend.

---

# 26. Required Database Integration Tests

Before freezing/merging the final P0 schema, automated tests should verify at least:

1. duplicate Email/Username is rejected case-insensitively;
2. one User cannot have duplicate Membership in one Trip;
3. one Trip cannot have two OWNER Membership rows;
4. one Trip + Invitee cannot have two PENDING Invitations;
5. Reject allows later re-invitation;
6. Trip creation creates exactly one Owner and all expected Days;
7. Activity cannot exist without a valid Day;
8. Activity End Time cannot be earlier than Start Time;
9. `activity.proposal_id` cannot be used by two current Activities;
10. stale Activity version update does not overwrite;
11. one User cannot have two current Votes on one Proposal;
12. logical not-voted state is represented by no Vote row;
13. Member Leave removes their current Votes but preserves Activities/Proposals;
14. Adoption recalculates current majority inside the transaction;
15. lost majority prevents Activity creation and leaves `is_adopted = false`;
16. simultaneous Adoption attempts produce at most one Activity;
17. deleting a Proposal-sourced Activity resets `is_adopted = false`;
18. Trip deletion removes the complete Workspace.

---

# 27. Explicit P0 Database Non-Goals

The P0 schema must not add fields/tables solely for:

- Edit Trip / date shifting;
- Unscheduled Activity Pool;
- Activity Locking / Confirmed state;
- Activity participant attendance;
- Proposal Deadline / manual Close;
- Proposal Edit/Delete workflow;
- automatic Proposal-to-Activity conversion;
- Owner Transfer;
- Editor / Viewer roles;
- Chat / Messages;
- Notifications Center;
- Files;
- Budget;
- Maps;
- full Activity Audit Log;
- PWA / offline synchronization.

These require a future scope/contract change.

---

# Review Checklist

Before freezing this Database Contract, confirm:

- [ ] UUID + PostgreSQL + Prisma baseline is accepted.
- [ ] `trip_member.role` is the only Owner authorization source.
- [ ] exactly one current OWNER is protected by DB + creation transaction.
- [ ] Trip base data has no P0 update path.
- [ ] all ItineraryDays are generated at Trip creation.
- [ ] `activity.itinerary_day_id` is mandatory.
- [ ] `activity.is_locked` is removed from P0.
- [ ] Activity schedule uses `TIME`, and P0 does not support cross-day Activity.
- [ ] Activity uses `version` OCC for stale-update protection.
- [ ] `activity.proposal_id` is nullable and unique.
- [ ] `proposal.is_adopted` remains the explicit adoption marker.
- [ ] Vote enum is only `AGREE / REJECT`; not-voted means no row.
- [ ] Member Leave prevents old Votes from reactivating.
- [ ] Strict Majority uses all current participants as denominator.
- [ ] Vote / Membership / Adoption mutations share a consistent locking discipline.
- [ ] lost majority during Adoption submission produces no Activity.
- [ ] duplicate concurrent Adoption cannot create two Activities.
- [ ] deleting Proposal-sourced Activity resets `is_adopted` atomically.
- [ ] successful database commit happens before realtime broadcast.
- [ ] migrations are committed and reviewed; raw SQL is allowed when required for PostgreSQL constraints.
