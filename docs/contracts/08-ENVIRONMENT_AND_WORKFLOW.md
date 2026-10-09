# P0 Environment & Workflow Contract

Status: Draft  
Scope: P0  
Owner: Tech Lead  
Depends on: `01-ARCHITECTURE.md`, `03-AUTH_CONTRACT.md`  
Implementation references: current project bootstrap and CI on `chore/project-bootstrap`

## Purpose

This document defines the shared development environment, runtime conventions, repository workflow, CI expectations, environment-variable rules, Docker/Prisma workflow, and contract-change process for P0.

Its goal is to make sure every team member can develop a Vertical Slice against the same environment and can integrate work without creating incompatible local assumptions.

This contract defines shared rules and target behaviour. It does not require every target item to already be implemented at the time this Draft is written.

---

# 1. Current Bootstrap Baseline

The current project bootstrap already provides:

- a monorepo with `frontend/` and `backend/`;
- React + TypeScript + Vite frontend;
- NestJS + TypeScript backend;
- Node.js version pinned by root `.nvmrc`;
- frontend development server on port `5173`;
- backend server on port `3000`;
- global backend REST prefix `/api`;
- `GET /api/health`;
- frontend-to-backend development proxy;
- frontend and backend CI jobs;
- frontend lint + build checks;
- backend lint + build + unit test + e2e test checks.

The current Node.js version is:

```text
v24.21.0
```

The current health-check contract is:

```text
GET /api/health
→ 200
→ { "status": "ok" }
```

The current bootstrap proxy:

```text
/api → http://127.0.0.1:3000
```

is a temporary non-Docker local-development implementation.

---

# 2. Target P0 Runtime

The target P0 runtime uses Docker Compose with three primary services:

```text
frontend
backend
postgres
```

The intended high-level runtime is:

```text
Browser
   |
   v
frontend
   |
   | /api
   v
backend
   |
   | Prisma
   v
postgres
```

No additional P0 infrastructure such as Redis, message queues, or separate realtime services may be added without a concrete requirement and team review.

---

# 3. Canonical Service Names

When services communicate inside Docker Compose, they must use Docker service discovery rather than `localhost` or `127.0.0.1`.

Canonical Compose service names are:

```text
frontend
backend
postgres
```

Examples:

```text
frontend container → backend:3000
backend container  → postgres:5432
```

Inside a container, `localhost` refers to that same container and must not be used to address another Compose service.

The current Vite proxy target `127.0.0.1:3000` must therefore be replaced when the Docker Compose PR is introduced.

---

# 4. Port Baseline

The development baseline is:

```text
Frontend:   5173
Backend:    3000
PostgreSQL: 5432
```

These are canonical application/service ports.

Docker may map host ports differently when required, but any non-default mapping must be documented.

The backend port may be supplied through environment configuration and defaults to `3000` when no override is provided.

---

# 5. Node.js and Package Manager

The repository uses the Node.js version defined by the root `.nvmrc`.

All team members and CI must use that version unless the team explicitly updates `.nvmrc`.

The package manager is:

```text
npm
```

Do not mix npm with Yarn, pnpm, or another package manager inside P0 without a shared decision.

`package-lock.json` files are committed and are part of reproducible dependency installation.

CI uses:

```text
npm ci
```

rather than `npm install`.

When adding or removing dependencies, the corresponding `package.json` and `package-lock.json` must be updated together.

---

# 6. Local Development Modes

P0 supports two shared development modes.

## 6.1 Direct local development

Before or outside Docker, frontend and backend may be run directly on the host.

Backend:

```bash
cd backend
npm ci
npm run start:dev
```

Frontend:

```bash
cd frontend
npm ci
npm run dev
```

The current Vite development proxy may target the locally running backend.

## 6.2 Docker Compose development

Once Docker Compose is available, the repository must support a documented root-level command that starts the required P0 services together.

The target command is:

```bash
docker compose up --build
```

A clean checkout with the documented environment setup must be able to start the application without undocumented manual configuration.

The exact Dockerfiles and Compose implementation belong to the infrastructure PR.

---

# 7. Environment Files

Real environment files must not be committed.

The repository ignores:

```text
.env
.env.*
```

while allowing example files such as:

```text
.env.example
.env.*.example
```

Every environment variable required for normal development must be documented in an example environment file with a safe placeholder or non-secret development default.

Example files must never contain real:

- passwords;
- JWT secrets;
- API keys;
- production credentials;
- private certificates or private keys.

A new required environment variable is not considered complete until its example/documentation is updated.

---

# 8. Environment Variable Ownership

Environment variables should be owned by the service that consumes them.

Expected backend/runtime configuration includes categories such as:

- backend port;
- database connection;
- JWT signing secret;
- JWT expiration;
- allowed frontend origin where required.

Expected PostgreSQL configuration includes:

- database name;
- database user;
- database password.

The exact final variable names are frozen when the corresponding Docker/Auth/Database work is reviewed.

Frontend variables exposed through Vite must never contain secrets because browser-exposed frontend configuration is readable by users.

---

# 9. Database Connectivity

The backend is the only application service that communicates with PostgreSQL.

The frontend must never connect directly to PostgreSQL.

Inside Docker Compose, the backend must connect to PostgreSQL using the Compose service name:

```text
postgres
```

not:

```text
localhost
127.0.0.1
```

Database credentials and connection URLs must come from environment configuration.

---

# 10. Prisma Integration

Prisma is the P0 ORM and is integrated into the backend.

Prisma infrastructure may be introduced before the final P0 schema is complete.

However:

- Prisma integration must not invent business entities independently of the Domain and Database Contracts;
- the shared Prisma schema must follow the frozen Domain/Database decisions;
- schema changes affecting multiple Vertical Slices require TL/shared-contract review.

The Prisma integration PR and the final P0 Prisma schema are therefore separate concerns.

---

# 11. Prisma Migration Workflow

Persistent schema changes must be represented by committed Prisma migrations.

The expected workflow is:

```text
update Prisma schema
        ↓
create migration in development
        ↓
review generated migration
        ↓
commit schema + migration together
        ↓
CI validates the schema/migration path
```

General rules:

- do not use `prisma db push` as the shared/main migration strategy;
- do not manually change a production/shared database without a committed migration;
- do not silently rewrite migration history after a migration has been merged and used by others;
- if a merged migration needs correction, prefer a new corrective migration;
- schema changes that alter shared contracts must update or reference the relevant contract decision.

The exact npm scripts may be added by the Prisma integration PR.

---

# 12. Database Reset Safety

A command such as:

```bash
docker compose down -v
```

deletes local Docker volumes and may erase the local PostgreSQL data.

It may be used for an intentional clean local reset, but it must not be treated as a normal restart command.

Normal restart and destructive reset must be clearly distinguished in project documentation.

No workflow may depend on developers repeatedly deleting persistent data to make migrations work.

---

# 13. HTTPS

HTTPS is part of the target deployed application environment and may be implemented in a dedicated infrastructure PR.

The HTTPS PR must document:

- where TLS terminates;
- how frontend and backend traffic are routed;
- how local/development certificates are handled if needed;
- which ports are exposed;
- how authentication cookies behave under HTTPS.

Private keys and real production secrets must not be committed to Git.

The exact TLS implementation is not frozen by this document before the dedicated HTTPS design is reviewed.

---

# 14. Git Branching Model

The repository uses a simplified GitHub Flow.

`main` is the only long-lived integration branch.

Work must be done in short-lived branches created from an up-to-date `main`.

Preferred branch naming:

```text
feat/<feature>
fix/<description>
chore/<description>
docs/<description>
```

Examples:

```text
feat/activity-crud
fix/invitation-duplicate-check
chore/docker-compose
docs/p0-technical-contracts
```

Do not create permanent frontend/backend developer branches.

---

# 15. Main Branch Protection

`main` is protected.

P0 team workflow requires:

- no direct feature pushes to `main`;
- changes enter `main` through Pull Requests;
- at least one non-author reviewer approves before merge;
- required CI checks pass before merge;
- unresolved blocking review comments are resolved before merge.

Force-pushing to `main` is not allowed.

Shared branches should also avoid history rewriting once other team members are depending on them.

---

# 16. Pull Request Rules

A PR should represent one coherent change.

Before requesting review, the author should:

- update their branch from current `main`;
- run the relevant local checks;
- confirm the feature starts/runs as documented;
- describe what changed;
- identify any shared-contract impact;
- identify known limitations or follow-up work.

A Draft PR may be used for early visibility.

When the work is ready for formal review, it should be marked:

```text
Ready for review
```

A PR is not Done merely because coding is complete.

Done means:

```text
implementation complete
+ relevant tests/checks pass
+ review complete
+ CI passes
+ merged
```

---

# 17. Merge Strategy

The preferred merge strategy is:

```text
Squash and merge
```

This keeps `main` readable while allowing developers to use small working commits inside their feature branches.

After merge, the short-lived branch should normally be deleted.

A merged PR must not leave the repository in a state where the documented main startup path is broken.

---

# 18. Current CI Baseline

CI currently runs on:

```text
pull_request → main
push → main
```

Current frontend checks:

```text
npm ci
npm run lint
npm run build
```

Current backend checks:

```text
npm ci
npm run lint
npm run build
npm test
npm run test:e2e
```

The backend e2e baseline includes:

```text
GET /api/health
```

and verifies:

```text
200
{ "status": "ok" }
```

CI uses the Node.js version from root `.nvmrc`.

---

# 19. CI Must Grow With Infrastructure

CI is incremental.

When shared infrastructure is added, the same PR or an explicitly linked follow-up must add the checks needed to protect it.

Expected future CI evolution includes, where applicable:

## Docker

- Docker build succeeds;
- Compose configuration is valid;
- documented services can start in a clean environment.

## PostgreSQL / Prisma

- Prisma schema validates;
- migrations can be applied to a clean test database;
- database-backed e2e tests can run when introduced.

## Auth

- authentication/authorization tests cover protected behaviour;
- secrets used in CI come from safe test configuration, not committed credentials.

## Realtime

- relevant backend tests cover authenticated room/event behaviour when implemented.

CI should verify meaningful shared guarantees rather than adding checks only for quantity.

---

# 20. Formatting and Linting

The current frontend uses ESLint.

The current backend uses Oxlint and Prettier.

Different tools between frontend and backend are acceptable.

The contract requirement is that each application has a documented and repeatable lint/build process and that CI runs the agreed checks.

A developer must not replace the shared lint/format toolchain for their Vertical Slice without team agreement.

---

# 21. Testing Responsibility

Each Vertical Slice owner is responsible for the tests needed to demonstrate that their feature works across its affected layers.

Tests may include:

- frontend/component tests where useful;
- backend unit tests;
- backend e2e tests;
- database integration tests;
- authorization tests;
- realtime integration tests.

Not every feature needs every test type.

The required tests should follow the feature's real risk and acceptance criteria.

Shared behaviour such as Auth, database constraints, and cross-Trip authorization should not rely only on manual browser testing.

---

# 22. Shared Contract Change Rule

Frozen shared contracts are part of the integration boundary.

A feature PR must not silently change:

- domain meaning;
- architecture boundaries;
- Auth behaviour;
- database invariants;
- shared REST conventions;
- realtime conventions;
- shared types;
- environment/workflow assumptions.

If implementation reveals that a Frozen Contract must change:

```text
identify contract conflict
        ↓
propose contract change
        ↓
review impact on other slices
        ↓
update/freeze contract
        ↓
implement against the new rule
```

For a small compatible change, the contract update may be included in the same PR when the impact is clearly documented and reviewed.

---

# 23. Dependency Changes

Before adding a new dependency, the developer should confirm that it has a concrete use in the current feature.

A dependency that affects shared architecture or multiple slices requires team/TL review.

Do not add overlapping libraries for the same shared responsibility without a reason.

Examples include introducing:

- another ORM beside Prisma;
- another realtime stack beside Socket.IO;
- another global validation approach;
- another authentication mechanism;
- another package manager.

Dependency versions must be captured in `package.json` and `package-lock.json`.

---

# 24. Repository Hygiene

Do not commit:

- `.env` files containing real configuration;
- secrets;
- generated `node_modules/`;
- build output such as `dist/`;
- coverage output;
- local logs;
- OS-specific files such as `.DS_Store`;
- local PostgreSQL data directories.

Generated files required for reproducible builds or migrations may be committed when they are explicitly part of the agreed toolchain.

---

# 25. Documentation Responsibility

Shared setup changes must update the relevant documentation.

Examples:

- new environment variable → update example env/documentation;
- new startup command → update README or environment documentation;
- new infrastructure service → document how to start and verify it;
- new migration requirement → document the migration command;
- changed API/realtime shared rule → update the corresponding Contract.

A setup change is not complete if only the author knows how to use it.

---

# 26. P0 Workflow Non-Goals

P0 does not require:

- Kubernetes;
- multiple deployment environments with complex promotion pipelines;
- microservice deployment;
- monorepo orchestration frameworks solely for build convenience;
- multiple package managers;
- automatic production deployment from every merge;
- complex release branching;
- permanent per-developer integration branches.

These may be reconsidered only if a later requirement justifies them.

---

# 27. Known Transitional Items

At the time this Draft is written:

1. frontend/backend bootstrap and the first CI baseline are complete;
2. NestJS already uses the global `/api` prefix;
3. `/api/health` is covered by backend e2e testing;
4. Docker Compose + PostgreSQL + environment configuration are planned as a separate PR;
5. Prisma integration is planned as a separate PR;
6. HTTPS is planned as a separate PR;
7. the Vite proxy still targets `127.0.0.1:3000` and must change as part of Docker work;
8. Auth, Socket.IO, and the final Prisma domain schema are not part of the bootstrap phase.

These are implementation-status notes, not alternative architecture rules.

---

# Review Checklist

Before freezing this document, the team should confirm:

- [ ] Root `.nvmrc` is the canonical Node.js version source.
- [ ] npm is the shared package manager.
- [ ] `package-lock.json` is committed and CI uses `npm ci`.
- [ ] Target Compose services are `frontend`, `backend`, and `postgres`.
- [ ] Containers use service names rather than localhost for cross-container communication.
- [ ] Frontend remains on port 5173 and backend on port 3000 as the development baseline.
- [ ] Real `.env` files and secrets are never committed.
- [ ] Required env variables are represented in safe example files.
- [ ] Prisma schema changes use committed migrations rather than shared `db push`.
- [ ] Destructive volume reset is not treated as a normal restart.
- [ ] `main` is protected and receives work through reviewed PRs.
- [ ] At least one non-author approval and passing required CI are needed before merge.
- [ ] Squash merge is the preferred merge strategy.
- [ ] CI expands when Docker, PostgreSQL/Prisma, Auth, and Realtime are introduced.
- [ ] Vertical Slice owners are responsible for relevant end-to-end verification.
- [ ] Frozen Contract changes cannot be hidden inside unrelated feature implementation.
- [ ] The current `127.0.0.1:3000` proxy is transitional and will be replaced during Docker work.
