# P0 Architecture Contract

Status: Draft  
Scope: P0  
Owner: Tech Lead  
Depends on: Frozen P0 Scope, Frozen P0 Business Rules v2, `00-DOMAIN_VOCABULARY.md`

## 1. Technology Baseline

- Frontend: React + TypeScript + Vite
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Realtime: Socket.IO in the NestJS backend
- Local/container orchestration: Docker Compose
- Package manager: npm
- Node.js: root `.nvmrc`

## 2. High-Level Architecture

```text
Browser
   ↓
React Frontend
   ↓ REST / Socket.IO
NestJS Backend
   ↓ Prisma
PostgreSQL
```

Backend/database state is authoritative.

## 3. Frontend Responsibilities

The frontend:

- renders UI;
- collects input;
- calls REST APIs;
- receives realtime updates;
- displays loading/success/error/conflict states;
- displays Activity recent-editor information;
- uses one shared i18n / translation-key mechanism for user-facing text.

P0 is i18n-ready but does not require full multilingual delivery or a Language Switcher.

Frontend UI is not a security boundary.

## 4. Backend Responsibilities

The backend owns:

- authentication;
- authorization;
- Membership Role checks;
- business-rule validation;
- Proposal majority/adoption validation;
- Activity OCC/conflict handling;
- system-controlled editor/time metadata;
- persistence;
- realtime broadcast.

## 5. REST Boundary

REST is the primary command/query interface.

P0 includes REST commands for:

- auth;
- Trip create/delete;
- invitations;
- leave;
- Activity CRUD;
- Proposal create/view;
- Vote create/change;
- Proposal Adoption.

P0 has no Edit Trip command.

All endpoints use global prefix:

```text
/api
```

## 6. Realtime Boundary

Successful collaborative mutation flow:

```text
Validate
→ Persist / Commit
→ Broadcast
```

Realtime covers:

- Activity create/update/delete;
- recent Activity editor/time;
- Proposal create;
- Vote changes;
- Proposal Adoption state changes.

Socket.IO is not a second database write path.

## 7. Proposal Adoption Boundary

`Proposal.is_adopted` is the stored marker for whether a Proposal has been accepted/adopted.

It is not an Activity relation field.

A separate database relation may identify which Activity originated from which Proposal so that the one-to-one adoption rule and delete/re-adopt behaviour can be enforced.

Exact fields/constraints belong to the Database Contract.

## 8. Backend Module Principle

Expected capability areas:

- auth;
- users;
- trips/membership;
- invitations;
- itinerary/activities;
- proposals/votes/adoption;
- realtime;
- shared/common.

## 9. Runtime Services

```text
frontend
backend
postgres
```

No Redis, queues, microservices, or separate realtime service in P0.

## 10. Ports

```text
Frontend 5173
Backend 3000
PostgreSQL 5432
```

## 11. Current Proxy Note

Current bootstrap proxy:

```text
/api → http://127.0.0.1:3000
```

is transitional until Docker Compose service routing is added.

## 12. Deferred Details

Later contracts define:

- exact DB tables/fields;
- OWNER uniqueness mechanism;
- Proposal-to-Activity relation field direction;
- REST DTOs/errors;
- Socket.IO event names/payloads;
- OCC implementation;
- Adoption transaction details;
- exact i18n library.
