# P0 Environment & Workflow Contract

Status: Frozen  
Scope: P0  
Owner: Tech Lead  
Depends on: `01-ARCHITECTURE.md`, `03-AUTH_CONTRACT.md`, `04-DATABASE_CONTRACT.md`, `05-REST_API_CONTRACT.md`, `06-REALTIME_CONTRACT.md`, `07-SHARED_TYPES.md`

## Purpose

Defines the shared P0 development environment, containers, Git workflow, CI, migration workflow, contract-change rules, and repository hygiene.

All P0 Contracts in this set are Frozen. Any future change requires the Contract Change Rule below.

## 1. Technical Baseline

```text
Frontend: React + TypeScript + Vite
Backend: NestJS + TypeScript
Database: PostgreSQL + Prisma
Realtime: Socket.IO
Runtime: Node.js
Package manager: npm
Containers: Docker + Docker Compose
Gateway: Nginx
```

Canonical Node version:

```text
v24.21.0
```

Root `.nvmrc` is authoritative.

## 2. Ports / Paths

```text
Vite frontend: 5173
NestJS backend: 3000
PostgreSQL internal: 5432
Container HTTP redirect port: APP_PORT, default 8080
Container HTTPS browser port: 8443
REST: /api
Socket.IO: /socket.io
```

## 3. Compose Services

The application baseline in `compose.yml` has three long-running services:

```text
frontend
backend
postgres
```

Normal Compose also defines a one-shot `migration` service. It runs
`prisma:migrate:deploy` against `DATABASE_URL` after PostgreSQL is healthy;
the backend starts only after migration succeeds.

The isolated browser-test stack in `compose.e2e.yml` defines its own `migration`
service using `test:db:prepare`, plus the `e2e` runner. Test database preparation
remains separate from normal application migrations.

Cross-container communication uses service DNS names, not `localhost`.

Current container topology:

```text
Browser
→ HTTPS localhost:8443
→ frontend/Nginx
→ backend:3000
→ postgres:5432
```

HTTP on `APP_PORT` (default `8080`) redirects to `https://localhost:8443`.

PostgreSQL uses named volume:

```text
postgres_data
```

PostgreSQL need not expose a public host port in the baseline.

## 4. Local Development

Current host development:

```text
frontend: http://localhost:5173
backend:  http://localhost:3000
```

Vite development `/api` proxy targets `127.0.0.1:3000`.

Database-backed host development requires a reachable PostgreSQL instance and:

```text
DATABASE_URL
```

After pulling Prisma schema changes, or after changing `prisma/schema.prisma`, run:

```bash
cd backend
npm run prisma:validate
npm run prisma:generate
```

Before starting the backend outside Compose, provide a `DATABASE_URL` reachable from the host environment.

Do not expose PostgreSQL on unrestricted public interfaces.

## 5. Environment Files

Never commit real secrets or real `.env`.

Allowed example files:

```text
.env.example
.env.*.example
```

Frontend-exposed `VITE_*` values are public and must contain no secret.

## 6. Standard Container Commands

Create the local environment file and local TLS certificate before starting the containerized stack:

```bash
cp .env.example .env
sh scripts/generate-local-cert.sh
docker compose up --build
docker compose ps
docker compose logs --follow
docker compose down
```

The certificate script generates developer-local files under:

```text
certs/
```

The generated certificate and private key are not repository assets and must not be committed.

Intentional local DB destruction only:

```bash
docker compose down --volumes
```

## 7. Dependency Workflow

Frontend/backend maintain their own:

```text
package.json
package-lock.json
```

Use `npm ci` for clean/reproducible installs.

Commit lockfile changes with dependency changes.

Do not commit `node_modules`.

## 8. Prisma Migration Workflow

```text
edit schema
→ create migration
→ inspect SQL
→ add reviewed raw SQL if needed
→ test clean PostgreSQL
→ commit schema + migration
```

Do not use `prisma db push` as shared/main schema history.

Do not rewrite merged migration history.

## 9. Shared Types Workflow

One authoritative shared definition is required for cross-layer types.

Do not maintain divergent frontend/backend enum/DTO copies.

Runtime validation remains a backend responsibility.

## 10. i18n-Ready Workflow

User-facing text should be structured through shared translation keys.

P0 may ship one default language.

Complete EN/FR/ZH and a language switcher remain future scope.

## 11. Git Branch Model

Only long-lived development branch:

```text
main
```

Short-lived prefixes:

```text
feat/
fix/
chore/
docs/
```

Do not create replacement branches merely to manually copy old code.

Synchronize the active branch with current main using normal Git integration.

## 12. Main Protection / PR Workflow

Team baseline:

```text
no direct feature push to main
PR required
at least 1 non-author approval
required CI must pass
Squash and merge preferred
```

Contract/business-rule conflicts must be resolved before merge.

## 13. PR Scope

Keep PRs focused and reviewable.

Separate independent infrastructure work such as:

```text
containerization
Prisma/schema
Auth
HTTPS
Realtime
feature Vertical Slices
```

PR description should state:

```text
what changes
what does not change
how validated
follow-up work
```

## 14. Definition of Done

A task is Done only when:

```text
implementation complete
tests/validation complete
business behaviour checked
PR reviewed
required CI passing
merged to main
```

Code existing on a feature branch is not Done.

## 15. Current CI

The GitHub Actions workflow is defined in `.github/workflows/ci.yml` and runs on:

```text
pull_request → main
push → main
```

### Frontend checks

Run from `frontend/`:

```text
npm ci
npm run lint
npm run build
npm test
```

### Backend checks

Run from `backend/` with a dedicated PostgreSQL test service and CI-only database credentials:

```text
npm ci
npm run prisma:validate
npm run prisma:generate
npm run test:db:prepare
npm run test:db
npm run lint
npm run build
npm test
npm run test:e2e
```

`test:db:prepare` prepares the isolated test database and applies committed Prisma migrations. `test:db` runs PostgreSQL-backed integration tests. `test:e2e` runs backend HTTP E2E tests; it is separate from browser E2E testing.

### Container checks

Validate:

```text
temporary local TLS certificate generation
Compose config
image builds
startup/health
HTTP → HTTPS redirect
frontend over HTTPS with certificate verification
/api/health through the HTTPS Nginx gateway with certificate verification
```

The Container checks job runs after successful Frontend and Backend checks.

### Browser E2E checks

A separate GitHub Actions job runs Playwright tests against the real frontend, backend, and PostgreSQL using:

```text
compose.e2e.yml
.env.e2e.example
e2e/
```

The isolated test stack starts PostgreSQL, runs migrations through its `migration` service, starts the backend and HTTPS frontend, and then executes the Playwright Chromium test runner. The current browser E2E coverage includes the Auth registration, login, session restoration, logout, and protected-route redirect flow.

On failure, CI uploads browser test failure records. The test containers and their database volume are cleaned up after the job.

The Browser E2E checks job, like Container checks, depends on successful Frontend and Backend checks. The isolated browser-test stack does not replace or add services to the application baseline in `compose.yml`.

## 16. CI Growth

As features land, CI must add meaningful tests for:

```text
Prisma migrations/constraints
Auth
Activity OCC
Proposal majority/adoption concurrency
Realtime room authorization
commit-before-broadcast
```

Do not add placeholder jobs that validate nothing.

## 17. Health Check

Current:

```text
GET /api/health
→ 200
→ {"status":"ok"}
```

Frozen semantics: this is a lightweight backend process/application health check, not a promise of deep dependency diagnostics.

Do not expose secrets/configuration.

## 18. HTTPS

The current containerized local baseline uses HTTPS through Nginx.

```text
HTTP localhost:APP_PORT (default 8080)
→ 308 redirect
→ HTTPS localhost:8443
→ Nginx TLS termination
```

Local TLS uses a developer-generated self-signed certificate created by:

```bash
sh scripts/generate-local-cert.sh
```

Generated files are stored under:

```text
certs/localhost.crt
certs/localhost.key
```

They are developer-local, ignored by Git, and mounted read-only into Nginx.

The local Nginx baseline permits:

```text
TLSv1.2
TLSv1.3
```

Public deployment and publicly trusted certificate management are outside the current local infrastructure baseline.

Authentication implementation must respect the HTTPS cookie rules defined in `03-AUTH_CONTRACT.md`.

## 19. Realtime Infrastructure

Realtime implementation must:

```text
run inside NestJS
use authenticated identity
support /socket.io
update Nginx proxy
document local dev routing
add integration tests
```

No second realtime write API.

## 20. Contract Change Rule

Frozen contracts may not be silently changed inside feature implementation.

Required flow:

```text
identify conflict
→ assess cross-slice impact
→ propose contract change
→ team review
→ update/freeze contract
→ implement
```

A feature PR must not silently redefine enum values, API paths, DTOs, ownership, vote math, DB invariants, or event names.

## 21. Product Scope Rule

Implementation must not silently add P1/P2 functionality.

Outside P0 includes:

```text
Trip Chat
Notification Center
Friends
PWA/offline
Unscheduled Activity Pool
Activity Locking
Owner Transfer
Proposal Edit/Delete
Vote retract
automatic Proposal rejection
Proposal REJECTED status/lifecycle
Rejected archive
Revise & Fork
Files
Budget
Maps
```

## 22. Repository Hygiene

Never commit:

```text
real secrets
real .env
node_modules/
dist/
coverage/
*.tsbuildinfo
*.log
.DS_Store
/certs/
local TLS certificates or private keys
local PostgreSQL data
unrelated temporary generated files
```

## 23. Documentation Sync

When shared commands, ports, service names, env variables, APIs, or workflow rules change, update relevant sources in the same PR:

```text
README
.env.example
compose.yml
CI
contracts
```
