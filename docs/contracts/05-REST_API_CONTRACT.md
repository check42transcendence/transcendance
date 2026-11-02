# P0 REST API Contract

Status: Frozen  
Scope: P0  
Owner: Tech Lead  
Depends on: `02-DOMAIN_MODEL.md`, `03-AUTH_CONTRACT.md`, `04-DATABASE_CONTRACT.md`

## Purpose

Defines the browser-facing P0 REST surface, canonical DTO conventions, status codes, and stable error codes.

## 1. Global Rules

Prefix:

```text
/api
```

JSON naming:

```text
camelCase
```

Identifiers:

```text
UUID strings
```

Dates:

```text
YYYY-MM-DD
```

Activity local time:

```text
HH:mm
```

Authentication is carried by the HttpOnly cookie; frontend does not manually attach JWT identity.

## 2. Success / Error Conventions

Use resource-specific response keys such as:

```json
{ "user": {} }
{ "trip": {} }
{ "activity": {} }
{ "proposal": {} }
```

Common error:

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

Status semantics:

```text
200 OK            successful read/update/action
201 Created       resource created
204 No Content    successful action with no response body
400 Bad Request   malformed input or validation failure
401 Unauthorized  missing/invalid authentication
403 Forbidden     authenticated but insufficient permission
404 Not Found     resource absent in requested parent context
409 Conflict      current persisted state conflicts with request
500               unexpected server failure
```

P0 uses `400`, not a custom `422`, for request validation.

## 3. Authentication

### Input validation

- Email: trim surrounding whitespace, require a valid email format, maximum 254 characters.
- Registration username: trim surrounding whitespace, require a non-empty value, maximum 50 characters.
- Registration and login passwords: minimum 8 Unicode code points, maximum 72 UTF-8 bytes.
- Passwords may contain Unicode and whitespace; do not trim or truncate them.
- Invalid input returns `400 VALIDATION_ERROR`. Valid input with incorrect login credentials returns `401 INVALID_CREDENTIALS`.

Development accounts with passwords outside these limits must be recreated.

### POST /api/auth/register

Request:

```json
{
  "email": "alice@example.com",
  "username": "alice",
  "password": "example-password"
}
```

Success:

```text
201
```

Returns the new User.

Freeze-candidate choice: Register does **not** establish an authenticated session. Login remains explicit.

Conflicts:

```text
409 EMAIL_ALREADY_EXISTS
409 USERNAME_ALREADY_EXISTS
```

### POST /api/auth/login

Request:

```json
{
  "email": "alice@example.com",
  "password": "example-password"
}
```

Success `200` and sets auth cookie.

Invalid credentials:

```text
401 INVALID_CREDENTIALS
```

Do not reveal whether Email exists.

### POST /api/auth/logout

```text
204
```

Clears auth cookie.

### GET /api/auth/me

Protected. Returns current User.

## 4. Trips

```text
GET    /api/trips
POST   /api/trips
GET    /api/trips/:tripId
DELETE /api/trips/:tripId
```

No Trip PATCH/PUT in P0.

### GET /api/trips

Returns only Trips where current User has current Membership.

Each item includes `currentUserRole`.

Order by `createdAt` descending, then `id` descending for equal timestamps.

### POST /api/trips

Request:

```json
{
  "title": "Barcelona",
  "destination": "Barcelona",
  "startDate": "2026-10-12",
  "endDate": "2026-10-15",
  "description": null
}
```

Trips may span at most 365 days, including both endpoints. Reject larger ranges
with `400 VALIDATION_ERROR` before generating Days or writing data.

Backend atomically creates Trip, OWNER Membership, and all Days.

### DELETE /api/trips/:tripId

Owner only.

Success:

```text
204
```

## 5. Members

```text
GET  /api/trips/:tripId/members
POST /api/trips/:tripId/leave
```

Member list does not expose other Users' Email by default.

Leave:

- MEMBER only;
- Owner receives `409 OWNER_CANNOT_LEAVE`;
- success `204`;
- Leave transaction removes Membership and that User's Votes for the Trip.

## 6. Invitations

```text
GET  /api/invitations?status=PENDING
POST /api/trips/:tripId/invitations
POST /api/invitations/:invitationId/accept
POST /api/invitations/:invitationId/reject
```

Create Invitation is Owner only.

Request contains exactly one identifier:

```json
{ "username": "alice" }
```

or:

```json
{ "email": "alice@example.com" }
```

Both/neither is `400 VALIDATION_ERROR`.

Unknown registered target:

```text
404 INVITEE_NOT_FOUND
```

Duplicate Pending / already current Member:

```text
409
```

Accept creates Membership.

Reject creates no Membership.

## 7. ItineraryDays

```text
GET /api/trips/:tripId/days
```

No Day CRUD.

## 8. Activity DTO

Canonical Activity fields:

```text
id
tripId
itineraryDayId
proposalId | null
title
startTime
endTime | null
location | null
description | null
version
createdBy
updatedBy
createdAt
updatedAt
```

## 9. Activity Endpoints

```text
GET    /api/trips/:tripId/activities
POST   /api/trips/:tripId/activities
GET    /api/trips/:tripId/activities/:activityId
PATCH  /api/trips/:tripId/activities/:activityId
DELETE /api/trips/:tripId/activities/:activityId
```

### Create

Client may set:

```text
itineraryDayId
title
startTime
endTime?
location?
description?
```

Client may not set Proposal origin or audit/version fields.

### Update

Request requires:

```text
expectedVersion
```

plus at least one editable field.

Stale update:

```text
409 ACTIVITY_VERSION_CONFLICT
```

Response may include latest Activity in `details`.

### Delete

Freeze-candidate choice: DELETE does **not** require an `expectedVersion` request body.

Successful direct Activity delete returns `200`:

```json
{
  "deletedActivityId": "uuid",
  "reopenedProposalId": null
}
```

Proposal-sourced Activity delete returns:

```json
{
  "deletedActivityId": "uuid",
  "reopenedProposalId": "proposal-uuid"
}
```

and atomically performs `ACCEPTED→PENDING`.

## 10. Proposal DTO

Canonical status:

```text
PENDING
ACCEPTED
```

Canonical vote summary:

```text
agreeCount
rejectCount
pendingCount
participantCount
requiredAgreeCount
canAdopt
```

Recipient-specific:

```text
currentUserDecision = AGREE | REJECT | null
```

`pendingCount` is derived.

`canAdopt` is convenience only.

P0 has no Proposal `REJECTED` status. A REJECT Vote changes only the vote data/summary and does not close the Proposal.

## 11. Proposal Endpoints

```text
GET  /api/trips/:tripId/proposals
POST /api/trips/:tripId/proposals
GET  /api/trips/:tripId/proposals/:proposalId
```

Create request:

```json
{
  "title": "Visit Montserrat",
  "description": "Day trip outside Barcelona"
}
```

Initial status is server-controlled `PENDING`.

No Proposal Edit/Delete.

## 12. Vote Endpoint

```text
PUT /api/trips/:tripId/proposals/:proposalId/vote
```

Request:

```json
{ "decision": "AGREE" }
```

or:

```json
{ "decision": "REJECT" }
```

No Vote DELETE/retract endpoint.

For a `PENDING` Proposal, backend upserts the current User's Vote and returns the updated Proposal/vote summary.

A REJECT Vote does not create any Proposal status transition.

`ACCEPTED` Vote mutation:

```text
409 PROPOSAL_VOTING_CLOSED
```

## 13. Adoption Endpoint

```text
POST /api/trips/:tripId/proposals/:proposalId/adopt
```

Any current participant while the Proposal is `PENDING`.

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

Client cannot set Proposal status, Proposal ID, Vote counts, Creator, or Activity version.

Backend recomputes current state inside the transaction.

Success:

```text
201
```

returns:

```json
{
  "proposal": {},
  "activity": {}
}
```

### Majority lost

If strict majority is no longer satisfied:

```text
409 PROPOSAL_MAJORITY_LOST
```

No Activity is created and Proposal remains `PENDING`.

### Already accepted / concurrent double submit

```text
409 PROPOSAL_ALREADY_ACCEPTED
```

No second Activity.

## 14. Cross-Trip Safety

For nested resources, backend verifies parent relationship.

A valid ID from another Trip is treated as not found in the requested parent context.

## 15. Canonical Error Codes

```text
INVALID_CREDENTIALS
AUTHENTICATION_REQUIRED

EMAIL_ALREADY_EXISTS
USERNAME_ALREADY_EXISTS

TRIP_NOT_FOUND
TRIP_OWNER_REQUIRED
MEMBERSHIP_REQUIRED
MEMBERSHIP_ALREADY_EXISTS
OWNER_CANNOT_LEAVE

INVITATION_NOT_FOUND
INVITEE_NOT_FOUND
INVITATION_ALREADY_PENDING
INVITATION_NOT_PENDING

ACTIVITY_NOT_FOUND
ACTIVITY_DAY_INVALID
ACTIVITY_VERSION_CONFLICT

PROPOSAL_NOT_FOUND
PROPOSAL_VOTING_CLOSED
PROPOSAL_MAJORITY_LOST
PROPOSAL_ALREADY_ACCEPTED

VALIDATION_ERROR
MALFORMED_REQUEST
INTERNAL_ERROR

ACCESS_DENIED
NOT_FOUND
STATE_CONFLICT
PAYLOAD_TOO_LARGE
CLIENT_ERROR
```

### 15.1 Generic HTTP fallback codes

The following three generic fallback codes standardize HTTP error responses without changing existing P0 business rules, permissions, or resource visibility.

| HTTP | Code | Default message | Use only when |
| --- | --- | --- | --- |
| `403 Forbidden` | `ACCESS_DENIED` | `Access denied` | The request has an authenticated identity but lacks permission, and no more specific contract-defined code applies. |
| `404 Not Found` | `NOT_FOUND` | `Not found` | The requested HTTP route or resource is not found and no more specific contract-defined code applies. This also covers an unregistered method/path combination if the framework reports it as 404. |
| `409 Conflict` | `STATE_CONFLICT` | `State conflict` | The request conflicts with the current state and no specific domain code applies. |

Responses use the standard envelope. Unless a particular domain contract
explicitly defines safe `details`, the default is `{}`.

Generic 403 example:

```json
{
  "error": {
    "code": "ACCESS_DENIED",
    "message": "Access denied",
    "details": {}
  }
}
```

Generic 404 example:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Not found",
    "details": {}
  }
}
```

### 15.2 Specific codes always take precedence

An already correctly formatted, intentional domain/auth error keeps its
**original HTTP status, `error.code`, message, and safe details**. The shared
HTTP exception filter must not replace it with a generic fallback.

| Situation | Status / code | Why not the generic fallback? |
| --- | --- | --- |
| Missing, expired, or invalid JWT for a protected endpoint | `401 AUTHENTICATION_REQUIRED` | The caller has not established valid identity; this is not 403. |
| Wrong email or password at login | `401 INVALID_CREDENTIALS` | Do not disclose whether the email exists. |
| Authenticated non-OWNER attempts an OWNER-only action | `403 TRIP_OWNER_REQUIRED` | The feature has an explicit permission error. |
| Authenticated caller lacks required current TripMembership | `403 MEMBERSHIP_REQUIRED` where a 403 is appropriate under the existing visibility rules | Do not confuse absence of Membership with an invalid JWT. |
| Trip absent or concealed by the existing access/isolation rules | `404 TRIP_NOT_FOUND` | Preserve domain-level non-disclosure. |
| Invitation absent (or inaccessible when the feature intentionally conceals it) | `404 INVITATION_NOT_FOUND` | Preserve domain-level handling. |
| Registered invitee cannot be found | `404 INVITEE_NOT_FOUND` | Preserve the explicit invitation error. |
| Activity absent or belongs to another Trip | `404 ACTIVITY_NOT_FOUND` | Preserve the URL parent/child relationship rule. |
| Proposal absent or belongs to another Trip | `404 PROPOSAL_NOT_FOUND` | Preserve the URL parent/child relationship rule. |
| Route not registered and no domain handler selected | `404 NOT_FOUND` | This is a framework-level fallback. |
| Authenticated access denial with no specific P0 code | `403 ACCESS_DENIED` | This is a framework/feature fallback, not a replacement for known codes. |

For an Activity, Proposal, or other nested resource, a valid identifier from
**another Trip** must still be treated as not found in the URL Trip context
(see Section 14). Do not leak whether the other Trip or its resource exists.
A pending Invitation still grants no Workspace access. Authentication and
current Membership/role authorization remain separate checks.

### 15.3 Other existing codes and status handling

This amendment does not redefine any existing code or status. In particular:

| Existing code(s) | Existing HTTP semantics |
| --- | --- |
| `VALIDATION_ERROR` | `400` for DTO validation failures, including forbidden extra fields. |
| `MALFORMED_REQUEST` | `400` for malformed request syntax, including invalid JSON. |
| `EMAIL_ALREADY_EXISTS`, `USERNAME_ALREADY_EXISTS` | `409` for registration uniqueness conflicts. |
| `MEMBERSHIP_ALREADY_EXISTS`, `OWNER_CANNOT_LEAVE` | `409` for their already-defined membership/leave conflicts. |
| `INVITATION_ALREADY_PENDING`, `INVITATION_NOT_PENDING` | `409` when the existing invitation state conflicts with the requested operation. |
| `ACTIVITY_VERSION_CONFLICT` | `409` for stale optimistic-concurrency updates. |
| `PROPOSAL_VOTING_CLOSED`, `PROPOSAL_MAJORITY_LOST`, `PROPOSAL_ALREADY_ACCEPTED` | `409` for the existing vote/adoption state conflicts. |
| `ACTIVITY_DAY_INVALID` | Keep the existing Activity input/Day relationship semantics. Do not use this addition to change Section 14's cross-Trip 404 non-disclosure rule. |
| `INTERNAL_ERROR` | `500` for unexpected server failures. Never return internal exception/DB details to clients. |
| `STATE_CONFLICT` | `409` fallback for an otherwise unclassified state conflict. Existing domain-specific 409 codes take precedence. |

`400` must not be silently changed to `422`; an Owner attempting to Leave
still receives `409 OWNER_CANNOT_LEAVE`, not `403 ACCESS_DENIED`. No 405
status, new route, new permission, or new business transition is introduced
by this clarification.

### 15.4 Shared exception-handler requirements

1. Preserve correctly shaped, intentional Auth and feature exceptions,
   including their existing HTTP status, stable code, message, and safe
   `details` object.
2. Convert invalid JSON/parser failures to `400 MALFORMED_REQUEST`, while
   keeping DTO validation errors as `400 VALIDATION_ERROR`.
3. Use `401 AUTHENTICATION_REQUIRED` for generic missing/invalid authentication;
   never substitute `ACCESS_DENIED` for a 401. Preserve `INVALID_CREDENTIALS`
   for login failures.
4. Normalize otherwise unclassified `403` errors to `ACCESS_DENIED` and
   otherwise unclassified `404` errors to `NOT_FOUND`. Do not overwrite
   feature-specific 403/404 codes.
5. Return `500 INTERNAL_ERROR` for unexpected failures without exposing
   stack traces, tokens, password hashes, SQL, connection strings, or other
   private diagnostic information. Server-side logging may retain the needed
   diagnostic information under appropriate controls.
6. Use stable `error.code` values for frontend decisions. Human-readable
   `message` is for display and must not be treated as the machine identifier.
7. Keep HTTP response formatting separate from business authorization:
   Services decide current Membership, role, cross-Trip relationships and
   transaction state; the exception handler only formats the result.
8. Normalize otherwise unclassified `409` errors to
   `STATE_CONFLICT`. Preserve all existing domain-specific
   conflict codes.
9. Unexpected HTTP statuses without a contract-defined code
   must not expose raw framework responses or internal details.

Regression tests must cover the three new fallbacks as well as preservation of
existing `401`, domain `403/404`, `409`, validation/malformed input and safe
`500` responses. This contract clarification and its regression tests are included in Issue #41.

### Recognized client errors

Known client-side HTTP errors must preserve their original status codes.

- `413 PAYLOAD_TOO_LARGE`: an oversized request body rejected by the Express parser.
- Other recognized but unclassified `4xx` errors use `CLIENT_ERROR` with the original HTTP status.

All responses use the canonical error envelope with safe messages and `details: {}`.

These fallback rules do not replace domain-specific error codes.
Unknown internal failures and server-side exceptions use `500 INTERNAL_ERROR`.

## 16. Realtime Relationship

REST owns writes.

Required invariant:

```text
DB commit happens before any success realtime event
```

The implementation does not need to guarantee whether the HTTP response reaches the client before or after the already-post-commit event.

## 17. Explicit REST Non-Goals

No endpoints for:

```text
Trip Edit
manual Day CRUD
Unscheduled Pool
Activity locks/participants
Proposal Edit/Delete
automatic Proposal rejection
Proposal REJECTED status/lifecycle
Rejected archive
Revise & Fork
Vote retract
Proposal Deadline/options
automatic Proposal→Activity conversion
Owner Transfer
Invite link/code
Chat
Notifications
Files
Budget
Maps
PWA/offline
```
