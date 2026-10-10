# P0 Environment & Workflow Contract

Status: Draft  
Scope: P0  
Owner: Tech Lead  
Depends on: `01-ARCHITECTURE.md`, `03-AUTH_CONTRACT.md`

## 1. Baseline

- React + TypeScript + Vite frontend
- NestJS + TypeScript backend
- PostgreSQL + Prisma
- Socket.IO
- npm
- root `.nvmrc`
- frontend `5173`
- backend `3000`
- PostgreSQL `5432`
- global `/api`

Current Node.js baseline:

```text
v24.21.0
```

Current health endpoint:

```text
GET /api/health
→ 200
→ { "status": "ok" }
```

## 2. Target Docker Compose Services

```text
frontend
backend
postgres
```

Cross-container communication uses service names, not localhost.

## 3. Environment Files

Real `.env` files and secrets are never committed.

Example env files contain only safe placeholders/defaults.

Frontend-exposed Vite vars must not contain secrets.

## 4. Prisma Workflow

Persistent schema changes use committed Prisma migrations.

Do not use shared/main `prisma db push` as the migration strategy.

Do not rewrite already-shared migration history.

## 5. Git Workflow

- `main` protected
- no direct feature push
- PR required
- at least one non-author approval
- required CI passes
- preferred merge: Squash and merge
- short-lived `feat/`, `fix/`, `chore/`, `docs/` branches

## 6. Current CI

Frontend:

```text
npm ci
npm run lint
npm run build
```

Backend:

```text
npm ci
npm run lint
npm run build
npm test
npm run test:e2e
```

CI grows with Docker, Prisma, Auth, Realtime, and domain-risk features.

## 7. Adoption Test Baseline

When Proposal Adoption is implemented, automated tests should cover:

- strict-majority boundary;
- `is_adopted` changes from false to true only after successful Adoption;
- Adopted Proposal rejects Vote changes;
- concurrent Adoption cannot create duplicate Proposal-sourced Activities;
- deleting the adopted Activity resets `is_adopted` to false;
- re-Adoption recomputes current majority.

## 8. P0 i18n-ready Frontend Workflow

P0 uses one shared translation-key mechanism for user-facing text.

Example:

```text
t("trip.myTrips")
t("trip.create")
```

P0 may ship only the default language.

Complete EN/FR/ZH coverage and a Language Switcher remain future scope.

## 9. Contract Change Rule

Frozen contracts cannot be silently changed inside feature implementation.

Required flow:

```text
identify conflict
→ propose contract change
→ review cross-slice impact
→ update/freeze contract
→ implement
```

## 10. Repository Hygiene

Do not commit:

- secrets;
- real `.env`;
- `node_modules/`;
- `dist/`;
- coverage;
- local logs;
- `.DS_Store`;
- local PostgreSQL data directories.

## 11. Transitional Items

- bootstrap and initial CI already exist;
- Docker Compose + PostgreSQL + env are separate infra work;
- Prisma integration is separate from final business schema;
- HTTPS is separate;
- current Vite proxy to `127.0.0.1:3000` is transitional;
- Auth, Socket.IO, final Prisma schema, and i18n-ready implementation are later shared work.
