# Backend Feature Development Guide

**Issue:** [#42 — Document & Validate Backend Feature Foundation](https://github.com/check42transcendence/transcendence/issues/42)  
**Audience:** Backend developers and Vertical Slice Owners  
**Status:** Complete — backend guide merged in PR #74. Validation records describe that PR snapshot.

## 1. Before You Start

This guide shows how to add a NestJS feature to the Travel Planner backend using the existing Auth implementation as the reference. It is a practical companion to [Backend Feature Conventions](feature-conventions.md), not a replacement for them.

**Priority of rules:** frozen contracts > approved feature conventions > examples in this guide. Do not silently change API paths, business rules, status codes, database fields, or realtime events to fit an example.

Read the relevant contracts before writing code:

- [Architecture](../contracts/01-ARCHITECTURE.md) — backend boundaries and `/api` prefix.
- [Domain model](../contracts/02-DOMAIN_MODEL.md) — state transitions and invariants.
- [Authentication & authorization](../contracts/03-AUTH_CONTRACT.md) — identity, Membership and roles.
- [Database](../contracts/04-DATABASE_CONTRACT.md) — Prisma models, migrations and transactions.
- [REST API](../contracts/05-REST_API_CONTRACT.md) — endpoints, DTOs and error codes.
- [Realtime](../contracts/06-REALTIME_CONTRACT.md) — Socket.IO security and after-commit events.
- [Shared types](../contracts/07-SHARED_TYPES.md) — canonical request/response shapes.
- [Environment & workflow](../contracts/08-ENVIRONMENT_AND_WORKFLOW.md) — Git, Compose and CI rules.

**Prerequisite:** Issue #41 (PR #68) has been merged into `main`. It provides the global `ValidationPipe`, `HttpExceptionFilter`, `ApiExpressAdapter`, and default-private `JwtAuthGuard` with `@Public()`. Integrate the latest `origin/main` into your feature branch before following this guide.

## 2. Start from the Current Main Branch

Run Git commands at the **repository root** in your host terminal:

```bash
git status --short                         # Stop if there are changes you need to preserve
git fetch origin
git switch -c feat/123-example-feature origin/main  # Example name; replace for your issue
```

For a documentation-only change, use the `docs/` prefix instead of `feat/`. If a branch already exists, run `git switch your-existing-branch`, then integrate new `origin/main` changes into **that same branch** instead of copying files into another branch. For a clean branch that is only behind `main`, `git merge --ff-only origin/main` is appropriate; for a branch with its own commits, review the incoming changes before merging. Never push directly to `main`.

The canonical application Compose services are `frontend`, `backend`, and `postgres`. Some developers have a **local** `devtools` override; it is not a required shared service. Use the commands in [backend/README.md](../../backend/README.md) if that local override is absent.

## 3. Recommended Feature Folder

Only create files the feature really needs:

```text
backend/src/<feature>/
├── <feature>.module.ts        # NestJS dependency wiring
├── <feature>.controller.ts    # REST routes and request/response boundary
├── <feature>.service.ts       # Business rules and permissions
├── <feature>.repository.ts    # Prisma queries
├── dto/
│   └── create-<feature>.dto.ts
└── <feature>.service.spec.ts  # Example of a co-located unit test
```

For example, a future Trips implementation could use `src/trips/trips.module.ts`, `trips.controller.ts`, `trips.service.ts`, `trips.repository.ts`, and `dto/create-trip.dto.ts`. **This layout is illustrative; it does not mean the Trips feature is already implemented.**

The existing source of truth for working examples is:

| Role | Existing reference |
| --- | --- |
| Application wiring | `backend/src/app.module.ts` |
| Feature wiring | `backend/src/auth/auth.module.ts` |
| Controller | `backend/src/auth/auth.controller.ts` |
| Request DTO | `backend/src/auth/dto/register.dto.ts` |
| Business Service | `backend/src/auth/auth.service.ts` |
| Repository | `backend/src/users/users.repository.ts` |
| Prisma injection | `backend/src/database/prisma.module.ts`, `prisma.service.ts` |
| Cookie identity | `backend/src/auth/guards/jwt-auth.guard.ts` |
| Current user | `backend/src/auth/decorators/current-user.decorator.ts` |
| Public routes | `backend/src/common/decorators/public.decorator.ts` |
| Error handling | `backend/src/common/filters/http-exception.filter.ts` |
| JSON parsing | `backend/src/common/http/api-express.adapter.ts` |

## 4. Understand the Request Flow

```text
Browser → HTTPS /api/... → NestJS
                              │
                    JWT Guard (unless @Public())
                              │
                    DTO / parameter validation
                              │
                         Controller
                              │
                  Service: domain authorization
                              │
                    Repository → Prisma → PostgreSQL
                              │
                 transaction COMMIT if applicable
                              │
              result → HTTP response; realtime AFTER COMMIT
```

- **Module:** connects dependencies; has no feature business logic.
- **Controller:** declares HTTP routes, success codes, validated input and verified identity; calls the Service. No direct Prisma queries.
- **DTO:** validates request shape and primitive fields at runtime. A TypeScript `interface` alone cannot validate a network request.
- **Service:** checks current Membership, permissions, parent/child relationships and domain state; coordinates transactions.
- **Repository:** performs database operations through the existing `PrismaService`.
- **Shared guard/pipe/filter:** central infrastructure; do not recreate it in each feature.

## 5. Step-by-Step Implementation Example

**Scenario:** use the contract-defined `POST /api/trips` as a *feature blueprint*. The DTO/Controller/Module snippets below illustrate integration points; **they are not an implemented, drop-in Trips feature**, because Trip Prisma models, Services and transactional rules belong to their own feature issue.

### 5.1 Start with the contract, not the code

The REST/shared-types contracts define the create request:

```json
{
  "title": "Barcelona",
  "destination": "Barcelona",
  "startDate": "2026-10-12",
  "endDate": "2026-10-15",
  "description": null
}
```

The database contract additionally requires that creation **atomically** creates the Trip, its OWNER Membership, and one `ItineraryDay` for each date. `createdBy`, Membership role, IDs, timestamps and Days are server-controlled, not accepted from the client.

### 5.2 Create the DTO

Illustrative file: `backend/src/trips/dto/create-trip.dto.ts`

```ts
import { IsDateString, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateTripDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  destination!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  startDate!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  endDate!: string;

  @IsOptional() // Accepts omitted or null values, as the contract permits.
  @IsString()
  description?: string | null;
}
```

After #41, the application registers **one global `ValidationPipe`** in `AppModule` with `transform: true`, `whitelist: true`, and `forbidNonWhitelisted: true`. Decorated DTO classes are checked automatically when a Controller uses `@Body() dto: CreateTripDto`. Unexpected fields such as `role` or `createdBy` are rejected as `400 VALIDATION_ERROR`.

DTO validation **does not** verify `endDate >= startDate`, Trip Membership or database relationships; the Service must implement those checks. For primitive route IDs, explicitly use `ParseUUIDPipe` where appropriate; do not assume the global DTO pipe validates every route parameter.

For a real example, read `RegisterDto`: it trims email and username, validates their formats/lengths, and deliberately **does not trim the password**.

### 5.3 Create the Controller

Illustrative `backend/src/trips/trips.controller.ts`:

```ts
import { Body, Controller, Inject, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CreateTripDto } from './dto/create-trip.dto.js';
import { TripsService } from './trips.service.js';

@Controller('trips') // Full route: POST /api/trips
export class TripsController {
  constructor(@Inject(TripsService) private readonly trips: TripsService) {}

  @Post()
  create(
    @CurrentUser() user: { sub: string },
    @Body() input: CreateTripDto,
  ) {
    return this.trips.create(user.sub, input); // Expected shape: { trip: ... }
  }
}
```

`@Post()` defaults to HTTP `201` for creation. Return only the contract-defined public fields. Do not add `@Public()` to a Trip route: the global JWT Guard makes it private by default. Do not accept a body-provided `userId` as identity.

For routes such as `GET /api/trips/:tripId`, validate the route parameter explicitly (example: `@Param('tripId', new ParseUUIDPipe({ version: '4' })) tripId: string`) and enforce resource access in the Service.

### 5.4 Implement the Service

The Service performs the **business decisions**. The actual Auth reference is `AuthService.register()`:

1. Hash the password through `AuthPasswordService`.
2. Ask the storage dependency to create the User.
3. Convert known email/username uniqueness failures into `409 EMAIL_ALREADY_EXISTS` or `409 USERNAME_ALREADY_EXISTS`.
4. Return only `{ user: { id, email, username } }`, never the password hash.

An actual Service example is `backend/src/auth/auth.service.ts`. The existing `login()` method delegates database lookup to its repository abstraction, checks the password with its password dependency, and returns only public user fields:

```ts
// Excerpt from AuthService; the class injects AuthUserRepository and AuthPasswordService.
async login(input: LoginDto) {
  const user = await this.users.findByEmail(input.email);

  if (user === null) {
    throw this.invalidCredentials();
  }

  const passwordMatches = await this.passwords.verify(
    input.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw this.invalidCredentials();
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
    },
  };
}
```

The Auth Service injects the abstract `AuthUserRepository` token rather than constructing a Prisma client. `AuthModule` binds that token to `UsersRepository` with `useExisting`. Other features may inject their own Repository classes directly when no abstraction is needed. Domain authorization belongs in the Service, not in the Controller or DTO.

For Trip creation, a completed `TripsService.create(userId, input)` must do the following **inside one atomic transaction**:

```text
check input dates (endDate >= startDate)
→ insert Trip with created_by = verified user ID
→ insert exactly one OWNER TripMembership
→ generate every ItineraryDay for the inclusive date range
→ COMMIT
→ return the contract-defined Trip response
```

If any insertion fails, all changes must roll back. Do not insert a Trip and its OWNER Membership using unrelated, independently committed calls. Use the existing Prisma transaction support; do not invent an ad hoc second database client.

For updates, reads, deletes and nested routes, first check the feature's exact permissions and parent-resource relationships. A verified JWT gives a **User identity**, not current OWNER/MEMBER privileges.

### 5.5 Create the Repository

A feature Repository is `@Injectable()` and receives the **existing** `PrismaService`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class TripsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Add only the queries needed by the feature.
  // The Trip Prisma model must exist before using prisma.trip.
}
```

The implemented example is `UsersRepository`. Its `findById()` method shows the actual Prisma access pattern:

```ts
// Method inside the existing @Injectable() UsersRepository class.
async findById(id: string): Promise<User | null> {
  return this.prisma.user.findUnique({
    where: { id: id },
  });
}
```

The real Repository also uses `findFirst()` and `create()` and translates recognized `P2002` unique-index failures into `AuthUserConflictError`. Unexpected failures are rethrown, not disguised as successful writes or returned as raw database diagnostics.

The Repository may expose a transaction-aware operation when multiple writes must be atomic. Keep the transaction and locking rules in the Database Contract; use reviewed raw SQL only when Prisma cannot express the required lock/constraint.

### 5.6 Wire the Module

Illustrative `backend/src/trips/trips.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module.js';
import { TripsController } from './trips.controller.js';
import { TripsService } from './trips.service.js';
import { TripsRepository } from './trips.repository.js';

@Module({
  imports: [PrismaModule],
  controllers: [TripsController],
  providers: [TripsService, TripsRepository],
})
export class TripsModule {}
```

After implementing the feature, import `TripsModule` once in `AppModule`. Do **not** register another global `APP_GUARD`, `APP_PIPE` or `APP_FILTER`; #41 already owns those. Export providers only when another module really needs them. See `AuthModule` for the existing, slightly more advanced injection pattern using `useExisting` and abstract dependency tokens.

## 6. Authentication Versus Authorization

### 6.1 Authentication is shared

The global `JwtAuthGuard` reads the backend-issued JWT from the `token` HttpOnly cookie, verifies its signature and UUID `sub`, and attaches `request.user = { sub }`. `@CurrentUser()` reads that verified identity. It is **not** appropriate to read a user ID or role from arbitrary request JSON.

The only existing public HTTP endpoints are intentionally marked `@Public()`:

| Method / path | Access |
| --- | --- |
| `GET /api/health` | Public |
| `POST /api/auth/register` | Public |
| `POST /api/auth/login` | Public |
| `POST /api/auth/logout` | Public, clears cookie and returns 204 |
| `GET /api/auth/me` | Private |
| New Trip/Activity/Proposal endpoints | Private by default |

Registration does **not** log the user in. Login explicitly creates the cookie session; logout clears it but does not revoke an already-issued JWT. Do not duplicate JWT issuing, password handling or session logic in feature modules.

### 6.2 Authorization belongs to each feature

Use **current PostgreSQL Membership**, not `trip.created_by`, a JWT role claim, or frontend state:

| Operation | Required check |
| --- | --- |
| View Trip Workspace | Current `OWNER` or `MEMBER` Membership |
| Invite a User / delete Trip | Current `OWNER` Membership |
| Leave Trip | Only `MEMBER`; OWNER → `409 OWNER_CANNOT_LEAVE` |
| Accept/reject Invitation | Authenticated target User only |
| Activity create/update/delete | Current Membership and related Activity/Day in URL Trip |
| Proposal create / Vote / manual Adopt | Current Membership and the exact state/majority rules |
| Nested Activity / Proposal from another Trip | Conceal with contract-defined `404`, not cross-Trip data |

Pending Invitation gives no Workspace access. A vote can change only the current user's Vote on a `PENDING` Proposal. During Adoption, recheck Membership, status and current strict majority in the transaction. Current `AGREE` count must be greater than half the **current participant count**. A `REJECT` vote never automatically changes Proposal status.

For a feature that requires OWNER access, the **future feature Service**, not the global JWT Guard, must perform a current database-backed check. Illustrative pseudocode (the Trip Membership Repository does **not** yet exist in the #41 snapshot):

```ts
// Pseudocode ONLY — do not copy as a working method.
const membership = await tripsRepository.findCurrentMembership(tripId, userId);
if (!membership) {
  // Raise the contract-defined 403 MEMBERSHIP_REQUIRED where appropriate,
  // or the contract-defined 404 when the resource must be concealed.
}
if (membership.role !== 'OWNER') {
  // Raise 403 TRIP_OWNER_REQUIRED for an OWNER-only operation.
}
// For state-sensitive writes, repeat necessary checks in the transaction.
```

Do not invent a new authorization response or expose whether a resource exists in another Trip. Read the specific frozen route and visibility rules before writing these checks.

**Error distinction:** `401` means no valid authenticated identity; `403` means an authenticated caller lacks permission; `404` may intentionally conceal a resource outside the current Trip. Follow the frozen contract when a specific business code applies.

## 7. API Errors: Reuse the Shared Handler

All errors use the frozen shape:

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

For known domain failures, the Service raises a standard Nest `HttpException` with the **exact contract-defined body**. Example from the existing Auth pattern:

```ts
throw new ConflictException({
  error: {
    code: 'EMAIL_ALREADY_EXISTS',
    message: 'Email already exists',
    details: {},
  },
});
```

The global `HttpExceptionFilter` preserves already formatted domain/Auth errors. Its generic fallbacks are:

| Situation | HTTP / code |
| --- | --- |
| Bad DTO field, extra field, invalid UUID parameter | `400 VALIDATION_ERROR` |
| Malformed JSON | `400 MALFORMED_REQUEST` |
| Missing/invalid JWT | `401 AUTHENTICATION_REQUIRED` |
| Generic forbidden action | `403 ACCESS_DENIED` |
| Generic unknown route/resource | `404 NOT_FOUND` |
| Generic state conflict | `409 STATE_CONFLICT` |
| Oversized JSON request | `413 PAYLOAD_TOO_LARGE` |
| Other unclassified client errors | Original `4xx` status with `CLIENT_ERROR` |
| Unexpected server failure | `500 INTERNAL_ERROR` (safe body) |

Do not replace specific codes such as `TRIP_OWNER_REQUIRED`, `ACTIVITY_NOT_FOUND`, `ACTIVITY_VERSION_CONFLICT` or `PROPOSAL_MAJORITY_LOST` with generic codes. Do not invent an `422` response or expose passwords, secrets, SQL, stack traces or raw Prisma errors. Frontend logic must switch on `error.code`, not human-readable `message`.

ApiExpressAdapter handles malformed JSON and oversized request bodies before normal DTO validation. Feature owners should neither recreate JSON parsing nor catch every exception just to reformat it. All HTTP `500+` exceptions are sanitized by the shared Filter.

## 8. Database Schema, Migrations and Transactions

At the #41 snapshot, `backend/prisma/schema.prisma` contains `User`; check the current schema before implementing additional P0 domain models. Each feature owner follows the Database Contract rather than assuming a model already exists. Never assume that an illustrative `prisma.trip` call is runnable before the Trip model and migration exist.

When a feature needs persisted models:

1. Update `backend/prisma/schema.prisma` using agreed types, relations and enums.
2. Create a **new** Prisma migration against a safe development database; inspect the generated SQL.
3. Add reviewed PostgreSQL SQL for any required functional/partial indexes, constraints or row locks not expressible in the Prisma schema.
4. Validate, regenerate the client, test migrations on a clean isolated database, and commit both schema and migration files.
5. Never use `prisma db push` as shared schema history; never rewrite already-merged migrations.

Typical commands **from `backend/`** after the correct development DB is configured:

```bash
npm run prisma:validate
npx prisma migrate dev --name add_trip           # Example migration name; safe development DB only
npm run prisma:generate
```

To apply existing committed migrations, use `npm run prisma:migrate:deploy` against the **intended** database. The repository uses Prisma 7, with DB connection configuration in `prisma.config.ts`. Do not invent `DATABASE_URL` values or use the production DB for experiments.

Transactions must encode domain invariants, not just convenience. Examples: Trip+OWNER+Days creation; Invitation acceptance; member leave plus Vote deletion; Activity versioned updates; Proposal Vote/Adoption. Majority-affecting transactions use the canonical **Trip → Proposal** lock order. Only emit successful realtime notifications **after COMMIT**; a rollback emits none.

## 9. Realtime Is a Separate Security Boundary

Socket.IO runs inside NestJS at `/socket.io` with canonical Trip rooms named `trip:<tripId>`. REST is the write interface; WebSocket events notify clients of **committed** changes.

The **HTTP** global JWT Guard does not automatically secure Socket.IO. A Gateway must independently validate the cookie-backed identity and **current TripMembership** before admitting a socket to a Trip room. Membership loss must stop protected delivery. Do not accept client-supplied user IDs as proof of identity.

Use only contract-defined events (for example `activity:created`, `proposal:vote-updated`, `proposal:adopted`, `proposal:reopened`) and the shared envelope `{ tripId, occurredAt, data }`. Do not publish personal Vote state to the entire room. After reconnect, resubscribe and refetch authoritative REST state; there is no durable event replay or exactly-once guarantee in P0.

## 10. Testing: What to Add and Where

The test type depends on risk. Avoid meaningless duplication, but **every new REST endpoint needs HTTP-level coverage**, including negative cases.

| Test | Location | What to verify |
| --- | --- | --- |
| Unit/component (Vitest) | `backend/src/**/*.spec.ts` | DTO, Service rules, errors and permissions with mocks |
| Backend HTTP E2E | `backend/test/**/*.e2e-spec.ts` | Real routes, DTO enforcement, cookie auth, status/body |
| DB integration | `backend/test/database/**/*.db-spec.ts` | Real Postgres constraints, transactions, rollback, concurrency |
| Browser E2E (Playwright) | `e2e/tests/*.spec.ts` | User-visible cross-layer journeys, where relevant |
| Shared infrastructure regression | Existing #41 specs and HTTP integration tests | Guard/pipe/filter behavior; extend only for shared changes |

Use these existing real examples:

- `backend/src/auth/auth.controller.spec.ts`: Auth controller behavior with mocks.
- `backend/src/auth/auth.service.spec.ts`: success and failure paths.
- `backend/src/users/users.repository.spec.ts`: Repository unit tests.
- `backend/test/global-auth.integration.spec.ts`: global JWT Guard behavior through HTTP.
- `backend/test/http-exception.integration.spec.ts`: 400/401/403/404/409/413/415/500 behavior through HTTP, including safe error bodies.
- `e2e/tests/auth.spec.ts`: browser registration → login → refresh → logout.
- `e2e/tests/validation.spec.ts`: Playwright API validation checks added by #41.

For each new route, check: correct method and `/api` path; expected success shape/status; missing/invalid cookie (`401`); bad DTO/extra fields (`400`); forbidden roles (`403` where applicable); missing/cross-Trip resources (`404`); business conflicts (`409`); and no accidental private-field exposure. Test UUID input, nested resource relationships and owner/membership transitions as needed.

For stateful features, add real PostgreSQL integration tests for the contract-required invariants: uniqueness, FK integrity, transactional rollback, stale Activity `expectedVersion`, strict-majority rechecks, and double-Adopt concurrency. **Mocks cannot prove PostgreSQL locks or uniqueness.** For realtime, test room access, correct latest-state payloads, after-commit emission and no success event on rollback.

### 10.1 Backend commands

Build `shared/` first after pulling or editing shared types (see the
[project setup](../../README.md#local-development)). Then run from `backend/`,
with the correct environment variables:

```bash
npm run prisma:validate
npm run prisma:generate
npm run lint
npm run build
npm test
```

These check static/build/unit-level behavior; **they do not replace DB or backend E2E tests**.

### 10.2 Database integration: dedicated database only

Set `TEST_DATABASE_URL` to a dedicated PostgreSQL database **ending in `_test`**, and make sure it is the correct database before running:

```bash
npm run test:db:prepare
npm run test:db
```

`test:db:prepare` applies committed migrations to that test DB. Database tests may clear its data. The `_test` name check is a safeguard, **not proof the database is disposable**. Never aim these commands at a development or production database.

### 10.3 Backend HTTP E2E

`DATABASE_URL` must point to a reachable **migrated, dedicated** PostgreSQL database whose name ends in `_test`:

```bash
npm run test:e2e
```

The `pretest:e2e` guard rejects a non-`_test` database URL. Keep `DATABASE_URL` for HTTP E2E distinct from the normal development DB. See [backend/README.md](../../backend/README.md) for the exact strategy and command classifications.

### 10.4 Browser E2E (optional locally; required CI check)

The browser suite runs in an isolated Docker stack, not against the development database. Follow [e2e/README.md](../../e2e/README.md). From the **repository root**:

```bash
# If the local certificate does not exist yet:
sh scripts/generate-local-cert.sh

docker compose --project-name transcendence-e2e \
  --env-file .env.e2e.example --file compose.e2e.yml \
  up --build --detach --wait backend frontend

docker compose --project-name transcendence-e2e \
  --env-file .env.e2e.example --file compose.e2e.yml \
  run --build --rm --no-deps -T e2e

# Destructive only to the isolated E2E test volume:
docker compose --project-name transcendence-e2e \
  --env-file .env.e2e.example --file compose.e2e.yml \
  down --volumes --remove-orphans
```

On slower machines the Chromium build may be expensive. Do not alter test timeouts to conceal problems; rely on the repository CI for independent validation and run local browser E2E when practical.

## 11. GitHub Actions and Pull Requests

GitHub Actions for PRs to `main` runs:

1. **Frontend checks** — lint, build, unit tests.
2. **Backend checks** — Prisma, real DB tests, lint, build, unit and backend HTTP E2E tests.
3. **Container checks** — images, Compose, HTTPS/health verification.
4. **Browser E2E checks** — isolated Chromium workflow.

Before opening your PR, review the working tree and the actual staged commit:

```bash
git status --short
git diff --check                   # Unstaged changes
git diff --stat
# Stage ONLY your intended files; for this docs-only issue, for example:
git add docs/backend/feature-development-guide.md
git diff --cached --check          # Staged changes
git diff --cached --stat
git diff --cached --name-only
```

Stage **only** files in your issue's scope. Do not mistake an empty `git diff` for an empty commit when changes have already been staged. Never commit `.env`, real JWT secrets, passwords, private keys, `node_modules`, generated Prisma client, or test results. Commit meaningful migrations with schema changes.

In the PR description include **Summary**, **What stays unchanged**, **Tests run / not run**, and any **known follow-up**. Link the issue (for example `Closes #42`). Branch policy: **no direct push to `main`**, at least **one non-author Approve**, passing required CI, and **Squash and merge**. Keep the same feature branch when integrating newer `origin/main`.

## 12. Feature Definition of Done

Before requesting a merge, verify:

- [ ] Endpoints, request/response DTOs and statuses match frozen contracts.
- [ ] Controller delegates; Service owns business rules and current permissions; Repository owns persistence.
- [ ] Validated DTO classes reject wrong types and extra fields; route parameters are checked explicitly.
- [ ] Private routes rely on the global JWT Guard; `@Public()` is used only intentionally.
- [ ] `401` identity failure is distinguished from `403` permission failure and cross-Trip `404` concealment.
- [ ] Server-controlled values cannot be assigned through the client body.
- [ ] Known errors use their exact stable contract codes; unexpected failures do not leak secrets.
- [ ] Database migration, real constraints, transaction/rollback/concurrency tests are included where applicable.
- [ ] Realtime (if any) is separately authorized and broadcast only after COMMIT.
- [ ] Tests include happy path and relevant invalid/unauthorized/conflict paths.
- [ ] Backend lint/build/unit, relevant DB/HTTP E2E, and applicable browser tests have been verified.
- [ ] PR lists test evidence, receives non-author approval and passes required GitHub Actions checks.
- [ ] Documentation describes **implemented** behavior, not merely proposed features.

## 13. #42 Final Foundation Validation Record

This section records the final validation for Issue #42. Issue #41 (PR #68) has been merged into `main`, including the shared validation, authentication guard, and HTTP error handling infrastructure. The REST contract and Shared Types include `ACCESS_DENIED`, `NOT_FOUND`, `STATE_CONFLICT`, `PAYLOAD_TOO_LARGE`, and `CLIENT_ERROR`.

Verify the documentation against the merged implementation and record the actual #42 test results and CI evidence below.


| Check | Evidence / result |
| --- | --- |
| #41 merged into `main` | **Complete** — PR #68 merged on 2026-10-24 |
| Guide reviewed against merged Auth, Prisma and shared HTTP files | **Complete** — checked against the merged Auth implementation, global validation/filter, Prisma User schema and contracts |
| REST error-code list agrees with frozen `ApiErrorCode` union | **Passed** — including `PAYLOAD_TOO_LARGE` and `CLIENT_ERROR` |
| `npm run lint` | **Passed in CI** — Backend checks |
| `npm run build` | **Passed in CI** — Backend checks |
| `npm test` | **Passed in CI** — Backend checks |
| `npm run test:e2e` on `_test` database | **Passed in CI** — using `transcendence_test` |
| `npm run test:db` on dedicated `_test` DB | **Passed in CI** — using `transcendence_test` |
| Required GitHub Actions checks | **Passed (4/4)** — Frontend, Backend, Container, Browser E2E |
| CI evidence | [PR #74 CI run #40115375695](https://github.com/check42transcendence/transcendence/actions/runs/40115375695), successful on commit `b732a31` |
| Non-author review | **Pending** — approval required before merge |


The recorded CI results belong to PR #74 at commit `b732a31`. This documentation-only update will trigger a new CI run; verify that the latest PR checks also pass before merging.

---

**Maintainers' rule:** Reuse shared infrastructure; feature owners own their domain rules and tests. When a frozen contract and implementation disagree, stop and open a reviewed contract change instead of silently modifying behavior.
