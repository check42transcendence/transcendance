# Database Migrations and Testing — Shared Foundation

This guide explains the shared PostgreSQL, Prisma migration, and database-test infrastructure used by all backend Vertical Slice Owners. For feature-specific models, constraints, and transaction rules, the frozen [Database Contract](../contracts/04-DATABASE_CONTRACT.md) remains authoritative.

## 1. How the Pieces Fit Together

| Part | Responsibility |
| --- | --- |
| `backend/prisma/schema.prisma` | Declares Prisma models, fields, and relationships. |
| `backend/prisma/migrations/` | Stores versioned SQL migrations committed to Git. |
| `backend/prisma.config.ts` | Points Prisma at the schema, migrations, and `DATABASE_URL`. |
| `npm run prisma:generate` | Generates the TypeScript Prisma Client; **does not change database tables**. |
| `npm run prisma:migrate:deploy` | Applies existing migrations to the database selected by `DATABASE_URL`. |
| `npm run test:db:prepare` | Validates `TEST_DATABASE_URL`, then applies committed migrations to that test database only. |
| `npm run test:db` | Runs PostgreSQL integration tests under `backend/test/database/**/*.db-spec.ts`. |

A schema change is not deployed just because `schema.prisma` or the generated Client has changed. Database structure changes require reviewed and committed migrations.

## 2. Development and Test Databases

Keep these connections separate:

- `DATABASE_URL`: the database used by the normal backend development process (for example, `transcendence`).
- `TEST_DATABASE_URL`: a **dedicated, disposable** database for database integration tests (for example, `transcendence_test`).

The shared preparation script checks that `TEST_DATABASE_URL` is present, uses a PostgreSQL URL, and names a database ending in `_test`. It temporarily passes this value as `DATABASE_URL` **to the migration subprocess**. It does not permanently change the developer's `DATABASE_URL`.

**The `_test` suffix is a guard, not proof that a database is safe to erase.** Verify the host, credentials, and database identity. Test setup does not create the PostgreSQL database itself; it must already exist and be reachable.

**HTTP E2E differs from DB integration tests:** `npm run test:e2e` uses `DATABASE_URL`, and its pretest guard also requires that URL to name an `_test` database. Never run HTTP E2E against a normal development database.

## 3. What the Shared Test Foundation Provides

The reusable utilities live in `backend/test/database/test-database.ts`:

```ts
import {
  resetTestDatabase,
  testDatabase,
  closeTestDatabase,
} from './test-database.js';
```

- `testDatabase`: a `pg` connection pool configured from `TEST_DATABASE_URL`.
- `resetTestDatabase()`: truncates all regular tables in the `public` schema **except** `_prisma_migrations`, with `RESTART IDENTITY CASCADE`.
- `closeTestDatabase()`: closes the connection pool after tests.

A reset removes test data, **not the tables, indexes, constraints, or Prisma migration history**. It affects all application tables in that test database, not just the tables belonging to one feature.

**Resets are not automatic:** each test suite that needs a clean starting state should call `resetTestDatabase()` (typically in `beforeEach`). Tests must create their own fixtures instead of depending on data left by earlier tests.

`backend/vitest.config.db.ts` selects `test/database/**/*.db-spec.ts` and disables file-level parallel execution to reduce interference between database test suites. This does not replace proper test isolation or connection cleanup.

## 4. Responsibilities of Each Feature Owner

When implementing Trip, Membership, Activity, Proposal, or another backend feature:

1. Follow the frozen Database Contract for models, indexes, foreign keys, transactions, and concurrency behavior.
2. If the database structure changes, update `schema.prisma`, create a **new** migration, review its SQL, and commit both the schema and migration. Add reviewed PostgreSQL SQL for constraints or indexes Prisma cannot express.
3. Apply committed migrations to the appropriate development database; regenerate Prisma Client when the schema changes.
4. Add feature-specific integration tests under `backend/test/database/`, named `*.db-spec.ts` (for example, `trip.db-spec.ts`). Reuse the shared pool and reset utilities instead of creating another setup framework.
5. Test real database behavior that mocks cannot prove: uniqueness, foreign keys, transactional rollback, version conflicts, locking, and concurrent writes where applicable.
6. Run the relevant database, backend unit, and HTTP E2E checks before requesting review.

Example test structure (illustrative; the Trip tables and fixtures must exist first):

```ts
import { afterAll, beforeEach, describe, it } from 'vitest';
import {
  closeTestDatabase,
  resetTestDatabase,
  testDatabase,
} from './test-database.js';

describe('Trip database', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('enforces a Trip database invariant', async () => {
    // Insert controlled fixtures and assert actual PostgreSQL behavior.
    // Use testDatabase.query(...) where appropriate.
  });
});
```

Do not rewrite merged migrations or use `prisma db push` as the team's migration history. A faulty merged migration should be corrected with a new reviewed migration.

## 5. Testing and CI

The standard database test commands, run from `backend/` with a correctly configured, reachable test database, are:

```bash
npm run prisma:validate
npm run prisma:generate
npm run test:db:prepare
npm run test:db
```

`test:db:prepare` **deploys existing migrations**; it neither generates a new migration nor resets test data itself.

In `.github/workflows/ci.yml`, the **Backend checks** job starts a dedicated PostgreSQL database named `transcendence_test`, supplies test-only credentials, generates Prisma Client, prepares migrations, runs DB integration tests, and then runs lint, build, unit tests, and backend HTTP E2E. Both `DATABASE_URL` and `TEST_DATABASE_URL` point to the CI test database for that job.

The separate browser E2E Docker stack uses its own test database and migration service; it does not use the normal development database. The standard application Compose stack does **not** automatically perform migrations on every start.

## 6. Safety Rules and References

- Never point data-clearing tests at production, shared development, or valuable databases.
- Do not bypass the `_test` database-name guards.
- Do not assume a generated Prisma Client means migrations have been applied.
- Do not edit existing merged migration history, drop `_prisma_migrations`, or commit real database passwords or `.env` files.
- Keep test cases independent, verify actual database constraints, and close owned connections.
- Coordinate schema and contract changes across features before implementation.

**Source files:**

- `backend/scripts/test-database-url.mjs`
- `backend/scripts/prepare-test-database.mjs`
- `backend/scripts/check-test-database-url.mjs`
- `backend/test/database/test-database.ts`
- `backend/test/database/database.db-spec.ts`
- `backend/vitest.config.db.ts`
- `backend/README.md`
- `.github/workflows/ci.yml`

**Ownership rule:** The shared foundation owns test-database safety, migration preparation, and reusable test utilities. Each Vertical Slice Owner owns their feature's models, migrations, database invariants, and integration tests.
