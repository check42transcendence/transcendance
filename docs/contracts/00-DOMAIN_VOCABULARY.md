# P0 Domain Vocabulary

Status: Draft  
Scope: P0  
Owner: Tech Lead  
Depends on: Frozen P0 Scope and Frozen P0 Business Rules v2 (2026-10-09)

## Purpose

This document defines the canonical vocabulary used across P0 product documents, technical contracts, API design, database design, realtime events, and implementation.

The purpose is to make sure the team uses the same word for the same concept.

This document defines meanings only.

It does not define final database columns, API endpoints, DTO fields, or implementation details.

---

## 1. User

A registered account in the system.

A User has a unique Email and Username and authenticates using Email and Password.

A User does not automatically have access to any Trip.

### Terminology rule

Use `User`.

Do not use `Account`, `Person`, `Traveler`, or `Participant` as alternative technical names for the same concept.

---

## 2. Trip

A shared travel-planning workspace for one group traveling together.

A Trip contains fixed P0 travel information, current Memberships, Itinerary Days, Activities, Proposals, and Votes.

In P0, Trip base information is fixed after creation.

A Trip has exactly one current Owner.

---

## 3. Trip Creator

The User who originally creates a Trip.

Creation is a historical fact.

When a Trip is created, the Creator receives the `OWNER` Membership Role.

P0 does not support ownership transfer, so the Creator and current Owner remain the same User in normal P0 data. However, authorization must use the current Membership Role, not the historical Creator relationship.

### Terminology rule

Use `Creator` only when referring to who originally created the Trip.

Do not use `Creator` as a synonym for `Owner` in authorization logic.

---

## 4. TripMembership

The current relationship between a User and a Trip.

Every current Trip participant has one TripMembership for that Trip.

A TripMembership has one P0 Membership Role:

```text
OWNER
MEMBER
```

A Pending Invitation is not a TripMembership.

A former Member who has left no longer has a current TripMembership.

### Terminology rule

Use `TripMembership` for the technical/domain relationship.

A database table may use a naming convention such as `trip_member`, but it represents this same concept.

---

## 5. Membership Role

The current authorization role stored on a TripMembership.

P0 has exactly two Membership Roles:

```text
OWNER
MEMBER
```

P0 does not have Editor, Viewer, Admin, or other complex Trip roles.

---

## 6. Owner

The current Trip participant whose TripMembership has role `OWNER`.

In P0:

- each Trip has exactly one current Owner;
- only the Owner may invite Users;
- only the Owner may delete the Trip;
- the Owner cannot Leave Trip;
- ownership cannot be transferred;
- the Owner cannot edit Trip base information because P0 has no Edit Trip feature.

Owner authority is determined by the current Membership Role, not by `created_by` or another Creator field.

---

## 7. Member

A current Trip participant whose TripMembership has role `MEMBER`.

A User normally becomes a Member after accepting an Invitation.

A Member can access the Trip Workspace and participate in collaborative P0 features according to the Business Rules.

A User with only a Pending Invitation is not yet a Member.

---

## 8. Current Trip Participant

A User who currently has a TripMembership for a Trip with role:

```text
OWNER
or
MEMBER
```

This term is used when a rule applies to both Owner and Member.

For Proposal majority calculations, all Current Trip Participants count in the denominator, including the Owner and participants who have not voted.

---

## 9. Invitation

A request sent by the current Trip Owner asking an already registered User to join the Trip.

An Invitation does not itself grant access to the Trip Workspace.

The invited User must Accept before receiving a `MEMBER` TripMembership.

---

## 10. Pending Invitation

An Invitation with status `PENDING`.

A Pending Invitation may expose the limited Trip summary defined by the Business Rules, but it does not create Membership or Trip Workspace access.

For one Trip + Invitee, P0 allows at most one effective Pending Invitation at a time.

---

## 11. Accept

The action by which the invited User accepts a Pending Invitation.

After Accept:

- the Invitation becomes `ACCEPTED`;
- the User receives a `MEMBER` TripMembership;
- the Trip appears in My Trips;
- the User gains Trip Workspace access.

`Accept` is an action, not a standalone domain entity.

---

## 12. Reject

The action by which the invited User rejects a Pending Invitation.

After Reject:

- the Invitation becomes `REJECTED`;
- no TripMembership is created;
- the Trip does not enter My Trips;
- the User does not gain Trip Workspace access.

The UI may use the word `Decline`, but the canonical technical Invitation status is `REJECTED`.

`Reject` is an action, not a standalone domain entity.

---

## 13. My Trips

The authenticated User's collection of Trips for which the User currently has a TripMembership.

This includes both:

- Trips where the User's role is `OWNER`;
- Trips where the User's role is `MEMBER`.

My Trips is a product query/view, not a standalone domain entity.

Pending Invitations are shown separately until accepted.

---

## 14. Trip Workspace

The private collaborative area belonging to one Trip.

The Trip Workspace contains P0 content available only to Current Trip Participants, including:

- Trip details;
- full Member List;
- Itinerary;
- Activities;
- Proposals;
- Votes;
- Proposal adoption state.

A Pending Invitation does not grant access to the Trip Workspace.

---

## 15. Itinerary

The complete travel plan of a Trip, organized by its fixed Itinerary Days.

`Itinerary` is a product/domain concept, not a separate P0 entity by itself.

---

## 16. ItineraryDay

One calendar date inside the Trip's fixed Start Date–End Date range.

All Itinerary Days are generated when the Trip is created.

In P0:

- Users cannot manually create or delete a Day;
- Trip dates do not change after creation;
- Days are not shifted, extended, shortened, or renumbered;
- deleting the Trip deletes its Days.

Use `ItineraryDay` in technical naming when a single-word identifier is needed.

---

## 17. Activity

One scheduled item inside a valid Itinerary Day.

An Activity may be:

- created directly by a Current Trip Participant; or
- created through manual Proposal Adoption.

An Activity contains the P0 information defined by the Business Rules, including its Creator and recent-edit information.

All Current Trip Participants may create, read, update, and delete Activities.

P0 has no Unscheduled Activity state and no Activity Locking state.

---

## 18. Activity Creator

The User who originally creates an Activity.

Creator is historical information.

Being the Activity Creator does not grant exclusive update or delete permission.

---

## 19. Activity Last Editor

The User who most recently saves an Activity update.

The system records the last editor and last-edited time after a successful update.

This is not a full audit history.

---

## 20. Proposal

A suggestion created by a Current Trip Participant when the group wants to collect opinions about an undecided travel choice.

A Proposal is optional.

A Current Trip Participant may always create an Activity directly without first creating a Proposal.

A Proposal can be manually Adopted only after the current AGREE votes satisfy the P0 strict-majority rule.

P0 does not automatically convert a Proposal into an Activity.

---

## 21. Proposal Creator

The User who originally creates a Proposal.

The Proposal Creator may vote on their own Proposal while it is not Adopted.

Creator status does not create a separate permission role.

---

## 22. Vote

One Current Trip Participant's current choice on one Proposal.

The canonical P0 Vote values are:

```text
AGREE
REJECT
```

A User has at most one current Vote per Proposal.

Changing a Vote updates the existing current choice instead of adding a second current Vote.

No Vote record means the User has not voted.

P0 has no Abstain choice.

While a Proposal is Adopted, new Votes and Vote changes are closed.

---

## 23. Strict Majority

The rule that determines whether a Proposal is currently eligible for Adoption.

A Proposal is eligible only when:

```text
AGREE votes > Current Trip Participant count / 2
```

Equivalent minimum:

```text
floor(currentParticipantCount / 2) + 1
```

The denominator includes:

- the Owner;
- all current `MEMBER` participants;
- participants who have not voted.

A participant who has left is not counted, and their Vote does not count.

---

## 24. Adoption

The manual action that converts an eligible Proposal into a linked scheduled Activity.

Adoption rules in P0:

- the Proposal must currently satisfy Strict Majority;
- any Current Trip Participant may Adopt;
- Adoption is manual, never automatic;
- Adoption creates one linked Activity after the user provides required scheduling information;
- one Proposal may have at most one current linked Activity;
- concurrent Adoption attempts must not create duplicate linked Activities;
- while the linked Activity exists, the Proposal is considered Adopted and voting is closed.

`Adoption` is an action/state transition, not a standalone entity.

---

## 25. Linked Activity

The Activity created from one Proposal through Adoption.

A Proposal may have zero or one current Linked Activity.

A Linked Activity belongs to exactly one source Proposal.

If the Linked Activity is deleted:

- the Proposal becomes unadopted / adoptable again;
- existing Proposal and Vote data remain;
- the current majority requirement is checked again before another Adoption;
- while the Proposal is unadopted, normal pre-Adoption voting rules apply again.

A directly created Activity has no source Proposal.

---

## 26. Leave Trip

The action by which a `MEMBER` ends their own current TripMembership.

The `OWNER` cannot Leave Trip.

Leaving:

- removes future Trip Workspace access;
- removes the Trip from My Trips;
- does not erase historical Activity or Proposal contributions;
- causes the leaving User's Vote to stop counting.

---

## 27. Realtime Update

A change pushed to other currently connected Trip participants without requiring manual refresh.

P0 realtime collaboration covers the changes defined by the Business Rules, including:

- Activity changes and recent-editor data;
- Proposal creation;
- Vote changes;
- Proposal Adoption / unadopted state changes.

Realtime delivery is not the authoritative stored state.

---

# Naming Rules

Preferred P0 technical names include:

- `User`
- `Trip`
- `TripMembership`
- `MembershipRole`
- `Owner`
- `Member`
- `Invitation`
- `ItineraryDay`
- `Activity`
- `Proposal`
- `Vote`
- `Adoption`
- `LinkedActivity`

Canonical enum/value language:

```text
MembershipRole: OWNER | MEMBER
InvitationStatus: PENDING | ACCEPTED | REJECTED
VoteDecision: AGREE | REJECT
```

Avoid alternative technical synonyms unless a later Shared Types Contract explicitly maps them.

---

# Explicit P0 Vocabulary Boundary

The following concepts are outside the frozen P0 vocabulary:

- Message / Chat
- Notification Center
- Friend
- Expense
- File / Trip Document
- ActivityParticipant
- Activity Lock / Confirmed state
- Unscheduled Activity Pool
- Proposal Passed / Rejected result status
- Proposal Deadline
- Proposal Option List
- OwnershipTransfer
- Editor / Viewer roles
- Archive / Restore / Trash
- full Activity Audit History

Future phases may extend the vocabulary only through an explicit scope change.

---

# Review Checklist

Before freezing this document, the team should confirm:

- [ ] `Creator` and `Owner` are different concepts.
- [ ] Owner authority comes from `TripMembership.role = OWNER`.
- [ ] Every current Trip participant has a TripMembership.
- [ ] P0 Membership Roles are only `OWNER` and `MEMBER`.
- [ ] Pending Invitation is not Membership.
- [ ] Invitation statuses use `PENDING / ACCEPTED / REJECTED`.
- [ ] Itinerary Days are fixed after Trip creation.
- [ ] Activity has no unscheduled or locked P0 state.
- [ ] Vote values are `AGREE / REJECT`; no Vote means not voted.
- [ ] Strict Majority uses all Current Trip Participants as the denominator.
- [ ] Proposal Adoption is manual and creates at most one current Linked Activity.
- [ ] Deleting the Linked Activity makes the Proposal adoptable again.
- [ ] No P1/P2 concept has accidentally entered P0.
