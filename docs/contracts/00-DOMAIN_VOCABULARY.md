# P0 Domain Vocabulary

Status: Draft  
Scope: P0  
Owner: Tech Lead  
Depends on: Frozen P0 Scope and P0 Business Rules

## Purpose

This document defines the canonical vocabulary used across P0 product documents, technical contracts, API design, database design, realtime events, and implementation.

The purpose is to make sure the team uses the same word for the same concept.

This document defines meanings only.

It does not define database tables, API endpoints, DTO fields, or implementation details.

---

## 1. User

A registered account in the system.

A User has a unique Email and Username and can authenticate using Email and Password.

A User does not automatically have access to any Trip.

### Terminology rule

Use `User`.

Do not use `Account`, `Person`, `Traveler`, or `Participant` as alternative technical names for the same concept.

---

## 2. Trip

A shared travel-planning workspace for one group traveling together.

A Trip contains its basic travel information and the collaborative content created by its Owner and Members.

A Trip has exactly one Owner in P0.

### Terminology rule

Use `Trip`.

Do not use `Journey`, `Travel`, `Project`, or `Room` as alternative technical names.

---

## 3. Owner

The User who creates a Trip and owns that Trip.

In P0:

- each Trip has exactly one Owner;
- the Owner cannot leave the Trip;
- ownership cannot be transferred;
- some Trip-level operations are Owner-only.

`Owner` is a role inside the context of one Trip.

A User may be the Owner of one Trip and a Member of another Trip.

---

## 4. Member

A registered User who has formally joined a Trip after accepting an Invitation.

A Member can access the Trip Workspace and participate in P0 collaborative features according to the Business Rules.

A User with only a Pending Invitation is not yet a Member.

In P0 product language, `Owner` and `Member` are kept distinct when their permissions differ.

### Terminology rule

Use `Member`.

Do not use `Participant`, `Traveler`, `Collaborator`, or `Guest` as alternative technical names.

---

## 5. Invitation

A request sent by a Trip Owner asking an already registered User to join that Trip.

An Invitation does not itself grant access to the Trip Workspace.

The invited User must Accept the Invitation before becoming a Member.

### Terminology rule

Use `Invitation` as the domain noun.

`Invite` may be used as the action verb.

---

## 6. Pending Invitation

An Invitation that has been sent but has not yet been accepted or declined.

A Pending Invitation may expose enough Trip summary information for the invited User to make a decision, but it does not create Membership or Trip access.

---

## 7. Accept

The action by which an invited User accepts a Pending Invitation.

After Accept:

- the User becomes a Member of the Trip;
- the Trip appears in My Trips;
- the User gains access to the Trip Workspace.

`Accept` is an action, not a separate domain entity.

---

## 8. Decline

The action by which an invited User rejects a Pending Invitation.

After Decline:

- the User does not become a Member;
- the Trip does not appear in My Trips;
- the User does not gain access to the Trip Workspace.

`Decline` is an action, not a separate domain entity.

---

## 9. My Trips

The authenticated User's collection of Trips that the User currently owns or has joined as a Member.

My Trips is a product concept / view.

It is not a separate domain entity.

---

## 10. Trip Workspace

The private collaborative area belonging to one Trip.

The Trip Workspace contains the P0 content accessible only to the current Owner and Members, including:

- Trip details;
- Member list;
- Itinerary;
- Activities;
- Proposals;
- Votes.

A Pending Invitation does not grant access to the Trip Workspace.

`Trip Workspace` describes the collaborative product area. It does not imply a separate database entity.

---

## 11. Itinerary

The complete travel plan of a Trip, organized by date.

In P0, the Itinerary is composed of automatically generated Itinerary Days and the Activities belonging to those days.

`Itinerary` is a domain/product concept and does not necessarily require its own database entity.

---

## 12. Itinerary Day

One calendar date inside a Trip's Start Date and End Date range.

Itinerary Days are generated automatically from the Trip date range in P0.

Users do not manually create or delete Itinerary Days.

An Itinerary Day groups the Activities planned for that date.

### Terminology rule

Use `ItineraryDay` in technical naming when a single word identifier is needed.

`Day` may be used as a shorter user-facing label when the meaning is clear.

Do not use `ScheduleDay` or `TripDay` as alternative technical names.

---

## 13. Activity

One planned item inside an Itinerary Day.

Examples include visiting a museum, eating at a restaurant, or taking a train.

An Activity belongs to one Trip date and contains the information required by the P0 Business Rules.

All current Trip Members may create, read, update, and delete Activities.

### Terminology rule

Use `Activity`.

Do not use `Event`, `Plan`, `ScheduleItem`, or `Task` as alternative technical names.

---

## 14. Activity Creator

The User who originally creates an Activity.

The system records the Creator for identity and history purposes.

In P0, being the Activity Creator does not give special exclusive update or delete permission because all current Trip Members may edit the shared Itinerary.

`Creator` is an attribute / relationship of an Activity, not a separate role.

---

## 15. Proposal

A suggestion created by a current Trip Member when the group wants to collect opinions about a travel decision.

A Proposal is an optional decision-making tool.

It is not a required approval step before creating an Activity.

In P0, a Proposal does not automatically become Passed or Rejected and is not automatically converted into an Activity.

### Terminology rule

Use `Proposal`.

Do not use `Poll`, `Decision`, `Suggestion`, or `Request` as alternative technical names for the same domain concept.

---

## 16. Proposal Creator

The User who originally creates a Proposal.

The Proposal Creator remains a normal voting-eligible Trip Member and may vote on their own Proposal.

`Proposal Creator` does not define a separate permission role in P0.

---

## 17. Vote

The current Yes / No choice of one eligible Trip Member on one Proposal.

A Member may have at most one current Vote for a Proposal.

Changing a Vote replaces the previous choice rather than creating an additional Vote.

In P0:

- Vote values are `YES` or `NO`;
- there is no automatic Passed / Rejected result;
- there is no Abstain value;
- Proposal Close / Deadline is not part of P0.

### Terminology rule

Use `Vote`.

Use `YES` and `NO` as the canonical technical values unless a later Shared Types Contract explicitly defines another representation.

---

## 18. Current Member

A User who currently has valid membership in a Trip.

A User who has left the Trip is no longer a Current Member.

A User with only a Pending Invitation is not a Current Member.

When a Business Rule says that an operation is available to "current Trip Members", it refers to users who currently hold valid access to that Trip, including the Owner where applicable.

---

## 19. Leave Trip

The action by which a normal Member ends their current Membership in a Trip.

In P0, the Owner cannot Leave Trip.

Leaving a Trip removes future access but does not erase the Member's historical Activity or Proposal contributions.

`Leave Trip` is an action, not a domain entity.

---

## 20. Realtime Update

A change that is pushed to other currently connected Trip Members without requiring them to manually refresh the page.

In P0, realtime collaboration applies to the objects explicitly listed in the P0 Scope and Business Rules.

A Realtime Update is a delivery mechanism, not the authoritative stored state.

The technical implementation is defined later in the Realtime Contract.

---

# Naming Rules

For P0 technical documents and implementation, use the canonical domain names defined above.

Preferred technical names include:

- `User`
- `Trip`
- `Owner`
- `Member`
- `Invitation`
- `ItineraryDay`
- `Activity`
- `Proposal`
- `Vote`

Avoid introducing synonyms for the same domain concept unless a later contract explicitly defines a different technical layer.

Examples:

- use `Member`, not `Participant`;
- use `Activity`, not `Event`;
- use `Proposal`, not `Poll`;
- use `Invitation`, not `Request`;
- use `ItineraryDay`, not `TripDay`.

---

# Explicit P0 Vocabulary Boundary

The following concepts are not part of the P0 domain vocabulary because they are outside the frozen P0 scope:

- Message / Chat
- Notification
- Friend
- Expense
- File / Trip Document
- ActivityParticipant
- ProposalStatus such as Passed / Rejected
- OwnershipTransfer

They may be added to the vocabulary later if they enter a future product phase.

---

# Review Checklist

Before freezing this document, the team should confirm:

- [ ] Every P0 core concept has one clear canonical name.
- [ ] No two terms describe the same concept unnecessarily.
- [ ] `Owner` and `Member` are understood consistently.
- [ ] `Pending Invitation` is clearly different from Membership.
- [ ] `ItineraryDay` and `Activity` are clearly different concepts.
- [ ] `Proposal` is clearly separated from `Activity`.
- [ ] `Vote` means one Member's current Yes / No choice.
- [ ] No P1 / P2 concept has accidentally entered the P0 vocabulary.
