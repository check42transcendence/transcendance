# P0 Environment & Workflow Contract

Status: Draft  
Scope: P0  
Owner: Tech Lead  
Product baseline: Frozen P0 Scope / PRD / Business Rules v2 — 2026-10-09  
Depends on: `01-ARCHITECTURE.md`, `03-AUTH_CONTRACT.md`, `04-DATABASE_CONTRACT.md`, `05-REST_API_CONTRACT.md`, `06-REALTIME_CONTRACT.md`, `07-SHARED_TYPES.md`

## Purpose

This document defines the shared P0 development environment, container/runtime baseline, repository workflow, CI expectations, migration workflow, contract-change process, and repository hygiene rules.

It exists to ensure that all Vertical Slices are built on the same technical baseline and can be integrated into `main` without each feature inventing its own environment or workflow.

---

# 1. P0 Technical Baseline

P0 uses:

```text
Frontend:   React + TypeScript + Vite
Backend:    NestJS + TypeScript
Database:   PostgreSQL + Prisma
Realtime:   Socket.IO
Runtime:    Node.js
Package manager: npm
Containers: Docker + Docker Compose
Gateway:    Nginx
```

Root Node version:

```text
v24.21.0
```

The root `.nvmrc` is the canonical Node.js development version.

Developers should run:

```bash
nvm install
nvm use
```

when using `nvm`.

---

# 2. Canonical Ports and Paths

Local development baseline:

```text
Frontend Vite: 5173
Backend NestJS: 3000
PostgreSQL:     5432
REST prefix:    /api
Socket.IO path: /socket.io
```

Containerized browser entry point:

```text
http://localhost:8080
```

or:

```text
http://localhost:${APP_PORT}
```

when `APP_PORT` is overridden.

Current health endpoint:

```http
GET /api/health
```

Expected response:

```json
{
  "status": "ok"
}
```

---

# 3. Docker Compose Service Names

Canonical Compose service names are:

```text
frontend
backend
postgres
```

Cross-container communication must use Compose DNS service names, not `localhost`.

Examples:

```text
backend → postgres:5432
frontend/Nginx → backend:3000
```

Inside the backend container, `localhost` refers to the backend container itself and must not be used to reach PostgreSQL.

---

# 4. Current Container Topology

## 4.1 PostgreSQL

The `postgres` service:

- runs PostgreSQL;
- stores data in the named volume `postgres_data`;
- uses a health check before dependent services start;
- does not require public host exposure of port `5432` in the P0 container baseline.

## 4.2 Backend

The `backend` service:

- listens internally on port `3000`;
- receives `DATABASE_URL` using the `postgres` service hostname;
- starts only after PostgreSQL is healthy;
- exposes a backend health check;
- runs the production runtime as a non-root user.

## 4.3 Frontend / Gateway

The `frontend` service:

- builds the React/Vite frontend;
- serves the production build through Nginx;
- proxies `/api/` to `backend:3000`;
- exposes the application to the host on loopback only by default:

```text
127.0.0.1:${APP_PORT:-8080}:80
```

P0 realtime implementation must later proxy `/socket.io/` to the backend with WebSocket upgrade support as defined in `06-REALTIME_CONTRACT.md`.

---

# 5. Local Development Topology

Without Docker, the current development baseline is:

```text
Frontend:
http://localhost:5173

Backend:
http://localhost:3000

Backend health:
http://localhost:3000/api/health
```

The Vite development proxy currently forwards:

```text
/api
→ http://127.0.0.1:3000
```

Frontend and backend development processes must therefore currently run on the same host unless the proxy configuration is intentionally changed.

This Vite proxy is development-only. Production/container traffic goes through Nginx.

When Socket.IO is implemented, local development must also provide a documented `/socket.io` routing strategy consistent with the Realtime Contract.

---

# 6. Environment Files

Real secrets and local environment files must never be committed.

Ignored:

```text
.env
.env.*
```

Allowed examples:

```text
.env.example
.env.*.example
```

Example files contain only safe placeholders/defaults.

Current container example variables:

```text
APP_PORT
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
```

A real local password must replace the example placeholder in `.env`.

---

# 7. Frontend Environment Variables

Any variable exposed by Vite is shipped to the browser and must be treated as public.

Frontend-exposed variables must never contain:

- passwords;
- database credentials;
- JWT signing secrets;
- private API keys;
- server-only secrets.

Variables exposed through mechanisms such as `VITE_*` must contain only browser-safe values.

---

# 8. Standard Container Commands

From repository root:

```bash
cp .env.example .env
docker compose up --build
```

Background mode:

```bash
docker compose up --build --detach
```

Check state:

```bash
docker compose ps
```

Logs:

```bash
docker compose logs --follow
```

Stop:

```bash
docker compose down
```

The PostgreSQL named volume remains after normal `down`.

To intentionally delete local database data:

```bash
docker compose down --volumes
```

This is destructive and must not be used casually.

---

# 9. Dependency Installation

Frontend and backend maintain their own:

```text
package.json
package-lock.json
```

Use:

```bash
npm ci
```

for reproducible CI/clean installs.

Do not commit:

```text
node_modules/
```

Dependency changes must commit the corresponding lockfile update.

---

# 10. Prisma Schema and Migration Workflow

Persistent P0 database schema changes use committed Prisma migrations.

Required workflow:

```text
update Prisma schema
→ create migration
→ inspect generated SQL
→ add reviewed raw SQL if required
→ test against clean PostgreSQL
→ commit Prisma schema + migration together
```

Use reviewed raw PostgreSQL migration SQL when Prisma cannot express a required database guarantee such as a partial or functional unique index.

Do not use:

```text
prisma db push
```

as the shared/main schema evolution strategy.

Do not:

- manually mutate the shared schema without a migration;
- rewrite already-shared migration history;
- edit an old merged migration to fix a new problem.

Create a new corrective migration instead.

---

# 11. Shared Types Workflow

P0 must have one authoritative shared definition for cross-layer types defined by `07-SHARED_TYPES.md`.

Frontend and backend must not independently maintain incompatible copies of:

```text
MembershipRole
InvitationStatus
VoteDecision
Activity DTOs
Proposal DTOs
API error codes
Realtime event payload types
```

The exact package/folder layout may be decided during implementation, but the result must provide one authoritative definition.

Runtime validation remains required even when static TypeScript types are shared.

---

# 12. P0 i18n-Ready Frontend Workflow

P0 must be structured so user-facing text can move through one shared translation-key mechanism.

Conceptual examples:

```text
t("trip.myTrips")
t("trip.create")
t("proposal.adopt")
```

P0 may ship with only the default language.

Future scope unless separately promoted:

- complete EN/FR/ZH translations;
- language switcher;
- locale persistence;
- advanced locale-specific formatting.

P0 requires architectural readiness, not full multilingual delivery.

---

# 13. Git Branch Model

`main` is the only long-lived development branch.

Normal work happens on short-lived branches.

Canonical prefixes:

```text
feat/
fix/
chore/
docs/
```

Examples:

```text
feat/trip-create
fix/activity-version-conflict
chore/prisma-bootstrap
docs/p0-rest-contract
```

Do not create replacement branches merely to manually copy old feature code around.

Keep the active branch synchronized with the current shared baseline using normal Git integration.

---

# 14. Main Branch Protection Policy

Team workflow requires:

```text
no direct feature push to main
PR required
at least 1 non-author approval
required CI must pass
Squash and merge preferred
```

A PR must not be merged merely because it compiles locally.

Shared-contract or business-rule conflicts must be resolved before merge.

---

# 15. Pull Request Scope

Each PR should be focused and reviewable.

Prefer separating infrastructure layers when independent.

Examples of intentionally separate work:

```text
containerization
Prisma integration
database schema/migrations
HTTPS
authentication
realtime
feature Vertical Slices
```

A PR should state:

- what it changes;
- what it intentionally does not change;
- how it was validated;
- relevant follow-up work.

Do not mix unrelated P1/P2 work into a P0 PR.

---

# 16. Definition of Done

A P0 task is not Done merely because code exists.

Minimum Definition of Done:

```text
implementation complete
+
basic tests / validation complete
+
business behaviour checked
+
PR opened
+
code review completed
+
required CI passing
+
merged into main
```

For Business Rule changes, acceptance must verify actual behaviour, not only code presence.

For example, an Adoption implementation is not Done merely because an `adopt()` function exists. Tests/review must verify the required majority and concurrency behaviour where applicable.

---

# 17. Current GitHub Actions CI

GitHub Actions runs on:

```text
pull_request → main
push → main
```

Current CI contains three jobs.

## 17.1 Frontend checks

```text
npm ci
npm run lint
npm run build
```

Working directory:

```text
frontend/
```

## 17.2 Backend checks

```text
npm ci
npm run lint
npm run build
npm test
npm run test:e2e
```

Working directory:

```text
backend/
```

## 17.3 Container checks

The container job depends on successful frontend/backend checks.

It validates:

```text
Docker Compose configuration
image builds
service startup
service health
frontend HTTP response
/api/health through Nginx
```

It uses `.env.example` for CI-safe configuration.

On failure, service logs are printed.

At the end it removes containers, volumes, and orphans created by the CI run.

---

# 18. CI Growth Rule

CI must grow as shared infrastructure and high-risk domain behaviour are implemented.

Future required coverage includes the relevant tests defined by:

```text
04-DATABASE_CONTRACT.md
05-REST_API_CONTRACT.md
06-REALTIME_CONTRACT.md
```

Examples:

- Prisma migration/schema validation;
- database constraint integration tests;
- Auth integration tests;
- Activity OCC conflict tests;
- Proposal majority/adoption race tests;
- Realtime room authorization;
- commit-before-broadcast behaviour;
- reconnect/resync behaviour where practical.

Do not add placeholder CI jobs that do not actually validate the intended behaviour.

---

# 19. Health Check Rule

Current P0 baseline:

```http
GET /api/health
```

must return:

```http
200 OK
```

with:

```json
{
  "status": "ok"
}
```

Health endpoints must remain lightweight and must not expose secrets or detailed internal configuration.

When database readiness becomes part of application readiness, the team must explicitly decide whether `/api/health` means process-only health or also database connectivity.

Do not silently change health-check semantics.

---

# 20. HTTPS Boundary

Current local/container baseline uses HTTP.

HTTPS is separate shared infrastructure work.

Do not mix HTTPS implementation into unrelated feature PRs.

When HTTPS is introduced, Auth cookie security settings and Nginx configuration must be reviewed together with `03-AUTH_CONTRACT.md`.

---

# 21. Realtime Infrastructure Boundary

Socket.IO is part of P0 architecture but is implemented separately from initial containerization.

Realtime implementation must:

```text
run inside NestJS backend
use authenticated identity
support /socket.io
update Nginx gateway
update local development routing
add realtime integration tests
```

Do not create a separate realtime domain-write path.

---

# 22. Contract Change Rule

Frozen shared contracts must not be silently changed inside feature implementation.

Required process:

```text
identify conflict
→ explain why current contract cannot support required behaviour
→ assess cross-slice impact
→ propose contract change
→ team review
→ update/freeze contract
→ implement
```

A feature PR must not silently redefine:

- canonical enum values;
- API paths;
- shared DTO fields;
- ownership semantics;
- majority rules;
- database invariants;
- realtime event names.

---

# 23. Product Scope Change Rule

Technical implementation must not silently expand P0 product scope.

Examples outside P0 include:

```text
Trip Chat
full Notifications Center
Friends
PWA/offline
Unscheduled Activity Pool
Activity Locking
Owner Transfer
Proposal Edit/Delete
Vote retract
Files
Budget
Maps
```

If a feature is promoted into P0, product scope/business rules must change before technical contracts and implementation.

---

# 24. Repository Hygiene

Never commit:

```text
real secrets
real .env files
node_modules/
dist/
coverage/
*.tsbuildinfo
*.log
.DS_Store
local PostgreSQL data directories
temporary generated files unrelated to source
```

Current `.gitignore` covers the main Node/build/env/log/macOS artifacts.

Generated artifacts required for the application or migrations are committed only when intentionally part of project source/history.

---

# 25. Security Baseline

P0 environment/workflow must preserve these boundaries:

```text
Frontend does not connect directly to PostgreSQL.
Database credentials remain server-side.
Secrets are not committed.
Secrets are not exposed through Vite client variables.
Backend authorization never trusts frontend roles.
Production backend container runs as non-root.
PostgreSQL does not require a public host port in the container baseline.
```

---

# 26. Local Database Development Decision

The current container baseline keeps PostgreSQL internal to the Compose network.

When Prisma/database-backed local development is introduced, the team must document one supported development path.

Possible choices:

```text
A. full Compose for DB-backed development

or

B. backend on host + PostgreSQL container exposed on localhost only
```

Do not introduce an unrestricted public PostgreSQL port.

This decision belongs to Prisma/database integration work and does not block the current container baseline.

---

# 27. Documentation Sync Rule

When shared developer commands, ports, service names, or workflow requirements change, update relevant documentation in the same PR.

At minimum, keep consistent:

```text
README
.env.example
compose.yml
CI workflow
shared contracts
```

Documentation must not advertise P1/P2 functionality as current P0 core behaviour.

---

# 28. Review Expectations by Change Type

Infrastructure review:

```text
startup
health
networking
secrets
container behaviour
CI
```

Database review:

```text
schema
constraints
migration safety
transactions
concurrency
```

REST review:

```text
authorization
validation
status/error codes
DTO compatibility
```

Realtime review:

```text
room authorization
commit-before-broadcast
idempotency
reconnect/resync
```

Feature Vertical Slice review:

```text
end-to-end business behaviour
frontend/backend/database integration
tests
contract compliance
```

---

# 29. Transitional / Not-Yet-Implemented Items

Current baseline already has or has accepted infrastructure for:

```text
React/Vite frontend
NestJS backend
/api health route
frontend/backend CI
Docker Compose
Nginx frontend gateway
PostgreSQL container
container CI
```

Separate later work includes:

```text
Prisma integration
final P0 migrations/schema implementation
Auth implementation
Socket.IO implementation
/socket.io gateway support
HTTPS
shared-types physical package
P0 i18n-ready implementation
domain feature Vertical Slices
```

The presence of a contract does not mean the corresponding feature is already implemented.

---

# 30. Review Checklist

Before freezing this Environment & Workflow Contract, confirm:

- [ ] Node baseline remains `v24.21.0`.
- [ ] npm remains the package manager.
- [ ] local frontend/backend ports remain `5173 / 3000`.
- [ ] Compose services are exactly `frontend / backend / postgres`.
- [ ] browser container entry remains localhost `${APP_PORT:-8080}`.
- [ ] `/api` remains the REST prefix.
- [ ] `/socket.io` is reserved for P0 realtime.
- [ ] real `.env` files and secrets remain uncommitted.
- [ ] Vite-exposed variables contain no secrets.
- [ ] Prisma uses committed migrations rather than shared `db push`.
- [ ] one authoritative shared-type source is required.
- [ ] P0 frontend remains i18n-ready without requiring full multilingual delivery.
- [ ] `main` remains protected by team workflow.
- [ ] PR + non-author review + passing CI remain required.
- [ ] Squash merge remains the preferred merge method.
- [ ] branch prefixes remain `feat/ fix/ chore/ docs/`.
- [ ] Definition of Done includes behaviour validation, review, CI, and merge.
- [ ] current CI has frontend/backend/container checks.
- [ ] CI expands with Prisma/Auth/Realtime/domain-risk features.
- [ ] HTTPS remains separate shared infrastructure work.
- [ ] realtime adds `/socket.io` routing without becoming a second write API.
- [ ] shared contracts cannot be silently changed in feature PRs.
- [ ] P1/P2 features cannot silently enter P0 implementation.
- [ ] README/env/Compose/CI/contracts remain synchronized when shared infrastructure changes.
