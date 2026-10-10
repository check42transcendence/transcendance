# P0 Domain Model

Status: Draft  
Scope: P0  
Owner: Tech Lead  
Depends on: Frozen P0 Scope, Frozen P0 Business Rules v2, `00-DOMAIN_VOCABULARY.md`, `01-ARCHITECTURE.md`

## 1. Core Domain Objects

- `User`
- `Trip`
- `TripMembership`
- `Invitation`
- `ItineraryDay`
- `Activity`
- `Proposal`
- `Vote`

`Owner` and `Member` are Membership Roles, not standalone entities.

---

# 2. Trip

P0 Trip data includes:

- Title;
- Destination;
- Start Date;
- End Date;
- optional Description;
- historical Creator.

The Creator receives `TripMembership(role = OWNER)` at creation.

Creator and Owner are different concepts:

```text
Creator = historical creation fact
Owner = current Membership Role
```

Authorization uses only current Membership Role.

P0 has no Edit Trip and no Owner Transfer.

---

# 3. TripMembership

Every current Trip participant has one current TripMembership.

Roles:

```text
OWNER
MEMBER
```

Invariants:

- one Trip + User has at most one current Membership;
- each Trip has exactly one `OWNER`;
- Accept Invitation creates `MEMBER`;
- `MEMBER` may Leave;
- `OWNER` may not Leave;
- Leave removes access but preserves historical Activity/Proposal contributions.

---

# 4. Invitation

Canonical statuses:

```text
PENDING
ACCEPTED
REJECTED
```

Invariants:

- only Owner invites;
- Invitee must already be registered;
- Pending does not grant Workspace access;
- at most one effective Pending per Trip + Invitee;
- Accept creates MEMBER Membership;
- Reject creates none;
- Reject may later be followed by a new Invitation.

---

# 5. ItineraryDay

All ItineraryDays are created when the Trip is created.

Trip dates are immutable in P0.

There is one Day per date in the inclusive Start–End range.

P0 has no date shifting, Day editing, or Unscheduled Activity Pool.

---

# 6. Activity

An Activity belongs to exactly one Trip and one valid ItineraryDay of that Trip.

Fields/concepts include:

- Title;
- Day / Date;
- Start Time;
- optional End Time;
- optional Location;
- optional Description;
- Creator;
- Last Editor;
- Last Edited At;
- optional Created At.

Rules:

- Title/Day/Start Time required;
- End Time >= Start Time when present;
- overlap allowed;
- all current participants may CRUD;
- no Activity Locking;
- stale updates must not silently overwrite newer data.

An Activity may optionally record that it was created from one Proposal.

The exact field is defined in the Database Contract.

---

# 7. Proposal

A Proposal is an optional group-decision object.

P0 Proposal data includes:

- Title;
- optional Description;
- Creator;
- Created At;
- `is_adopted`.

Meaning:

```text
is_adopted = false
→ Proposal has not currently been accepted/adopted

is_adopted = true
→ Proposal has been manually accepted/adopted
```

`is_adopted` is only the adoption marker.

It is not itself the Proposal-to-Activity relation.

P0 has no automatic Passed/Rejected status, no Deadline, and no Proposal Edit/Delete.

---

# 8. Vote

A Vote belongs to one Proposal and one voting User.

Decision:

```text
AGREE
REJECT
```

No Vote row means not voted.

Rules:

- only current participants may vote;
- one current Vote per Proposal + User;
- changing Vote updates the existing row;
- no Abstain;
- after `is_adopted = true`, Vote creation/change is closed;
- when a Member leaves, their Vote no longer counts.

---

# 9. Strict Majority

Let:

```text
N = current OWNER + MEMBER count
A = current AGREE Vote count
```

Adoption eligibility:

```text
A > N / 2
```

Equivalent:

```text
A >= floor(N / 2) + 1
```

Owner and non-voters count in `N`.

Former participants do not.

---

# 10. Adoption

Any current Trip participant may request Adoption.

A successful Adoption must:

1. verify current Membership;
2. verify Proposal belongs to the Trip;
3. verify `is_adopted == false`;
4. recompute current strict majority;
5. validate required Activity scheduling data;
6. create exactly one Activity from the Proposal;
7. mark `Proposal.is_adopted = true`;
8. commit atomically;
9. broadcast only after commit.

The Proposal-to-Activity relation is a separate persistence concern from `is_adopted`.

The Database Contract will define the exact FK/unique design.

Concurrent Adoption attempts must not create duplicate Activities from the same Proposal.

---

# 11. Delete Adopted Activity / Re-Adopt

If the Activity created through Adoption is deleted:

- Proposal remains;
- existing Votes remain;
- `Proposal.is_adopted` becomes `false`;
- voting rules become available again;
- future Adoption must recompute and satisfy current strict majority;
- a new Activity may then be created.

The delete + `is_adopted` reset must be consistent/atomic.

---

# 12. Access Model

Workspace access:

```text
current TripMembership exists
```

Owner-only check:

```text
TripMembership.role == OWNER
```

Historical `created_by` is never an authorization source.

---

# 13. Important Lifecycles

## Create Trip

```text
Create Trip
→ create Creator Membership(role=OWNER)
→ generate all ItineraryDays
→ commit
```

## Accept

```text
PENDING Invitation
→ ACCEPTED
→ create Membership(role=MEMBER)
```

## Reject

```text
PENDING Invitation
→ REJECTED
→ no Membership
```

## Leave

```text
MEMBER Membership
→ remove Membership
→ access removed
→ historical Activity/Proposal retained
→ Vote no longer counts
```

## Adopt

```text
Proposal.is_adopted = false
→ strict majority satisfied
→ create Proposal-sourced Activity
→ Proposal.is_adopted = true
```

## Delete adopted Activity

```text
delete Proposal-sourced Activity
→ Proposal.is_adopted = false
→ Votes remain
→ future Adoption must pass current majority again
```

## Delete Trip

Delete the complete Workspace: Memberships, Invitations, Days, Activities, Proposals, Votes.

---

# 14. Deferred Database Decisions

Database Contract decides:

- exact PK/FK types;
- how exactly one OWNER is enforced;
- Pending Invite uniqueness mechanism;
- exact Activity field used to record Proposal origin;
- exact one-Proposal-to-one-current-adopted-Activity constraint;
- exact CASCADE rules;
- Activity OCC version field;
- Vote cleanup on Leave.
