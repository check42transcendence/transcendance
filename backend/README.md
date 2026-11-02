# Backend

NestJS and TypeScript API for Travel Planner, using PostgreSQL and Prisma.
For Docker, HTTPS, and environment setup, see the [project README](../README.md).

## Structure

- `src/main.ts`: starts the server, enables cookie parsing, and sets the `/api` prefix.
- `src/auth/`: registration, login, JWT cookies, and authentication guards.
- `src/users/`: user persistence and database conflict handling.
- `src/database/`: shared Prisma connection.
- `src/trips/`: authenticated Trip creation, reads, and owner-only deletion.
- `../shared/`: public Auth/Trip API types; DTOs retain runtime validation.
- `prisma/`: database schema and committed migrations.
- `test/`: end-to-end and database integration tests.

Request flow: Controller → Service → PostgreSQL, using a Repository or PrismaService.
Modules connect these components through dependency injection.

## Auth endpoints

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/auth/register` | Creates a user; returns 201 without logging in. |
| POST | `/api/auth/login` | Verifies credentials, sets a JWT cookie, and returns 200. |
| GET | `/api/auth/me` | Returns the current user; requires a valid JWT cookie. |
| POST | `/api/auth/logout` | Clears the cookie and returns 204. |
| GET | `/api/health` | Returns `{ "status": "ok" }`. |

Registration accepts `email`, `username`, and `password`; login accepts
`email` and `password`. User responses contain only `id`, `email`, and `username`.

Passwords use bcrypt. The `token` cookie is Secure, HttpOnly, and SameSite=Lax,
with a seven-day lifetime. Use the HTTPS gateway for authentication testing.
Logout clears the browser cookie; it does not revoke an existing JWT.

## Development

Run these commands from `backend/`, using the Node.js version in `../.nvmrc`.
Set `DATABASE_URL` to a reachable PostgreSQL database and provide `JWT_SECRET`
in the backend process environment. Keep the secret private and stable.
Compose supplies these variables and applies committed migrations before the
backend starts. The commands below are for running the backend outside Compose.

```bash
cd ../shared
npm ci
npm run build
cd ../backend
npm ci
npm run prisma:generate
npm run prisma:migrate:deploy
npm run start:dev
```

After pulling shared-type changes, rebuild `shared`.
After pulling schema changes, regenerate Prisma Client. Apply any new committed
migrations before using the updated backend. Generated files in
`src/generated/` are ignored by Git.


## Trips

Trip models: `Trip`, `TripMember`, and `ItineraryDay`, linked to `User`.
`Proposal` and `ProposalVote` models are also implemented; their APIs are pending.
See the [P0 database design](../docs/database/p0-database-erd.md) for the full target.

All Trip endpoints require authentication:

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/trips` | Creates a Trip, Owner membership, and all Days atomically; returns 201. |
| GET | `/api/trips` | Lists Trips the caller currently belongs to, with their role. |
| GET | `/api/trips/:tripId` | Returns details to current members. |
| GET | `/api/trips/:tripId/days` | Returns Days to current members, ordered by day number. |
| DELETE | `/api/trips/:tripId` | Deletes the Trip for its current Owner; returns 204 with no body. |

Dates use `YYYY-MM-DD`. Creation includes both start and end dates; a same-day
Trip has one Day. Creation is limited to 365 days; longer ranges return
`400 VALIDATION_ERROR` before Days are generated. Lists use `createdAt` descending,
then `id` descending for equal timestamps.
Detail/Days reads return `404 TRIP_NOT_FOUND` for missing or
inaccessible Trips. Deletion checks current membership: ordinary Members receive
`403 TRIP_OWNER_REQUIRED`; non-members or missing Trips receive `404 TRIP_NOT_FOUND`.
P0 does not allow base-field editing.

Migrations enforce valid Trip dates, positive Day numbers, unique memberships
and Day numbers/dates, and at most one Owner per Trip. Deleting a Trip cascades
to its memberships and Days while preserving users. The CHECK constraints and
Owner partial unique index are defined in migration SQL; preserve them in future migrations.
Proposal/Vote cascade cleanup is covered by `test/database/proposal.db-spec.ts`.
Invitation and Activity cleanup must be integrated as those models become available.

Trip tests use the commands below:

- `test/database/trip.db-spec.ts`: database constraints (`npm run test:db`).
- `test/database/trips.service.db-spec.ts`: creation, rollback, member access, and deletion cleanup (`npm run test:db`).
- `test/trips.integration.spec.ts`: unauthenticated route protection (`npm test`).
- `test/trips.e2e-spec.ts`: HTTP creation, validation, access errors, and deletion (`npm run test:e2e`).

## Testing strategy

Choose the test type that best matches the behavior being verified. Keep tests repeatable, isolated from development data, and easy for other contributors to run.

| Test type | Location | Command | Purpose |
| --- | --- | --- | --- |
| Backend unit tests | `backend/src/**/*.spec.ts` and `backend/test/scripts/**/*.spec.ts` | `cd backend && npm test` | Test individual components and shared utilities without requiring a real database for each test. |
| Backend HTTP E2E tests | `backend/test/**/*.e2e-spec.ts` | `cd backend && npm run test:e2e` | Test backend behavior through the NestJS test application and HTTP requests. `DATABASE_URL` must point to a reachable, migrated PostgreSQL database whose name ends with `_test`. |
| Database integration tests | `backend/test/database/**/*.db-spec.ts` | `cd backend && npm run test:db:prepare && npm run test:db` | Verify database behavior against PostgreSQL. `TEST_DATABASE_URL` must point to a dedicated test database whose name ends with `_test`. |
| Browser Auth E2E tests | `e2e/tests/auth.spec.ts` | Follow the Docker workflow in [`e2e/README.md`](../e2e/README.md) | Verify registration, login, session restoration after refresh, logout, and redirects from protected routes using a real browser and an isolated test environment. |

### Test classification notes

- **Unit tests** should focus on individual components or utilities. Mock external dependencies when appropriate so these tests remain fast and predictable.
- **Backend HTTP E2E tests** use the dedicated Vitest configuration in `vitest.config.e2e.ts`. The `pretest:e2e` script checks `DATABASE_URL` before Vitest starts and refuses database names that do not end with `_test`.
- **Database integration tests** use `vitest.config.db.ts` and run without file-level parallelism. The `test:db:prepare` command validates `TEST_DATABASE_URL` and applies committed Prisma migrations to that database. Database tests may clear table data while preserving the schema and Prisma migration history.
- `backend/test/users.repository.e2e-spec.ts` is currently selected by the backend E2E Vitest configuration because of its filename. Its main purpose is to verify PostgreSQL repository behavior, so classify similar future tests as database integration tests. The existing file does not need to be moved solely to change its classification.
- **Browser E2E tests** use the isolated Docker environment described in [`e2e/README.md`](../e2e/README.md). That workflow provides its own test database, migration service, frontend, backend, and Playwright runner. Use the documented commands and cleanup procedure rather than connecting the browser test stack to the development database.
- Test database URL checks validate the PostgreSQL URL and require the database name to end with `_test`. This naming check is a safeguard, not proof that the database is disposable. Always use a dedicated test database and never point data-clearing tests at the development database.
- Set `JWT_SECRET` to a local test-only value when running backend tests that require it. Never use a production secret for tests.

### Adding tests for a new feature

- Add unit tests beside the relevant backend source file using the `.spec.ts` suffix, or beside the relevant frontend code using the existing frontend test conventions.
- Add database integration tests under `backend/test/database/` when behavior depends on real PostgreSQL queries or persistence.
- Add backend HTTP E2E tests under `backend/test/` using the `.e2e-spec.ts` suffix when validating backend behavior across multiple components.
- Extend the isolated browser E2E suite when a feature requires verification through real user interactions in the browser.
- Keep tests focused on the feature's own behavior, and reuse existing test utilities, database safety checks, and setup commands rather than implementing duplicate infrastructure.

## Checks

With `DATABASE_URL` and `JWT_SECRET` set:

```bash
npm run format
npm run lint
npm run build
npm test
```

Auth tests use mock user storage and password handling. The application uses
PostgreSQL and bcrypt.

`npm run test:e2e` also requires a reachable database with migrations applied.
Use a dedicated test database.

For database integration tests, set `TEST_DATABASE_URL` to a dedicated database
whose name ends with `_test`, then run:

```bash
npm run test:db:prepare
npm run test:db
```

Database integration tests may clear test data. See the
[project README](../README.md#validation) for environment and validation details.

Browser E2E tests use a separate Docker stack and test database. Its migration
service runs `test:db:prepare`; normal Compose runs `prisma:migrate:deploy`.
Both wait for migration success before starting the backend. See the
[E2E guide](../e2e/README.md) for commands and cleanup.
