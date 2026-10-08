# P0 Architecture Contract

Status: Draft  
Scope: P0  
Owner: Tech Lead  
Depends on: Frozen P0 Scope, Frozen P0 Business Rules, `00-DOMAIN_VOCABULARY.md`

## Purpose

This document defines the shared high-level architecture for P0.

It specifies the major system components, their responsibilities, the communication paths between them, and the architectural rules that all Vertical Slices must follow.

Detailed database schemas, API endpoints, authorization rules, DTOs, and realtime event payloads are defined in later contracts.

---

# 1. Repository Structure

The project uses a monorepo.

The main structure is:

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
- Node.js baseline: version defined by the root `.nvmrc`

The current bootstrap uses Node.js `24.21.0`.

Technology changes that affect multiple Vertical Slices require shared review before adoption.

---

# 3. High-Level System Architecture

The P0 system follows this structure:

```text
Browser
   |
   v
React Frontend
   |
   | REST
   | WebSocket / Socket.IO
   v
NestJS Backend
   |
   | Prisma
   v
PostgreSQL
```

The NestJS backend is the central authority between the frontend and the database.

The frontend must not access PostgreSQL or Prisma directly.

---

# 4. Component Responsibilities

## 4.1 Frontend

The frontend is responsible for:

- rendering the user interface;
- collecting user input;
- calling backend REST APIs;
- receiving realtime updates;
- displaying loading, success, and error states;
- keeping local UI state synchronized with backend state.

The frontend must not be treated as a security boundary.

Hiding or disabling a button does not replace backend authorization.

---

## 4.2 Backend

The backend is responsible for:

- authentication;
- authorization;
- business-rule enforcement;
- input validation;
- database access;
- REST APIs;
- realtime broadcasting;
- conflict handling;
- returning consistent errors to clients.

All operations that modify protected Trip data must be validated by the backend.

---

## 4.3 Database

PostgreSQL stores the persistent P0 application state.

Prisma is the ORM used by the NestJS backend to access PostgreSQL.

The frontend never accesses the database directly.

Detailed entities, constraints, relations, deletion behaviour, and migrations are defined in the Domain Model and Database Contract.

---

# 5. Source of Truth

The persisted backend/database state is the authoritative application state.

Frontend state and WebSocket events are not authoritative sources of truth.

A realtime event informs clients that a change has occurred, but the persisted backend state remains the final reference.

After reconnecting or recovering from an uncertain client state, the client must be able to obtain the latest authoritative state from the backend.

---

# 6. REST Responsibility

REST is the primary command and query interface between the frontend and backend.

P0 operations such as creating or modifying Trips, Invitations, Activities, Proposals, and Votes are performed through backend REST APIs unless a later contract explicitly defines otherwise.

All P0 REST endpoints use the global prefix:

```text
/api
```

Examples:

```text
/api/health
/api/trips
```

Individual controllers should define their resource path without repeating the global `api` prefix.

Detailed endpoint names, request bodies, response bodies, status codes, and error formats are defined in the REST API Contract.

---

# 7. Realtime Responsibility

Socket.IO is used for P0 realtime collaboration.

Realtime support runs inside the same NestJS backend application.

P0 does not introduce a separate realtime microservice.

The basic mutation flow is:

```text
User action
    ↓
REST request
    ↓
Backend validation
    ↓
Database update
    ↓
Realtime broadcast
    ↓
Other connected Trip members update their UI
```

For P0, realtime broadcasting is required for the collaborative changes defined by the P0 Business Rules, including:

- Activity creation;
- Activity update;
- Activity deletion;
- Proposal creation;
- Vote changes.

WebSocket events are used for realtime notification and synchronization.

They are not a second independent write path to the database.

Detailed room rules, event names, payloads, authentication, and reconnect behaviour are defined in the Realtime Contract.

---

# 8. Backend Module Boundary Principle

NestJS modules should be organized around business capabilities rather than creating one module for every database table.

Expected P0 business areas include:

- authentication;
- users;
- trips and membership;
- invitations;
- itinerary and activities;
- proposals and votes;
- realtime;
- shared/common infrastructure.

For example:

- `ItineraryDay` and `Activity` may belong to the same itinerary business area.
- `Proposal` and `Vote` may belong to the same proposal business area.

The exact folder structure may evolve, but different Vertical Slices must not create competing modules for the same business responsibility.

---

# 9. P0 Runtime Services

The target P0 Docker Compose architecture contains three primary services:

```text
frontend
backend
postgres
```

P0 does not require additional infrastructure such as:

- Redis;
- message queues;
- separate realtime servers;
- background worker services;
- microservices.

New infrastructure must have a concrete P0 requirement before being added.

---

# 10. Port Baseline

The current development baseline is:

```text
Frontend: 5173
Backend: 3000
PostgreSQL: 5432
```

Ports may be exposed differently by Docker or deployment configuration, but internal service configuration must remain consistent and documented.

---

# 11. API Routing and Proxy Boundary

The browser-facing REST path is `/api`.

The frontend should depend on the API path/configuration rather than treating a hard-coded localhost address as part of the application contract.

## Current implementation note

The current bootstrap Vite development proxy forwards:

```text
/api → http://127.0.0.1:3000
```

This is a temporary local-development implementation.

`127.0.0.1:3000` is not part of the frozen architecture contract.

When Docker Compose is introduced, backend routing must be updated to use a Docker-compatible service/environment configuration.

The `/api` browser-facing contract remains unchanged.

---

# 12. Input Validation Boundary

The backend must validate all external input.

Frontend validation may improve user experience but cannot replace backend validation.

The exact validation library, DTO structure, and validation rules are defined later in the REST API and Shared Types contracts.

---

# 13. Authentication and Authorization Boundary

Authentication and authorization are owned by the NestJS backend.

The frontend may use authentication state to control the UI, but the backend must independently verify access for protected operations.

The detailed authentication mechanism and Owner / Member authorization rules are defined in `03-AUTH_CONTRACT.md`.

---

# 14. Persistence and Realtime Boundary

A successful collaborative mutation follows this order:

```text
Validate
→ Persist
→ Broadcast
```

A realtime event must not be broadcast as a successful change before the corresponding persistent update succeeds.

If persistence fails, the system must not announce the change to other clients as completed.

---

# 15. Vertical Slice Boundary

A Vertical Slice may implement its own frontend components, backend logic, database access, and tests.

However, every Vertical Slice must follow the shared contracts for:

- domain vocabulary;
- architecture;
- authentication and authorization;
- database conventions;
- REST conventions;
- realtime conventions;
- shared types;
- environment and workflow.

Implementation details that do not affect other slices remain owned by the developer responsible for that slice.

---

# 16. Explicit Non-Goals for P0 Architecture

P0 does not introduce:

- microservices;
- Redis;
- message brokers;
- event sourcing;
- separate realtime infrastructure;
- direct frontend database access;
- offline-first synchronization;
- distributed caching;
- complex background job architecture.

These may only be considered later if a future product requirement justifies them.

---

# 17. Deferred Contracts

This Architecture Contract intentionally does not define:

- exact database tables and fields;
- primary and foreign keys;
- Prisma relations;
- authentication token/cookie details;
- complete REST endpoint lists;
- REST request and response schemas;
- WebSocket event names and payloads;
- Activity concurrency implementation;
- shared DTO implementation;
- frontend state-management libraries.

These decisions belong to the later shared contracts.

---

# Review Checklist

Before freezing this document, the team should confirm:

- [ ] Monorepo structure is accepted.
- [ ] React + TypeScript + Vite remains the frontend baseline.
- [ ] NestJS + TypeScript remains the backend baseline.
- [ ] PostgreSQL + Prisma is accepted for persistence.
- [ ] Socket.IO inside the NestJS backend is accepted for realtime.
- [ ] REST is the primary write/query interface.
- [ ] WebSocket is used for realtime notification, not as a separate write system.
- [ ] PostgreSQL/backend persisted state is the source of truth.
- [ ] `/api` is the global REST prefix.
- [ ] Frontend does not directly access the database.
- [ ] Backend owns validation, authentication, authorization, and business-rule enforcement.
- [ ] P0 Docker architecture uses `frontend + backend + postgres`.
- [ ] The current `127.0.0.1:3000` Vite proxy is understood as temporary.
- [ ] No unnecessary infrastructure has been introduced.
