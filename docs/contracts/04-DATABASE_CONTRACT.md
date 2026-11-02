# P0 Database Contract

Status: Frozen  
Scope: P0  
Owner: Tech Lead  
Depends on: `00-DOMAIN_VOCABULARY.md`, `02-DOMAIN_MODEL.md`, `03-AUTH_CONTRACT.md`

## Purpose

Defines the authoritative P0 PostgreSQL/Prisma persistence model, constraints, transactions, concurrency rules, and migration rules.

## 1. Baseline

```text
PostgreSQL
Prisma ORM
UUID primary keys
```

Time types:

```text
Trip / ItineraryDay date: DATE
Activity start/end time: TIME WITHOUT TIME ZONE
audit timestamps: TIMESTAMPTZ
```

Native PostgreSQL enums:

```text
member_role: OWNER | MEMBER
invitation_status: PENDING | ACCEPTED | REJECTED
vote_decision: AGREE | REJECT
proposal_status: PENDING | ACCEPTED
```

P0 Activity does not cross midnight.

## 2. Persisted Models

Exactly these eight core models:

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

## 3. user

Required fields:

```text
id UUID PK
email VARCHAR(254)
username VARCHAR(50)
password_hash VARCHAR(255)
created_at TIMESTAMPTZ
```

Rules:

- Email and Username required and case-insensitively unique;
- trim before lookup/storage;
- original casing may be preserved;
- password plaintext never stored.

Migration must enforce equivalent of:

```text
UNIQUE(lower(email))
UNIQUE(lower(username))
```

## 4. trip

Required fields:

```text
id UUID PK
title VARCHAR(120) NOT NULL
destination VARCHAR(120) NOT NULL
description TEXT NULL
start_date DATE NOT NULL
end_date DATE NOT NULL
created_by UUID FK user.id
created_at TIMESTAMPTZ NOT NULL
```

Rules:

```text
end_date >= start_date
```

`created_by` is historical only.

Trip base fields have no P0 update path.

Trip creation is limited to 365 days, including both start_date and end_date
(P0 update: 2026-10-29). The backend checks this before generating Days or writing
data; this is an API creation limit, not an additional SQL constraint.

## 5. trip_member

Fields:

```text
id UUID PK
trip_id UUID FK
user_id UUID FK
role member_role NOT NULL
joined_at TIMESTAMPTZ NOT NULL
```

Constraints:

```text
UNIQUE(trip_id, user_id)
```

Database must enforce at most one OWNER per Trip, e.g. reviewed partial unique index.

Trip creation transaction guarantees at least one OWNER.

## 6. trip_invitation

Fields:

```text
id UUID PK
trip_id UUID FK
invited_by UUID FK user.id
invitee_id UUID FK user.id
status invitation_status NOT NULL
created_at TIMESTAMPTZ NOT NULL
responded_at TIMESTAMPTZ NULL
```

At most one current Pending Invitation per `(trip_id, invitee_id)`.

Historical Accepted/Rejected Invitations may remain.

## 7. itinerary_day

Fields:

```text
id UUID PK
trip_id UUID FK
day_number INTEGER NOT NULL
date DATE NOT NULL
created_at TIMESTAMPTZ NOT NULL
```

Constraints:

```text
UNIQUE(trip_id, date)
UNIQUE(trip_id, day_number)
day_number >= 1
```

Every Trip date is generated at Trip creation.

No Day CRUD.

## 8. activity

Fields:

```text
id UUID PK
trip_id UUID FK
itinerary_day_id UUID FK NOT NULL
proposal_id UUID FK NULL
title VARCHAR(160) NOT NULL
start_time TIME WITHOUT TIME ZONE NOT NULL
end_time TIME WITHOUT TIME ZONE NULL
location VARCHAR(255) NULL
description TEXT NULL
version INTEGER NOT NULL DEFAULT 1
created_by UUID FK user.id
updated_by UUID FK user.id
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

Rules:

```text
end_time IS NULL OR end_time >= start_time
```

`activity.is_locked` does not exist.

`itinerary_day_id` is mandatory.

Same-Trip relationship must hold between Activity, Day, and optional Proposal.

`proposal_id` is:

```text
NULL for direct Activity
Proposal ID for Adoption-created Activity
```

Required uniqueness:

```text
UNIQUE(proposal_id)
```

## 9. Activity OCC

Activity `version` is the P0 optimistic concurrency token for **updates**.

Update succeeds only when:

```text
stored version == expectedVersion
```

On success:

```text
version += 1
updated_by = current User
updated_at = now
```

Stale update:

```text
409 ACTIVITY_VERSION_CONFLICT
```

P0 does not require version-based OCC for Activity DELETE.

## 10. proposal

Fields:

```text
id UUID PK
trip_id UUID FK
title VARCHAR(160) NOT NULL
description TEXT NULL
status proposal_status NOT NULL DEFAULT PENDING
created_by UUID FK user.id
created_at TIMESTAMPTZ NOT NULL
```

No Proposal `updated_by` / `updated_at` in P0.

Defined transitions:

```text
Create → PENDING
PENDING → ACCEPTED after successful manual Adoption
ACCEPTED → PENDING when Proposal-sourced Activity is deleted
```

P0 has no persisted Proposal `REJECTED` value and no automatic rejection transition.

A REJECT Vote affects vote counts only. It never changes Proposal status.

## 11. proposal_vote

Fields:

```text
id UUID PK
proposal_id UUID FK
user_id UUID FK
decision vote_decision NOT NULL
voted_at TIMESTAMPTZ NOT NULL
```

Constraint:

```text
UNIQUE(proposal_id, user_id)
```

No persisted Vote `PENDING`.

No retract-to-no-vote P0 action.

## 12. Vote Math

For one Proposal:

```text
N = current TripMembership count
A = current AGREE count from current participants
R = current REJECT count from current participants
```

Adoption threshold:

```text
A > N/2
requiredAgreeCount = floor(N/2) + 1
```

`R` is used for vote summary/presentation only. P0 defines no reject threshold and no status transition based on `R`.

## 13. Canonical Lock Order

Majority-affecting transactions use one consistent lock order:

```text
Trip first
Proposal second
```

This applies when both locks are needed.

`SELECT ... FOR UPDATE` may require reviewed raw SQL inside a Prisma interactive transaction.

## 14. Trip Creation Transaction

Atomically:

```text
create Trip
create OWNER Membership
generate all ItineraryDays
COMMIT
```

Failure rolls back all.

## 15. Invitation Accept Transaction

Atomically:

```text
lock Trip
lock/verify Invitation PENDING
verify no current Membership
create MEMBER Membership
set Invitation ACCEPTED
set responded_at
COMMIT
```

Accepting a new Member may change current Proposal vote summaries and Adoption eligibility because `N` changes, but it does not change Proposal status.

Reject Invitation changes Invitation state only.

## 16. Member Leave Transaction

Member only.

Atomically:

```text
lock Trip
verify role=MEMBER
delete leaving User's Vote rows for this Trip
delete Membership
COMMIT
```

Historical Activities/Proposals remain.

Leave may change current Proposal vote summaries and Adoption eligibility because Membership and Vote rows change, but it does not change Proposal status.

## 17. Vote Mutation Transaction

This transaction is defined for `PENDING` Proposals.

```text
lock Trip
lock Proposal
verify current Membership
verify Proposal belongs to Trip
verify Proposal is PENDING
insert/update current Vote
COMMIT
```

A REJECT Vote never changes the Proposal from `PENDING` to another status.

If Proposal is already `ACCEPTED`, Vote mutation is rejected with the canonical closed-voting conflict.

## 18. Adoption Transaction

This transaction is defined for `PENDING` Proposals.

```text
lock Trip
lock Proposal
verify current Membership
verify Proposal belongs to Trip
verify Proposal is PENDING
recompute N/A
require A > N/2
validate Day/time
create Activity(proposal_id=Proposal.id)
set status=ACCEPTED
COMMIT
```

Only after COMMIT may realtime broadcast success.

### Lost majority

If strict AGREE majority is not satisfied at submit time:

```text
ROLLBACK Adoption
no Activity
status remains PENDING
409 PROPOSAL_MAJORITY_LOST
```

### Concurrent double Adoption

Locks plus `UNIQUE(activity.proposal_id)` guarantee at most one current Proposal-sourced Activity.

If first Adoption already committed, second returns:

```text
409 PROPOSAL_ALREADY_ACCEPTED
```

## 19. Delete Proposal-Sourced Activity Transaction

Direct Activity: normal delete.

Proposal-sourced Activity:

```text
lock Trip
lock Proposal
verify Membership
delete Activity
set ACCEPTED → PENDING
COMMIT
```

Existing Votes remain.

## 20. Trip Delete / Cascade

Deleting Trip removes the Workspace:

```text
trip_member
trip_invitation
itinerary_day
activity
proposal_vote
proposal
trip
```

User accounts remain.

## 21. Required Indexes

At minimum index frequently queried foreign keys / sort paths:

```text
trip_member.user_id
trip_invitation.invitee_id
itinerary_day.trip_id
activity.trip_id
activity.itinerary_day_id
proposal.trip_id
proposal_vote.proposal_id
proposal_vote.user_id
```

Exact additional indexes follow measured query needs.

## 22. Server-Controlled Fields

Client must not authoritatively set:

```text
IDs
created_by / updated_by
timestamps
Membership role
Proposal status
Activity version
Vote counts
```

## 23. Prisma Migration Rules

Persistent schema changes require committed migrations.

Workflow:

```text
edit Prisma schema
→ create migration
→ inspect SQL
→ add reviewed PostgreSQL SQL if needed
→ test clean DB
→ commit schema + migration
```

Do not use `prisma db push` as shared/main schema history.

Do not rewrite merged migrations; add corrective migrations.

Native enums and partial/functional unique indexes must be represented by reviewed migrations.

## 24. Required Database Tests

At minimum verify:

1. Email/Username case-insensitive uniqueness;
2. Membership uniqueness;
3. one Owner maximum + Trip creation creates exactly one Owner;
4. Pending Invitation uniqueness and re-invite after Reject;
5. all Days generated;
6. Activity requires same-Trip Day;
7. Activity time check;
8. unique Proposal origin Activity;
9. stale Activity update does not overwrite;
10. one current Vote per User/Proposal;
11. Leave physically deletes that Member's Votes;
12. strict-majority calculation;
13. REJECT Vote updates vote data but leaves Proposal `PENDING`;
14. Invitation Accept / Leave may change current majority without changing Proposal status;
15. Adoption rechecks current state and majority inside transaction;
16. lost majority creates no Activity and leaves Proposal `PENDING`;
17. concurrent Adoption creates at most one Activity;
18. deleting Proposal-sourced Activity performs `ACCEPTED→PENDING`;
19. Trip cascade removes Workspace.

## 25. Explicit Database Non-Goals

No P0 persistence solely for:

```text
Trip Edit
Unscheduled pool
Activity locks/participants
Proposal Edit/Delete
automatic Proposal rejection
Proposal REJECTED status/lifecycle
Rejected archive
Revise & Fork
Owner Transfer
Chat
Notifications
Files
Budget
Maps
PWA/offline
full audit history
```
