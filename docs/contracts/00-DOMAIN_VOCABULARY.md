# P0 Domain Vocabulary

Status: Draft  
Scope: P0  
Owner: Tech Lead  
Depends on: Frozen P0 Scope and Frozen P0 Business Rules v2 (2026-10-09)

## Purpose

This document defines the canonical vocabulary used across P0 product documents, technical contracts, API design, database design, realtime events, and implementation.

---

## 1. User

A registered account with unique Email and Username.

---

## 2. Trip

A shared travel-planning workspace.

In P0, Trip base information is fixed after creation.

---

## 3. Trip Creator

The User who originally creates a Trip.

Creation is a historical fact.

When the Trip is created, the Creator receives the `OWNER` Membership Role.

Authorization must use current Membership Role, not historical Creator identity.

---

## 4. TripMembership

The current User-to-Trip relationship.

Every current Trip participant has one TripMembership with role:

```text
OWNER
MEMBER
```

A Pending Invitation is not Membership.

---

## 5. Owner

The current participant whose TripMembership role is `OWNER`.

P0 has exactly one Owner per Trip.

Only Owner may invite Users or delete the Trip.

Owner cannot Leave Trip.

P0 has no Owner Transfer.

---

## 6. Member

A current participant whose TripMembership role is `MEMBER`.

A User normally becomes a Member by accepting an Invitation.

---

## 7. Current Trip Participant

A User with a current TripMembership whose role is `OWNER` or `MEMBER`.

For Proposal majority calculations, all Current Trip Participants count in the denominator, including the Owner and users who have not voted.

---

## 8. Invitation

A request from the Owner to an already registered User.

Canonical technical states:

```text
PENDING
ACCEPTED
REJECTED
```

The UI may display `Decline`, but the technical rejected state is `REJECTED`.

---

## 9. My Trips

Trips where the authenticated User currently has a TripMembership.

Pending Invitations are shown separately.

---

## 10. ItineraryDay

One fixed calendar date inside the Trip Start Date–End Date range.

All Days are generated when the Trip is created.

P0 does not edit Trip dates, manually add/remove Days, or use an Unscheduled Activity Pool.

---

## 11. Activity

One scheduled item belonging to one valid ItineraryDay of its Trip.

An Activity may be created directly or created as the result of Proposal Adoption.

P0 Activity data includes Creator and recent-editor information.

P0 has no Activity Locking or Unscheduled state.

---

## 12. Activity Creator

The User who originally creates an Activity.

Creator status does not grant exclusive edit/delete permission.

---

## 13. Activity Last Editor

The User who most recently saves an Activity update.

The system also records the last-edited time.

This is not a full audit log.

---

## 14. Proposal

An optional suggestion used to collect opinions before a group decision.

A Proposal is not required before creating an Activity.

A Proposal contains an adoption marker:

```text
is_adopted
```

This marker means whether the Proposal has been manually accepted/adopted.

It is not itself an Activity relationship field.

---

## 15. Vote

One current decision by one Current Trip Participant on one Proposal.

Canonical values:

```text
AGREE
REJECT
```

No Vote record means the User has not voted.

A User has at most one current Vote per Proposal.

Adopted Proposals do not accept new Vote changes.

---

## 16. Strict Majority

A Proposal is eligible for Adoption only when:

```text
AGREE votes > Current Trip Participant count / 2
```

Equivalent minimum:

```text
floor(currentParticipantCount / 2) + 1
```

The denominator includes the Owner and non-voters.

---

## 17. Adoption

The manual action that accepts an eligible Proposal and creates one Activity from it.

Any Current Trip Participant may Adopt when the current strict-majority rule is satisfied.

A successful Adoption sets:

```text
Proposal.is_adopted = true
```

and creates one Proposal-sourced Activity.

P0 allows at most one current Activity created from the same Proposal.

Concurrent Adoption attempts must not create duplicates.

If that adopted Activity is deleted, the Proposal returns to:

```text
is_adopted = false
```

and can be Adopted again only after the current majority requirement is satisfied again.

---

## 18. Realtime Update

A committed Activity, Proposal, Vote, or Adoption change pushed to other connected Trip participants.

Realtime delivery is not the authoritative stored state.

---

# Canonical technical values

```text
MembershipRole: OWNER | MEMBER
InvitationStatus: PENDING | ACCEPTED | REJECTED
VoteDecision: AGREE | REJECT
Proposal.is_adopted: boolean
```

# Explicit P0 exclusions

P0 excludes Chat, Notification Center, Friends, Budget, Files, Maps, Activity Locking, Unscheduled Activities, Proposal Deadline/Edit/Delete, Ownership Transfer, Editor/Viewer roles, Archive/Restore, and full Activity audit history.
