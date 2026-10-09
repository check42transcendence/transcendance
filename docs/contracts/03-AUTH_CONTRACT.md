# P0 Authentication & Authorization Contract

Status: Draft  
Scope: P0  
Owner: Tech Lead  
Depends on: Frozen P0 Scope, Frozen P0 Business Rules, `00-DOMAIN_VOCABULARY.md`, `01-ARCHITECTURE.md`, `02-DOMAIN_MODEL.md`

## Purpose

This document defines the shared authentication and authorization rules for P0.

It specifies:

- how a User proves identity;
- how authenticated state is carried between the browser and backend;
- which security boundary is authoritative;
- how Trip ownership and membership are checked;
- which P0 actions require Owner or current Trip access;
- how authentication applies to Socket.IO connections.

This contract does not define the final Prisma schema, complete REST endpoint list, DTO shapes, or WebSocket event payloads.

---

# 1. P0 Authentication Model

P0 uses Email + Password authentication.

Registration requires:

- Email;
- Username;
- Password.

Login requires:

- Email;
- Password.

P0 does not require:

- 42 OAuth;
- third-party social login;
- multi-factor authentication;
- passwordless login;
- email verification;
- password reset flows.

Those features may be added only through a future scope change.

---

# 2. Authentication Mechanism

P0 uses a signed JWT carried in an HttpOnly cookie.

The browser must not store the authentication token in:

- `localStorage`;
- `sessionStorage`;
- application-readable JavaScript state.

The backend creates and verifies the JWT.

The JWT is authentication proof only. It is not the source of Trip authorization state.

## Why the token stays minimal

The JWT should contain only the minimum identity/session claims required by the backend, for example:

```text
sub = User ID
iat = issued-at time
exp = expiration time
```

Trip ownership, Membership, Invitation state, and other permissions must not be permanently encoded into the JWT.

Those permissions are dynamic and must be checked against current backend state.

---

# 3. Authentication Cookie

The authentication JWT is sent in a cookie controlled by the backend.

The cookie must use:

```text
HttpOnly = true
Path = /
SameSite = Lax
```

In production over HTTPS:

```text
Secure = true
```

The cookie expiration must not outlive the JWT expiration.

The default JWT/session lifetime is 24 hours and must be configurable rather than hard-coded into application logic.

The exact cookie name and environment variable names are documented in the Environment and Workflow Contract.

---

# 4. Password Rules

Passwords are treated as secret opaque values.

P0 password rules:

- minimum length: 8 characters;
- maximum length: 128 characters;
- no mandatory uppercase/lowercase/digit/symbol composition rule;
- password input must not be lowercased;
- password input must not be silently trimmed before verification.

Passwords must never be stored in plaintext.

The backend must hash passwords using a password-hashing algorithm designed for password storage.

The P0 implementation baseline is `Argon2id`.

Password hashes must never be returned by REST APIs, WebSocket payloads, logs, or frontend state.

---

# 5. Email and Username Identity Rules

Email is used for authentication and may also be used for exact Invitation lookup.

Username is the normal public/basic identity displayed to other Users.

Email and Username are both unique in P0.

## Normalization

Email comparison must be case-insensitive after surrounding whitespace is removed.

Username uniqueness and exact lookup must also be case-insensitive after surrounding whitespace is removed.

The application may preserve the User's original Username capitalization for display.

The Database Contract decides the exact database-level mechanism used to enforce this rule.

---

# 6. Registration Rules

Registration is a public operation and does not require an existing authenticated session.

The backend must validate:

- Email format;
- Username presence and allowed length;
- Password rules;
- Email uniqueness;
- Username uniqueness.

Registration must never trust frontend-only validation.

A successful registration creates exactly one User account.

The detailed request and response DTOs, HTTP status codes, and whether registration immediately establishes an authenticated session are defined in the REST API Contract.

---

# 7. Login Rules

Login is a public operation.

The User authenticates using:

```text
Email + Password
```

Username login is not part of P0.

The backend must:

1. normalize the Email for lookup;
2. find the User;
3. verify the submitted Password against the stored password hash;
4. create a valid JWT;
5. place the JWT in the authentication cookie.

Invalid Email and invalid Password must produce the same public login failure message.

The login response must not reveal whether a particular Email is registered.

---

# 8. Logout Rules

Logout clears the authentication cookie in the current client.

P0 does not require a server-side token revocation list or distributed session store.

Because authorization is always checked against current backend state, logging out is separate from Trip Membership changes.

If a Member leaves a Trip, that User must lose Trip access immediately even if their authentication JWT is still otherwise valid.

---

# 9. Current User Identity

After authentication, the backend derives the current User identity from the verified JWT.

The frontend must not be allowed to choose or override the authenticated User ID through request data.

For example, a request must not be authorized merely because the frontend sends:

```text
userId = currentUserId
```

The authoritative current User ID comes from the verified authentication context on the backend.

---

# 10. Authentication vs Authorization

Authentication answers:

> Who is this User?

Authorization answers:

> Is this authenticated User allowed to perform this action on this resource?

These are separate checks.

A valid login does not automatically grant access to every Trip.

The backend must perform resource-level authorization for protected P0 operations.

Frontend visibility rules are for user experience only and are not security enforcement.

---

# 11. Trip Access Rule

A User may access a Trip Workspace only when the User is:

```text
the Trip Owner
OR
a current Member represented by TripMembership
```

Conceptually:

```text
canAccessTrip(user, trip)
=
trip.owner == user
OR
current TripMembership exists for user + trip
```

A Pending Invitation does not grant Trip Workspace access.

A former Member who has left the Trip does not retain Trip Workspace access.

This rule must be enforced by the backend even when a User directly enters or calls a known Trip ID.

---

# 12. Owner-Only Operations

Only the current Trip Owner may:

- modify Trip Title;
- modify Trip Destination;
- modify Trip Start Date;
- modify Trip End Date;
- modify Trip Description;
- invite a registered User to the Trip;
- delete the Trip.

P0 has no ownership transfer.

The Owner cannot Leave Trip.

Authorization must check the current Trip Owner relationship in backend state.

The frontend must not determine Owner authority from a client-provided role value.

---

# 13. Current Trip Participant Operations

For P0, both the Trip Owner and current Members may access collaborative Trip features.

Subject to the relevant Business Rules, they may:

- view Trip details;
- view the Member list;
- view the Itinerary;
- create Activities;
- update Activities;
- delete Activities;
- create Proposals;
- view Proposals;
- cast or change Votes.

The backend must verify current Trip access before each protected operation.

Activity Creator and Proposal Creator do not receive exclusive edit permissions merely because they created the object.

---

# 14. Invitation Authorization

Only the Trip Owner may create an Invitation.

An Invitation may target only a registered User.

Only the invited User may:

- view their Pending Invitation decision context;
- Accept that Invitation;
- Decline that Invitation.

A different authenticated User must not be able to Accept or Decline another User's Invitation by guessing an Invitation ID.

A Pending Invitation may expose the limited Trip summary allowed by the Business Rules, but it must not grant general Trip Workspace access.

---

# 15. Leave Trip Authorization

Only a current non-owner Member may Leave Trip.

A User may leave only their own Membership.

The frontend must not submit another User ID to remove another Member as part of the P0 Leave flow.

The Owner cannot Leave Trip in P0.

When Leave succeeds:

- the Membership ends;
- Trip Workspace access ends immediately;
- the Trip disappears from My Trips;
- historical Activity and Proposal contributions remain;
- that User's Votes in the Trip no longer count.

---

# 16. Activity Authorization

Before Activity read/write operations, the backend must determine the Activity's Trip context and verify current Trip access.

P0 does not use Activity Creator ownership as the authorization rule.

Therefore:

```text
Activity.creator == currentUser
```

is not required for update or delete.

The relevant authorization rule is current access to the Activity's Trip.

Concurrent-update validation is a separate requirement and is defined by the Database and REST API contracts.

---

# 17. Proposal and Vote Authorization

A Proposal belongs to one Trip.

Before Proposal or Vote operations, the backend must verify current access to that Trip.

Current Trip participants may create Proposals.

The Proposal Creator may vote on their own Proposal.

A User may cast or change only their own Vote.

A User must not be able to submit another User's identity in order to create or replace that other User's Vote.

The voting User identity comes from the authenticated backend context.

---

# 18. Authorization Must Follow Relationships

Authorization must not trust unrelated client IDs.

For nested resources, the backend must verify that the relationships are valid.

Examples:

- an Activity being modified must actually belong to the expected Trip;
- a Proposal being voted on must belong to the Trip the User can access;
- an Invitation must belong to the referenced Trip and target the authenticated invited User.

This prevents cross-Trip authorization bugs where valid IDs from different Trips are incorrectly combined.

---

# 19. Backend Guard and Service Responsibilities

NestJS authentication should be enforced through shared backend mechanisms rather than duplicated manually in every controller.

The expected pattern is:

```text
Request
  ↓
Authentication Guard
  ↓
Current User available to backend
  ↓
Resource / Trip authorization check
  ↓
Business validation
  ↓
Mutation or query
```

Authentication verification may be implemented as a shared NestJS Guard.

Resource-specific authorization may be implemented through shared authorization helpers, guards, or service-level checks.

The exact class/file structure is an implementation detail, but different Vertical Slices must not invent incompatible authentication mechanisms.

---

# 20. REST Authentication Behaviour

Protected REST endpoints require a valid authentication cookie.

At the REST level:

- missing or invalid authentication means `401 Unauthorized`;
- valid authentication but insufficient permission means `403 Forbidden`.

Business conflicts such as duplicate Membership, stale Activity versions, or invalid Trip date changes are not authentication failures and must use the appropriate non-auth error defined by the REST API Contract.

---

# 21. Socket.IO Authentication

Socket.IO uses the same authenticated User identity as the REST backend.

The Socket.IO connection must be authenticated by the backend using the authentication cookie during the connection/handshake process.

The client must not send a trusted `userId` as proof of identity.

A socket may join a Trip-specific realtime room only after the backend verifies that the authenticated User currently has access to that Trip.

A Pending Invitation is not sufficient to join the Trip room.

When Membership ends, the User must no longer continue receiving protected Trip realtime updates.

The exact room names, events, payloads, reconnect behaviour, and membership-removal mechanics are defined in the Realtime Contract.

---

# 22. Frontend Authentication Rules

The frontend may:

- show different UI for authenticated and unauthenticated Users;
- show Owner-only buttons only to the Owner;
- show Leave Trip only to non-owner Members;
- redirect unauthenticated Users to Login;
- react to `401` / `403` responses.

The frontend must not:

- read the HttpOnly JWT;
- use localStorage/sessionStorage as the authentication source;
- treat hidden buttons as authorization;
- trust a locally stored Owner/Member role without backend verification;
- send a User ID as proof of identity.

---

# 23. Email Privacy

Email is primarily an authentication and exact-invitation identifier.

General public/basic User identity should use Username.

General Member lists, Activity Creator displays, and Proposal Creator displays should not expose another User's Email by default.

The authenticated User may access their own Email through the appropriate self/profile API.

Invitation flows may accept an exact Email as input without creating a fuzzy or browsable User directory.

---

# 24. Cookie Security, Same-Site Requests, and CORS

The preferred browser architecture uses the frontend-facing `/api` path so that normal browser requests can remain same-origin where possible.

Authentication cookies use `SameSite=Lax`.

In production, state-changing requests must not accept arbitrary cross-origin browser origins.

If CORS is required by a deployment environment:

- allowed origins must be explicitly configured;
- wildcard `*` must not be used with credentialed authentication;
- credentials may be enabled only for approved frontend origins.

Secrets and allowed origins must come from environment configuration, not committed source code.

---

# 25. Authentication Secrets

JWT signing secrets and other authentication secrets must:

- come from environment configuration;
- never be committed to Git;
- never appear in `.env.example` as real values;
- never be logged.

The repository may provide placeholder variable names in `.env.example`.

Detailed environment variable naming is defined in `08-ENVIRONMENT_AND_WORKFLOW.md`.

---

# 26. Logging Rules

Authentication logs may record operational events such as:

- successful login;
- failed login;
- logout;
- authorization denial.

Logs must not contain:

- plaintext Passwords;
- password hashes;
- JWT values;
- authentication cookies;
- secret keys.

Avoid logging full sensitive request bodies on authentication endpoints.

---

# 27. P0 Security Non-Goals

P0 does not require:

- OAuth / social login;
- 42 intra authentication;
- MFA;
- password reset email workflow;
- email verification;
- account recovery;
- account deletion;
- ownership transfer;
- admin / moderator roles;
- Editor / Viewer roles;
- server-side distributed session storage;
- Redis-backed session management;
- refresh-token rotation;
- device/session management UI.

These features require an explicit future scope decision.

---

# 28. Decisions Deferred to Later Contracts

This Auth Contract intentionally does not define:

- final Prisma User fields;
- password-hash column type;
- database indexes;
- exact registration/login/logout endpoint paths;
- complete Auth DTO shapes;
- common API error payload format;
- exact frontend route names;
- exact Socket.IO room/event names;
- the final environment variable names;
- rate-limit thresholds.

Those decisions belong to the Database, REST API, Realtime, Shared Types, and Environment contracts.

---

# Review Checklist

Before freezing this document, the team should confirm:

- [ ] P0 uses Email + Password authentication.
- [ ] JWT is carried in an HttpOnly cookie, not localStorage/sessionStorage.
- [ ] The JWT contains identity/session claims only, not Trip roles or Membership state.
- [ ] Passwords use Argon2id and are never stored or logged in plaintext.
- [ ] Email and Username uniqueness/lookup are case-insensitive after trimming.
- [ ] Backend authentication is the authoritative source of current User identity.
- [ ] Trip access means Owner OR current TripMembership.
- [ ] Pending Invitation does not grant Trip Workspace access.
- [ ] Owner-only operations match the P0 Business Rules.
- [ ] Activity/Proposal Creator does not gain exclusive collaboration permissions.
- [ ] A User can act only on their own Invitation decision, Membership leave action, and Vote identity.
- [ ] Backend verifies resource-to-Trip relationships to prevent cross-Trip authorization bugs.
- [ ] `401` and `403` are used for authentication/authorization failures respectively.
- [ ] Socket.IO authenticates through the backend and authorizes Trip-room access.
- [ ] Other Users' Emails are not exposed as normal public identity.
- [ ] Auth secrets come from environment configuration and are never committed.
- [ ] P0 does not introduce OAuth, MFA, password reset, or complex roles.
