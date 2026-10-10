# P0 REST API Contract

Status: Draft  
Scope: P0  
Owner: Tech Lead  
Product baseline: Frozen P0 Scope / PRD / Business Rules v2 — 2026-10-09  
Depends on: `00-DOMAIN_VOCABULARY.md`, `01-ARCHITECTURE.md`, `02-DOMAIN_MODEL.md`, `03-AUTH_CONTRACT.md`, `04-DATABASE_CONTRACT.md`

## Purpose

This document defines the shared P0 REST API contract between the React frontend and NestJS backend.

It defines canonical endpoint paths, HTTP methods, request/response conventions, authentication and authorization behaviour, common error format, status-code rules, P0 resource DTO boundaries, Activity optimistic-concurrency behaviour, and Proposal Vote / Adoption conflict behaviour.

A feature implementation must not invent a different path, payload shape, error code, or authorization rule for the same P0 operation without updating this contract first.

---

# 1. Global API Prefix

All P0 REST endpoints use:

```text
/api
```

Examples:

```text
/api/auth/login
/api/trips
/api/trips/:tripId/activities
```

---

# 2. Transport and Content Type

P0 REST uses JSON unless the endpoint intentionally has no body.

```http
Content-Type: application/json
```

Authentication is carried by the backend-controlled HttpOnly cookie defined in `03-AUTH_CONTRACT.md`.

The frontend must not send JWT values manually.

---

# 3. Identifier Format

All resource IDs are UUID strings.

Invalid UUID syntax must be rejected before resource lookup.

---

# 4. Date and Time Format

Trip and ItineraryDay dates use:

```text
YYYY-MM-DD
```

P0 Activity times use 24-hour local-clock strings:

```text
HH:mm
```

P0 does not support cross-day Activities.

If `endTime` exists:

```text
endTime >= startTime
```

---

# 5. JSON Naming Convention

Public JSON uses `camelCase`.

Examples:

```text
tripId
startDate
createdAt
updatedBy
isAdopted
expectedVersion
```

Database snake_case names must not leak into public REST payloads.

---

# 6. Success Response Convention

Successful resource responses return the resource/object directly or inside a resource-specific key.

Examples:

```json
{
  "trip": {
    "id": "uuid",
    "title": "Barcelona Trip"
  }
}
```

Collections use a named collection:

```json
{
  "trips": []
}
```

P0 does not require a generic `{ "data": ... }` wrapper.

---

# 7. Common Error Format

All application errors use:

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

`code` is the stable frontend-facing identifier.

`message` may be shown directly or mapped to i18n translation keys.

`details` is optional.

Raw Prisma/PostgreSQL errors must never be exposed directly.

---

# 8. HTTP Status-Code Rules

| Status | Meaning |
|---|---|
| `200 OK` | Successful read/update/action with body |
| `201 Created` | Resource successfully created |
| `204 No Content` | Successful action with no body |
| `400 Bad Request` | Malformed JSON, invalid UUID, unsupported request shape |
| `401 Unauthorized` | Missing/invalid authentication |
| `403 Forbidden` | Authenticated User lacks permission |
| `404 Not Found` | Resource does not exist in expected parent context |
| `409 Conflict` | Request conflicts with current persisted state |
| `422 Unprocessable Entity` | Request shape is valid but field/business validation fails |

Do not use `401` for authorization failures.

Do not use `403` for normal business conflicts.

---

# 9. Validation Error Format

Field/business validation failures use:

```http
422 Unprocessable Entity
```

Example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": {
      "fields": {
        "endTime": "End time must not be earlier than start time."
      }
    }
  }
}
```

Examples:

- missing required Title;
- invalid Email format;
- End Date earlier than Start Date;
- Activity End Time earlier than Start Time;
- Activity Day outside the Trip.

---

# 10. Authentication Endpoints

## 10.1 Register

```http
POST /api/auth/register
```

Request:

```json
{
  "email": "alice@example.com",
  "username": "alice",
  "password": "example-password"
}
```

Success:

```http
201 Created
```

Response:

```json
{
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "username": "alice",
    "createdAt": "2026-10-10T18:00:00Z"
  }
}
```

Conflicts:

```text
409 EMAIL_ALREADY_EXISTS
409 USERNAME_ALREADY_EXISTS
```

P0 baseline: successful Register also establishes the authenticated session.

---

## 10.2 Login

```http
POST /api/auth/login
```

Request:

```json
{
  "email": "alice@example.com",
  "password": "example-password"
}
```

Success:

```http
200 OK
```

Response:

```json
{
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "username": "alice"
  }
}
```

Invalid Email or Password:

```http
401 Unauthorized
```

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password."
  }
}
```

The response must not reveal whether the Email exists.

---

## 10.3 Logout

```http
POST /api/auth/logout
```

Success:

```http
204 No Content
```

The backend clears the auth cookie.

---

## 10.4 Current User

```http
GET /api/auth/me
```

Protected.

Success:

```json
{
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "username": "alice"
  }
}
```

---

# 11. Trip Endpoints

## 11.1 My Trips

```http
GET /api/trips
```

Protected.

Returns Trips for which the authenticated User has a current TripMembership with role `OWNER` or `MEMBER`.

Pending Invitations are not included.

Example:

```json
{
  "trips": [
    {
      "id": "uuid",
      "title": "Barcelona Trip",
      "destination": "Barcelona",
      "startDate": "2026-10-12",
      "endDate": "2026-10-15",
      "description": null,
      "currentUserRole": "OWNER"
    }
  ]
}
```

---

## 11.2 Create Trip

```http
POST /api/trips
```

Protected.

Request:

```json
{
  "title": "Barcelona Trip",
  "destination": "Barcelona",
  "startDate": "2026-10-12",
  "endDate": "2026-10-15",
  "description": "Autumn trip"
}
```

Success:

```http
201 Created
```

The backend transaction creates:

```text
Trip
+
Creator OWNER Membership
+
all fixed ItineraryDays
```

P0 has no Trip update endpoint.

These do not exist:

```text
PATCH /api/trips/:tripId
PUT /api/trips/:tripId
```

---

## 11.3 Get Trip

```http
GET /api/trips/:tripId
```

Protected to current Trip participants.

Response includes fixed Trip details and current User role.

---

## 11.4 Delete Trip

```http
DELETE /api/trips/:tripId
```

Owner-only.

Success:

```http
204 No Content
```

Normal Member:

```text
403 TRIP_OWNER_REQUIRED
```

---

# 12. Member Endpoints

## 12.1 Member List

```http
GET /api/trips/:tripId/members
```

Protected.

Example:

```json
{
  "members": [
    {
      "user": {
        "id": "uuid",
        "username": "alice"
      },
      "role": "OWNER",
      "joinedAt": "2026-10-10T18:00:00Z"
    }
  ]
}
```

Other Users' Emails are not included by default.

---

## 12.2 Leave Trip

```http
POST /api/trips/:tripId/leave
```

Only current `MEMBER`.

Success:

```http
204 No Content
```

The Leave transaction removes:

```text
current Membership
+
that User's active Votes in the Trip
```

Historical Activities and Proposals remain.

Owner attempt:

```text
409 OWNER_CANNOT_LEAVE
```

---

# 13. Invitation Endpoints

## 13.1 Pending Invitations

```http
GET /api/invitations?status=PENDING
```

Protected.

Returns only Invitations for the authenticated User.

Pending Invitation summary may include Trip Title, Destination, Dates, and Inviter Username.

It does not grant Workspace access.

---

## 13.2 Create Invitation

```http
POST /api/trips/:tripId/invitations
```

Owner-only.

Request accepts exactly one exact lookup identifier:

```json
{
  "username": "bob"
}
```

or:

```json
{
  "email": "bob@example.com"
}
```

Do not accept both simultaneously.

Success:

```http
201 Created
```

Conflicts:

```text
409 INVITATION_ALREADY_PENDING
409 MEMBERSHIP_ALREADY_EXISTS
```

Unknown User:

```text
404 INVITEE_NOT_FOUND
```

---

## 13.3 Accept Invitation

```http
POST /api/invitations/:invitationId/accept
```

Only the Invitee.

Success:

```http
200 OK
```

Response includes the created `MEMBER` Membership.

Conflicts:

```text
409 INVITATION_NOT_PENDING
409 MEMBERSHIP_ALREADY_EXISTS
```

---

## 13.4 Reject Invitation

```http
POST /api/invitations/:invitationId/reject
```

Only the Invitee.

Success:

```http
204 No Content
```

Conflict:

```text
409 INVITATION_NOT_PENDING
```

---

# 14. ItineraryDay Endpoints

## 14.1 List Days

```http
GET /api/trips/:tripId/days
```

Protected.

Example:

```json
{
  "days": [
    {
      "id": "uuid",
      "dayNumber": 1,
      "date": "2026-10-12"
    }
  ]
}
```

P0 does not expose manual Day create/update/delete endpoints.

---

# 15. Activity DTO

Canonical Activity response:

```json
{
  "id": "uuid",
  "tripId": "uuid",
  "itineraryDayId": "uuid",
  "proposalId": null,
  "title": "Sagrada Família",
  "startTime": "09:00",
  "endTime": "11:00",
  "location": "Carrer de Mallorca",
  "description": null,
  "version": 3,
  "createdBy": {
    "id": "uuid",
    "username": "alice"
  },
  "updatedBy": {
    "id": "uuid",
    "username": "bob"
  },
  "createdAt": "2026-10-10T18:00:00Z",
  "updatedAt": "2026-10-10T19:00:00Z"
}
```

`proposalId` is read-only in normal Activity CRUD.

Proposal origin is set only by Adoption.

---

# 16. Activity Endpoints

## 16.1 List Activities

```http
GET /api/trips/:tripId/activities
```

Optional filter:

```text
?dayId=<uuid>
```

Results are ordered by:

```text
ItineraryDay.date ASC
startTime ASC
createdAt ASC
```

---

## 16.2 Create Activity

```http
POST /api/trips/:tripId/activities
```

Protected.

Request:

```json
{
  "itineraryDayId": "uuid",
  "title": "Sagrada Família",
  "startTime": "09:00",
  "endTime": "11:00",
  "location": "Carrer de Mallorca",
  "description": null
}
```

Success:

```http
201 Created
```

The client must not submit:

```text
createdBy
updatedBy
createdAt
updatedAt
version
proposalId
isLocked
```

---

## 16.3 Get Activity

```http
GET /api/trips/:tripId/activities/:activityId
```

Protected.

The backend verifies that the Activity belongs to `tripId`.

---

## 16.4 Update Activity

```http
PATCH /api/trips/:tripId/activities/:activityId
```

Protected.

`expectedVersion` is mandatory.

Example:

```json
{
  "expectedVersion": 3,
  "title": "Sagrada Família morning visit",
  "startTime": "09:30",
  "endTime": "11:30",
  "location": "Carrer de Mallorca",
  "description": null
}
```

Editable fields:

```text
itineraryDayId
title
startTime
endTime
location
description
```

Success:

```http
200 OK
```

The response returns the latest Activity.

### OCC conflict

If stored version no longer matches:

```http
409 Conflict
```

```json
{
  "error": {
    "code": "ACTIVITY_VERSION_CONFLICT",
    "message": "This activity was changed by another user.",
    "details": {
      "latestActivity": {}
    }
  }
}
```

The stale update is not applied.

---

## 16.5 Delete Activity

```http
DELETE /api/trips/:tripId/activities/:activityId
```

Request:

```json
{
  "expectedVersion": 3
}
```

The version check prevents a stale client from deleting an Activity that changed after it was loaded.

Success:

```http
200 OK
```

Direct Activity response:

```json
{
  "deletedActivityId": "uuid",
  "reopenedProposalId": null
}
```

Proposal-sourced Activity response:

```json
{
  "deletedActivityId": "uuid",
  "reopenedProposalId": "proposal-uuid"
}
```

For Proposal-sourced Activity deletion, the backend transaction also sets:

```text
Proposal.is_adopted = false
```

Stale version:

```text
409 ACTIVITY_VERSION_CONFLICT
```

---

# 17. Proposal DTO

Canonical Proposal response:

```json
{
  "id": "uuid",
  "tripId": "uuid",
  "title": "Visit Montserrat",
  "description": "Day trip outside Barcelona",
  "isAdopted": false,
  "createdBy": {
    "id": "uuid",
    "username": "alice"
  },
  "createdAt": "2026-10-10T18:00:00Z",
  "voteSummary": {
    "agreeCount": 2,
    "rejectCount": 1,
    "participantCount": 4,
    "requiredAgreeCount": 3,
    "currentUserDecision": "AGREE",
    "canAdopt": false
  }
}
```

`currentUserDecision` may be:

```text
AGREE
REJECT
null
```

`null` means not voted.

`canAdopt` is server-computed convenience data only.

It is not a guarantee that a later Adoption submit will succeed.

---

# 18. Proposal Endpoints

## 18.1 List Proposals

```http
GET /api/trips/:tripId/proposals
```

Protected.

Default ordering:

```text
createdAt DESC
```

---

## 18.2 Create Proposal

```http
POST /api/trips/:tripId/proposals
```

Request:

```json
{
  "title": "Visit Montserrat",
  "description": "Day trip outside Barcelona"
}
```

Success:

```http
201 Created
```

P0 has no Proposal Edit/Delete endpoints.

---

## 18.3 Get Proposal

```http
GET /api/trips/:tripId/proposals/:proposalId
```

Protected.

Returns the canonical Proposal DTO.

---

# 19. Vote Endpoint

## 19.1 Cast or Change Current Vote

```http
PUT /api/trips/:tripId/proposals/:proposalId/vote
```

`PUT` is used because there is one current Vote resource for:

```text
current User + Proposal
```

Request:

```json
{
  "decision": "AGREE"
}
```

or:

```json
{
  "decision": "REJECT"
}
```

Success:

```http
200 OK
```

Response returns the updated Proposal DTO.

There is no P0 Vote retract endpoint.

If Proposal is already adopted:

```text
409 PROPOSAL_VOTING_CLOSED
```

---

# 20. Proposal Adoption Endpoint

## 20.1 Adopt Proposal

```http
POST /api/trips/:tripId/proposals/:proposalId/adopt
```

Protected to any current Trip participant.

Request:

```json
{
  "itineraryDayId": "uuid",
  "title": "Visit Montserrat",
  "startTime": "08:30",
  "endTime": "17:00",
  "location": "Montserrat",
  "description": "Adopted from proposal"
}
```

The frontend may prefill Title from Proposal.

The client must not submit:

```text
proposalId
isAdopted
createdBy
version
vote counts
participant count
canAdopt
```

The backend follows `04-DATABASE_CONTRACT.md`:

```text
authenticate
→ verify current Membership
→ lock required concurrency boundary
→ verify Proposal is not adopted
→ recalculate current participant count
→ recalculate current AGREE count
→ verify strict majority
→ validate Activity fields
→ create Activity with Proposal origin
→ set Proposal.is_adopted = true
→ commit
→ broadcast realtime update
```

Success:

```http
201 Created
```

Response:

```json
{
  "proposal": {},
  "activity": {}
}
```

---

# 21. Adoption Conflict Cases

## 21.1 Majority lost before submit

Scenario:

```text
A opens Adopt form while threshold is satisfied
B changes Vote / Membership state
A submits after threshold is no longer satisfied
```

Response:

```http
409 Conflict
```

```json
{
  "error": {
    "code": "PROPOSAL_MAJORITY_LOST",
    "message": "The proposal no longer has enough AGREE votes to be adopted.",
    "details": {
      "agreeCount": 2,
      "participantCount": 4,
      "requiredAgreeCount": 3
    }
  }
}
```

No Activity is created.

`Proposal.is_adopted` remains `false`.

---

## 21.2 Already adopted / concurrent double submit

If another User adopted first:

```text
409 PROPOSAL_ALREADY_ADOPTED
```

No second Activity is created.

---

## 21.3 Invalid scheduling Day

If `itineraryDayId` does not belong to the same Trip:

```text
422 ACTIVITY_DAY_INVALID
```

---

# 22. Cross-Trip Resource Safety

Nested URLs do not make IDs trusted.

Backend verifies:

```text
Activity belongs to :tripId
Proposal belongs to :tripId
ItineraryDay belongs to :tripId
Invitation belongs to its Trip
Proposal-sourced Activity and Proposal belong to the same Trip
```

A valid ID from another Trip must never be accepted merely because the User has access elsewhere.

---

# 23. Not-Found vs Forbidden Behaviour

Unauthenticated:

```text
401
```

Authenticated:

- known resource but insufficient action permission → `403`;
- resource does not exist inside requested parent context → `404`.

Examples:

Member tries to delete their Trip:

```text
403 TRIP_OWNER_REQUIRED
```

Activity ID does not belong to URL Trip:

```text
404 ACTIVITY_NOT_FOUND
```

---

# 24. Canonical Error Codes

## Authentication

```text
INVALID_CREDENTIALS
AUTHENTICATION_REQUIRED
```

## User

```text
EMAIL_ALREADY_EXISTS
USERNAME_ALREADY_EXISTS
```

## Trip / Membership

```text
TRIP_NOT_FOUND
TRIP_OWNER_REQUIRED
MEMBERSHIP_REQUIRED
MEMBERSHIP_ALREADY_EXISTS
OWNER_CANNOT_LEAVE
```

## Invitation

```text
INVITATION_NOT_FOUND
INVITEE_NOT_FOUND
INVITATION_ALREADY_PENDING
INVITATION_NOT_PENDING
```

## Activity

```text
ACTIVITY_NOT_FOUND
ACTIVITY_DAY_INVALID
ACTIVITY_VERSION_CONFLICT
```

## Proposal / Vote / Adoption

```text
PROPOSAL_NOT_FOUND
PROPOSAL_VOTING_CLOSED
PROPOSAL_MAJORITY_LOST
PROPOSAL_ALREADY_ADOPTED
```

## Generic

```text
VALIDATION_ERROR
MALFORMED_REQUEST
INTERNAL_ERROR
```

Implementations must reuse these names rather than invent synonyms.

---

# 25. Client Retry Rules

Safe GET requests may be retried after transient network failure.

The frontend must not blindly retry state-changing requests that returned `409`.

Examples:

```text
ACTIVITY_VERSION_CONFLICT
PROPOSAL_MAJORITY_LOST
PROPOSAL_ALREADY_ADOPTED
```

require current-state refresh or user-visible reconciliation.

If a mutation's outcome is unknown because of network failure, refetch current state before repeating the action.

---

# 26. Realtime Relationship

REST remains the write/query authority.

Collaborative mutation order:

```text
REST request
→ validate
→ DB commit
→ REST success
→ Socket.IO broadcast
```

Realtime event names and payloads belong to `06-REALTIME_CONTRACT.md`.

---

# 27. Endpoint Summary

```text
AUTH
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

TRIPS
GET    /api/trips
POST   /api/trips
GET    /api/trips/:tripId
DELETE /api/trips/:tripId

MEMBERS
GET    /api/trips/:tripId/members
POST   /api/trips/:tripId/leave

INVITATIONS
GET    /api/invitations?status=PENDING
POST   /api/trips/:tripId/invitations
POST   /api/invitations/:invitationId/accept
POST   /api/invitations/:invitationId/reject

DAYS
GET    /api/trips/:tripId/days

ACTIVITIES
GET    /api/trips/:tripId/activities
POST   /api/trips/:tripId/activities
GET    /api/trips/:tripId/activities/:activityId
PATCH  /api/trips/:tripId/activities/:activityId
DELETE /api/trips/:tripId/activities/:activityId

PROPOSALS
GET    /api/trips/:tripId/proposals
POST   /api/trips/:tripId/proposals
GET    /api/trips/:tripId/proposals/:proposalId
PUT    /api/trips/:tripId/proposals/:proposalId/vote
POST   /api/trips/:tripId/proposals/:proposalId/adopt
```

---

# 28. Explicit P0 REST Non-Goals

P0 REST does not expose endpoints for:

- Edit Trip;
- Trip date changes;
- manual Day CRUD;
- Unscheduled Activity Pool;
- Activity Lock/Confirm;
- Activity participant attendance;
- Proposal Edit/Delete;
- Vote retraction to unvoted;
- Proposal Deadline/manual Close;
- automatic Proposal → Activity conversion;
- Owner Transfer;
- Editor/Viewer roles;
- Invite Link/Invite Code;
- Chat/Messages;
- Notifications Center;
- Files;
- Budget;
- Maps;
- full Activity Audit Log;
- PWA/offline mutation queues.

---

# Review Checklist

Before freezing this REST Contract, confirm:

- [ ] `/api` remains the global prefix.
- [ ] JSON uses camelCase.
- [ ] dates use `YYYY-MM-DD`; Activity times use `HH:mm`.
- [ ] common error payload uses stable `error.code`.
- [ ] `401 / 403 / 404 / 409 / 422` meanings are consistent.
- [ ] Register establishes an authenticated session.
- [ ] P0 has no Trip update endpoint.
- [ ] My Trips includes only current Membership Trips.
- [ ] Pending Invitations are separate.
- [ ] Invite accepts exact Username or exact Email only.
- [ ] Days are read-only system-generated resources.
- [ ] direct Activity Create cannot set `proposalId`.
- [ ] Activity update/delete requires `expectedVersion`.
- [ ] stale Activity writes return `409 ACTIVITY_VERSION_CONFLICT`.
- [ ] Proposal response includes current vote summary and current User decision.
- [ ] Vote endpoint supports only `AGREE / REJECT`; no retract endpoint exists.
- [ ] Adopted Proposal rejects Vote changes.
- [ ] Adoption always recalculates current majority server-side.
- [ ] majority lost during form entry returns `409 PROPOSAL_MAJORITY_LOST`.
- [ ] concurrent double-Adopt returns conflict and never creates two Activities.
- [ ] deleting Proposal-sourced Activity reopens its Proposal.
- [ ] nested resource relationships are always verified server-side.
- [ ] REST mutation succeeds only after DB commit; realtime broadcast comes afterward.
