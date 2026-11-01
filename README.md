*This project has been created as part of the 42 curriculum by yihe, yuczhang, yzhang2, and zhma.*

# Travel Planner

## Description

A collaborative travel planning platform for small groups who have
already decided to travel together.

The planned core features include trip workspaces, shared itineraries,
proposals, voting, and real-time collaboration.

## Current Status

Currently implemented:

- React/TypeScript frontend with Vite, Auth pages, and protected routing.
- Home Trip list and creation form connected to the backend, with loading,
  validation, and request-error feedback.
- Trip Workspace with read-only details, membership role, generated Days, and
  Owner-only deletion with confirmation and error feedback.
- Shared UI tokens and reusable form controls, cards, modals, tabs, and notifications using
  Tailwind CSS v4, Inter, and Lucide. See the [frontend guide](frontend/README.md)
  for component usage and styling conventions.
- NestJS backend with a `GET /api/health` endpoint.
- Auth APIs for registration, login, current-user lookup, and logout, using
  PostgreSQL, bcrypt password hashing, and JWT authentication cookies.
- PostgreSQL with persistent storage and Prisma database integration.
- Trip, membership, itinerary-day, Proposal, and ProposalVote database models,
  migrations, and constraint tests. Proposal APIs and UI are still pending.
- Authenticated Trip creation with automatic Owner/Days, plus member-scoped list,
  detail, and Days APIs.
- Owner-only Trip deletion, cleaning up memberships and Days while preserving users
  and other Trips.
- Docker Compose stack with service health checks and a non-root backend.
- Nginx gateway with local HTTPS and HTTP-to-HTTPS redirection.
- Playwright browser tests for Auth and the core Trip lifecycle in an isolated Docker stack.
- GitHub Actions checks for the frontend, backend, Prisma, container stack,
  and browser E2E tests.

Auth connects the frontend, backend, and database. Registration does not
log the user in; login sets a Secure, HttpOnly cookie. Logout clears the
cookie without revoking issued JWTs.
`/home` lists the current user's trips; `/trips/new` creates a Trip.
`/trips/:tripId` loads Workspace details and Days directly from the backend.
Activity, Proposal, and member-management UI, plus real-time collaboration,
are not implemented yet.
See the [P0 database design](docs/database/p0-database-erd.md) for the target
structure and current implementation status.

HTTPS currently uses a local self-signed certificate. Public deployment
and publicly trusted certificates are not configured yet.

## Project Structure

- `frontend/`: React application, frontend Dockerfile, and Nginx configuration.
- `backend/`: NestJS application, Prisma configuration and schema, and
  backend Dockerfile.
- `shared/`: Auth/Trip API types shared by the frontend and backend.
- `compose.yml`: frontend, backend, PostgreSQL, and a one-shot migration service.
- `e2e/`: Playwright tests, configuration, and test runner Dockerfile.
- `compose.e2e.yml` and `.env.e2e.example`: isolated browser test environment.
- `scripts/generate-local-cert.sh`: local TLS certificate generation.
- `.env.example`: example local environment configuration.
- `.nvmrc`: Node.js version used for development.
- `.github/workflows/ci.yml`: automated project checks.

## Containerized Application

### Prerequisites

- Git.
- Docker with Docker Compose support.
- OpenSSL supporting `req -addext` (for example, OpenSSL 3).

Create the local environment file:

```bash
cp .env.example .env
```

Replace the example PostgreSQL password and `JWT_SECRET` in `.env`.
Generate a random JWT secret with `openssl rand -hex 32`.
The `.env` file is ignored by Git and must not be committed.

Generate your local certificate once from the repository root:

```bash
sh scripts/generate-local-cert.sh
```

The certificate and private key are stored in `certs/`, ignored by Git,
and mounted read-only into Nginx. The script refuses to overwrite existing
files. If your Mac's OpenSSL does not support `-addext`, run the script in
your Linux development container with the repository mounted.

Build and start the complete application:

```bash
docker compose up --build
```

Compose applies committed Prisma migrations after PostgreSQL is healthy and
before the backend starts. The migration container exits with code 0 on success;
already-applied migrations are skipped. If migration fails, check
`docker compose logs migration` before retrying.

Open:

```text
https://localhost:8443
```

The backend health endpoint is available through the Nginx gateway at:

```text
https://localhost:8443/api/health
```

HTTP on port 8080 redirects to HTTPS on port 8443. The HTTPS port and
redirect destination are currently fixed for local use.

For browser access, trust your own `certs/localhost.crt` for SSL in your
local certificate store. On macOS, import it into the **login** keychain
using Keychain Access, then set its **Secure Sockets Layer (SSL)** trust
to **Always Trust**. Restart the browser. Each developer generates and
trusts their own certificate; only the `.crt` file is imported.

To run the application in the background:

```bash
docker compose up --build --detach
```

View service status:

```bash
docker compose ps
```

Follow logs:

```bash
docker compose logs --follow
```

Stop and remove the application containers and network:

```bash
docker compose down
```

The PostgreSQL named volume is preserved by `docker compose down`.

To intentionally remove the local database data as well:

```bash
docker compose down --volumes
```

This last command permanently deletes the local PostgreSQL data.

## Local Development

### Prerequisites

- Git.
- Node.js matching `.nvmrc`, with npm.
- Optionally, nvm to install and select the Node.js version.

From the repository root, if using nvm:

```bash
nvm install
nvm use
```

Build the shared types first, before starting either frontend or backend:

```bash
cd shared
npm ci
npm run build
cd ..
```

Rebuild `shared` after pulling or editing shared types. Compose and CI perform
this step automatically.

The complete backend requires a reachable PostgreSQL database,
`DATABASE_URL`, and `JWT_SECRET`. Use the containerized application workflow above to run
the integrated frontend, backend, and database stack.

To run the backend outside Compose, provide a `DATABASE_URL` for a
PostgreSQL instance reachable from the current environment:

```bash
cd backend
npm ci
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE'
export JWT_SECRET="$(openssl rand -hex 32)"
npm run prisma:generate
npm run prisma:migrate:deploy
npm run start:dev
```

Replace the URL placeholders with your database settings. Compose's
PostgreSQL service is not published to the host, so this workflow requires
a separately reachable database.

Apply committed migrations before using the backend, and again after pulling new
migrations. Keep `JWT_SECRET` stable between starts to preserve login sessions.
Authentication cookies require HTTPS; use the Compose gateway for login testing.

Prisma Client is generated locally and ignored by Git. Re-run
`npm run prisma:generate` from `backend/` after changing or pulling schema
changes.

Start the frontend in another terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173/login` for frontend development.
Use the Compose HTTPS gateway to verify the full Auth flow.

The local backend health endpoint is available at:

```text
http://localhost:3000/api/health
```

The Vite development proxy defaults to `http://127.0.0.1:3000`.
Set `API_PROXY_TARGET` to use a backend reachable at another address.

## Validation

### Shared types:

Run from the repository root before the frontend/backend checks:

```bash
cd shared
npm ci
npm run typecheck
npm run build
cd ..
```

### Frontend:

```bash
cd frontend
npm run lint
npm run build
npm test
```

### Backend:

```bash
cd backend
export DATABASE_URL='postgresql://transcendence:validation_only@localhost:5432/transcendence'
export JWT_SECRET='local-test-only-secret'
npm run prisma:validate
npm run prisma:generate
npm run lint
npm run build
npm test
```

`npm run test:e2e` also requires a reachable, migrated PostgreSQL database.
Its `DATABASE_URL` must name a dedicated database ending in `_test` before running it.

### Database integration tests

Database integration tests must use a dedicated PostgreSQL database whose
name ends with `_test`.

Set `TEST_DATABASE_URL` to the dedicated test database:

```bash
export TEST_DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE_test'
```

Prepare the test database and run the database integration tests:

```bash
npm run test:db:prepare
npm run test:db
```

`test:db:prepare` validates `TEST_DATABASE_URL` before running migrations.
It temporarily uses the test database URL for Prisma migration deployment,
so the normal development `DATABASE_URL` does not need to be changed.

The database test helper refuses to run when `TEST_DATABASE_URL` points to
a database whose name does not end with `_test`.

Database tests may clear table data between tests, but they preserve the
database schema and Prisma migration history.

### Containerized stack:

Generate the local certificate first using the setup instructions above.

```bash
docker compose config --quiet
docker compose up --build --detach --wait
docker compose exec -T frontend nginx -t
curl -I http://localhost:8080/api/health
curl --cacert certs/localhost.crt --fail https://localhost:8443/api/health
docker compose down
```

Expect HTTP `308` with an HTTPS redirect, followed by HTTPS `200` and
`{"status":"ok"}`. `--cacert` verifies the locally generated certificate.

### Browser E2E tests

Playwright verifies Auth and the Trip lifecycle: creation, Workspace refresh,
and confirmed deletion with an updated Home list. Tests use a separate database. See the
[E2E guide](e2e/README.md) for Docker commands, failure records, and cleanup.

## Continuous Integration

GitHub Actions runs the following jobs for pull requests targeting
`main` and for pushes to `main`:

- `Shared checks`: dependency installation, shared type checks, and build.
- `Frontend checks`: dependency installation, lint, build, and unit tests.
- `Backend checks`: dependency installation, Prisma schema validation,
  Prisma Client generation, database integration tests, lint, build, unit tests,
  and end-to-end tests.
- `Container checks`: temporary certificate generation, Compose validation,
  image builds, health checks, HTTP redirection, and HTTPS page/API checks.
- `Browser E2E checks`: isolated test stack, automatic migrations, Chromium
  Auth and Trip tests, failure trace upload, and test environment cleanup.

## Resources

- React: https://react.dev/
- Vite: https://vite.dev/
- NestJS: https://docs.nestjs.com/
- Docker Compose: https://docs.docker.com/compose/
- PostgreSQL: https://www.postgresql.org/docs/
- Nginx: https://nginx.org/en/docs/
- Prisma ORM: https://www.prisma.io/docs/orm/

AI assistance was used to help draft the initial product proposal,
guide development environment setup, troubleshoot installation issues,
and explain and provide starter infrastructure configuration.
