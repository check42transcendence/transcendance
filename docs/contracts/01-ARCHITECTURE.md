# P0 Architecture Contract

Status: Draft  
Scope: P0  
Owner: Tech Lead  
Depends on: Frozen P0 Scope, Frozen P0 Business Rules v2, `00-DOMAIN_VOCABULARY.md`

## Purpose

This document defines the shared high-level architecture for P0.

It specifies the major system components, their responsibilities, the communication paths between them, and the architectural rules that all Vertical Slices must follow.

Detailed database schemas, API endpoints, authorization rules, DTOs, and realtime event payloads are defined in later contracts.

---

# 1. Repository Structure

The project uses a monorepo.

```text
transcendance/
├── frontend/
├── backend/
├── docs/
└── .github/
```

Responsibilities:

- `frontend/` contains the React client application.
- `backend/` contains the NestJS server application.
- `docs/` contains shared product and technical documentation.
- `.github/` contains GitHub Actions and repository automation.

Frontend and backend remain separate applications but are developed and versioned in the same repository.

---

# 2. Technology Baseline

The P0 technical baseline is:

- Frontend: React + TypeScript + Vite
- Backend: NestJS + TypeScript
- Backend HTTP platform: Express through NestJS
- Database: PostgreSQL
- ORM: Prisma
- Realtime: Socket.IO integrated into the NestJS backend
- Local/container orchestration: Docker Compose
- Package manager: npm
- Node.js baseline: version defined by root `.nvmrc`

The current bootstrap uses Node.js `24.21.0`.

Technology changes that affect multiple Vertical Slices require shared review before adoption.

---

# 3. High-Level System Architecture

```text
Browser
   |
   v
React Frontend
   |
   | REST
   | Socket.IO
   v
NestJS Backend
   |
   | Prisma
   v
PostgreSQL
```

The NestJS backend is the central authority between the frontend and database.

The frontend must not access PostgreSQL or Prisma directly.

---

# 4. Component Responsibilities

## 4.1 Frontend

The frontend is responsible for:

- rendering the user interface;
- collecting user input;
- calling backend REST APIs;
- receiving realtime updates;
- displaying loading, success, conflict, and error states;
- keeping local UI state synchronized with backend state;
- displaying Activity recent-editor information;
- organizing user-facing text through the shared i18n / translation-key mechanism.

P0 is i18n-ready, not fully multilingual.

P0 may ship only the default language, but new user-facing component text must not be scattered as uncontrolled hard-coded strings when it belongs in the shared translation system.

The frontend must not be treated as a security boundary.

Hiding or disabling a button does not replace backend authorization.

---

## 4.2 Backend

The backend is responsible for:

- authentication;
- authorization;
- Membership Role enforcement;
- business-rule enforcement;
- input validation;
- database access;
- REST APIs;
- Proposal majority/adoption validation;
- realtime broadcasting;
- optimistic-concurrency conflict handling;
- setting system-controlled identity/time metadata such as Activity last editor;
- returning consistent errors to clients.

All protected Trip operations must be validated by the backend.

---

## 4.3 Database

PostgreSQL stores the persistent P0 application state.

Prisma is the ORM used by the NestJS backend to access PostgreSQL.

The frontend never accesses the database directly.

Detailed entities, constraints, relations, deletion behaviour, migrations, and transactional invariants are defined in the Domain Model and Database Contract.

---

# 5. Source of Truth

The persisted backend/database state is the authoritative application state.

Frontend state and Socket.IO events are not authoritative sources of truth.

Realtime events inform connected clients about committed changes.

After reconnecting or recovering from uncertain client state, the client must be able to obtain the latest authoritative state from the backend.

---

# 6. REST Responsibility

REST is the primary command and query interface between frontend and backend.

P0 commands include, among others:

- register / login / logout;
- create and delete Trip;
- create/respond to Invitation;
- leave Trip;
- Activity CRUD;
- Proposal create/view;
- Vote create/change;
- Proposal Adoption.

P0 has no REST command for editing Trip base information because Trip data is immutable after creation.

All P0 REST endpoints use the global prefix:

```text
/api
```

Examples:

```text
/api/health
/api/trips
```

Individual controllers define their resource path without repeating the global `api` prefix.

Detailed paths, DTOs, responses, status codes, and common errors belong to the REST API Contract.

---

# 7. Realtime Responsibility

Socket.IO is used for P0 realtime collaboration.

Realtime support runs inside the same NestJS backend application.

P0 does not introduce a separate realtime microservice.

The mutation flow is:

```text
User action
    ↓
REST request
    ↓
Backend auth / business / concurrency validation
    ↓
Database transaction commits
    ↓
Realtime broadcast
    ↓
Other connected Trip participants update their UI
```

P0 realtime broadcasting covers:

- Activity creation;
- Activity update, including latest editor/time;
- Activity deletion;
- Proposal creation;
- Vote changes;
- Proposal Adoption;
- Proposal returning to an adoptable state when its linked Activity is deleted.

Socket.IO events are synchronization notifications.

They are not a second independent database write path.

Detailed Trip-room rules, event names, payloads, authentication, and reconnect behaviour belong to the Realtime Contract.

---

# 8. Backend Module Boundary Principle

NestJS modules should be organized around business capabilities rather than one module per database table.

Expected P0 business areas include:

- authentication;
- users;
- trips and membership;
- invitations;
- itinerary and activities;
- proposals, votes, and adoption;
- realtime;
- shared/common infrastructure.

For example:

- `ItineraryDay` and `Activity` may belong to the same itinerary capability.
- `Proposal`, `Vote`, and Adoption logic may belong to the same proposal capability.

The exact folder structure may evolve, but different Vertical Slices must not create competing modules for the same business responsibility.

---

# 9. P0 Runtime Services

The target P0 Docker Compose architecture contains:

```text
frontend
backend
postgres
```

P0 does not require:

- Redis;
- message queues;
- separate realtime servers;
- background worker services;
- microservices.

New infrastructure requires a concrete P0 need and team review.

---

# 10. Port Baseline

```text
Frontend:   5173
Backend:    3000
PostgreSQL: 5432
```

Docker may expose different host mappings when documented, but internal service configuration must remain consistent.

---

# 11. API Routing and Proxy Boundary

The browser-facing REST path is `/api`.

The frontend should depend on the API path/configuration rather than a hard-coded localhost address.

## Current implementation note

The current bootstrap Vite development proxy forwards:

```text
/api → http://127.0.0.1:3000
```

This is a temporary local-development implementation.

`127.0.0.1:3000` is not part of the frozen architecture boundary.

When Docker Compose is introduced, routing must use Docker-compatible service/environment configuration.

The browser-facing `/api` contract remains unchanged.

---

# 12. Input Validation Boundary

The backend must validate all external input.

Frontend validation improves user experience but cannot replace backend validation.

This includes, for example:

- Trip creation validation;
- Activity required fields and time validity;
- Proposal adoption eligibility;
- resource-to-Trip relationship checks.

Exact validation libraries and DTO rules belong to later contracts.

---

# 13. Authentication and Authorization Boundary

Authentication and authorization are owned by the NestJS backend.

The frontend may use authenticated state and Membership Role to shape UI, but the backend must independently verify every protected operation.

P0 Owner authority comes from the current TripMembership role, not the historical Trip Creator relation.

Detailed rules are defined in `03-AUTH_CONTRACT.md`.

---

# 14. Persistence and Realtime Boundary

A successful collaborative mutation follows:

```text
Validate
→ Persist / Commit
→ Broadcast
```

A realtime success event must not be broadcast before the corresponding database transaction succeeds.

This rule is especially important for:

- concurrent Activity updates;
- Proposal Adoption;
- deletion of a linked Activity that reopens a Proposal.

---

# 15. Vertical Slice Boundary

A Vertical Slice may implement its own frontend components, backend logic, database access, and tests.

Every Vertical Slice must still follow the shared contracts for:

- domain vocabulary;
- architecture;
- authentication and authorization;
- database conventions;
- REST conventions;
- realtime conventions;
- shared types;
- environment/workflow;
- shared i18n-ready frontend rules.

Implementation details that do not affect another slice remain owned by the developer responsible for that slice.

---

# 16. Explicit Non-Goals for P0 Architecture

P0 does not introduce:

- microservices;
- Redis;
- message brokers;
- event sourcing;
- separate realtime infrastructure;
- direct frontend database access;
- offline-first collaborative synchronization;
- distributed caching;
- complex background-job architecture;
- full three-language translation coverage;
- a language switcher as a P0 requirement.

These may be considered only through future scope decisions.

---

# 17. Deferred Contracts

This Architecture Contract intentionally does not define:

- exact database tables and fields;
- PK/FK implementation;
- exact OWNER uniqueness mechanism;
- Proposal/Activity relation implementation;
- authentication token/cookie details;
- complete REST endpoints;
- REST request/response schemas;
- Socket.IO event names and payloads;
- Activity OCC implementation;
- Proposal Adoption transaction implementation;
- shared DTO implementation;
- frontend state-management library;
- exact i18n library choice.

These decisions belong to later contracts or the relevant shared implementation issue.

---

# Review Checklist

Before freezing this document, the team should confirm:

- [ ] React + TypeScript + Vite remains the frontend baseline.
- [ ] NestJS + TypeScript remains the backend baseline.
- [ ] PostgreSQL + Prisma is accepted for persistence.
- [ ] Socket.IO runs inside the NestJS backend.
- [ ] REST is the primary command/query interface.
- [ ] Socket.IO is synchronization, not a second write system.
- [ ] Backend/database persisted state is the source of truth.
- [ ] `/api` is the global REST prefix.
- [ ] Trip base information has no P0 edit command.
- [ ] Backend owns Membership Role authorization.
- [ ] Proposal Adoption is validated and persisted before broadcast.
- [ ] Activity updates broadcast recent-editor information.
- [ ] P0 frontend uses a shared i18n-ready translation-key mechanism.
- [ ] P0 Docker architecture uses `frontend + backend + postgres`.
- [ ] The current localhost Vite proxy is transitional.
