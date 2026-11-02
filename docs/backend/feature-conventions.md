# Backend Feature Conventions

**Status:** Proposed — Issue #40; subject to PR review  
**Parent:** [#36 — Backend Feature Foundation](https://github.com/check42transcendence/transcendence/issues/36)  
**Reference:** [#39 — Backend Feature Audit](../audits/39-backend-feature-audit.md)

## 1. Purpose and Precedence

Provide consistent NestJS backend conventions so that each Vertical Slice Owner can implement and test their own feature without duplicating shared infrastructure.

These conventions use the merged Auth and Prisma implementation as a reference. They **do not** freeze or alter P0 business rules. In case of any disagreement, the [frozen contracts](../contracts/README.md) take precedence, and changes follow the team's Contract Change Rule.

The shared infrastructure (global ValidationPipe, JWT authentication guard, and HTTP exception normalization) has been implemented and merged into `main` through Issue #41 (PR #68). Future feature owners should use these existing components rather than implement them again.

## 2. Recommended Feature Structure

Typical feature layout, as appropriate:

```text
backend/src/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
├── <feature>.service.ts
├── <feature>.repository.ts
├── dto/
│   └── create-<feature>.dto.ts
└── *.spec.ts
```

- Use clear feature boundaries and NestJS modules.
- Create only files a feature needs; these filenames are guidance, not a required scaffold.
- Existing shared modules (such as `PrismaModule` and `UsersModule`) may live outside an individual feature folder and should be reused.
- Put cross-feature code in a shared location only when multiple features genuinely need it. Do not prematurely build a generic framework.
- Reuse the authoritative shared types for frontend/backend/API/realtime interfaces; do not introduce divergent enums or DTO definitions.

## 3. Layer Responsibilities

### Controller

- Declare HTTP methods, routes, and success status codes.
- Receive DTO-validated input and authenticated identity as needed.
- Delegate operations to the feature Service.
- Do not call Prisma directly or implement domain rules in the Controller.
- Keep request/response-specific handling (such as setting an authentication cookie) at the HTTP boundary when appropriate.

### DTO and runtime validation

- Describe allowed request fields and validate HTTP input at runtime.
- Validate required fields, formats, enums, UUIDs, lengths, and optional/nullable semantics where applicable.
- Use the frozen REST and shared-type contracts for field names and values.
- Static TypeScript interfaces alone do not validate incoming requests.
- Never use DTO validation as a substitute for current Membership, cross-resource, concurrency, or transaction checks.

### Service

- Implement business rules, current database-backed authorization decisions, and domain state transitions.
- Coordinate persistence operations and transactions when applicable.
- Translate known domain failures into contract-defined API errors at the appropriate boundary.
- Do not depend on raw HTTP request/response objects unnecessarily.
- Ensure successful realtime events are emitted only after a committed database change.

### Repository

- Encapsulate feature-specific Prisma reads/writes and persistence queries.
- Inject the existing `PrismaService` instead of constructing another Prisma Client.
- Translate well-understood database errors to meaningful domain/persistence errors when necessary; rethrow unexpected failures.
- Do not format HTTP responses or enforce UI concerns.

### Module

- Register controllers and providers and import required modules.
- Export only providers other modules actually need.
- Prefer existing NestJS dependency-injection patterns over unnecessary indirection.

## 4. Validation and API Errors

### 4.1 Global request validation (decision: C)

Use a shared **global `ValidationPipe`** for DTO-based HTTP request validation. Its baseline is:

- `transform: true`
- `whitelist: true`
- `forbidNonWhitelisted: true`
- An `exceptionFactory` producing `400 VALIDATION_ERROR` in the frozen API envelope.

Feature owners declare runtime validation in DTO classes using `class-validator` and `class-transformer` where appropriate. Route-specific validation, such as explicit UUID parameter parsing and cross-field checks, may still be needed. Extra fields should be rejected, not silently accepted. Do not assume a global pipe automatically checks all business rules or every primitive route parameter.

**Implemented in #41:** the global ValidationPipe is registered, redundant Auth validation configuration has been removed, and regression tests preserve existing registration/login behavior and API error responses.

### 4.2 Frozen HTTP status and error format

Use the canonical error envelope:

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

Canonical HTTP semantics:

- `400` — malformed input or failed DTO validation.
- `401` — missing or invalid authentication.
- `403` — authenticated but lacking permission.
- `404` — requested resource absent in the requested parent context.
- `409` — current business/database state conflicts with the operation.
- `500` — unexpected server failure.

Do not substitute `422` for request validation or invent public error codes without the required contract review. Use `VALIDATION_ERROR`, `MALFORMED_REQUEST`, `INTERNAL_ERROR`, and the feature-specific codes already listed in the frozen REST contract.

### 4.3 Layered error handling (decision: C)

- **Repository:** detect relevant persistence conflicts (for example, Prisma `P2002`) and translate known cases where useful; never expose raw DB errors to clients.
- **Service:** enforce business invariants and map known domain failures to the correct HTTP status and stable machine code.
- **Shared HTTP exception handling:** normalize framework errors, malformed JSON, and unexpected failures into the agreed envelope without overwriting valid, intentional domain codes. Do not leak stack traces, tokens, database details, or credentials.

**Implemented in #41:** the global HttpExceptionFilter and ApiExpressAdapter normalize HTTP errors into the canonical response format. Recognized client errors retain their 4xx status, including `413 PAYLOAD_TOO_LARGE`. Other unclassified 4xx errors use `CLIENT_ERROR`, while unexpected server failures return a safe `500 INTERNAL_ERROR`.

## 5. Authentication and Authorization

### 5.1 Authentication (decision: B)

Reuse the existing backend-issued JWT in an `HttpOnly` cookie and the existing JWT verification logic. **Target convention:** secure HTTP routes by default with a global JWT authentication guard and an explicit shared `@Public()` marker for routes intentionally open to unauthenticated requests.

For backwards compatibility, public endpoints include:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout` (must keep its existing cookie-clearing behavior)
- `GET /api/health`

`GET /api/auth/me` remains protected. Marking an endpoint public must be an explicit decision; new feature routes should not become public accidentally.

**Implemented in #41:** the global JWT guard protects routes by default, while `@Public()` explicitly exempts public Auth and health endpoints. Regression tests verify the existing authentication behavior.

JWT establishes **identity**, not authoritative Trip role. Never trust client-supplied user IDs, role fields, or JWT claims as current Membership proof.

### 5.2 Authorization (decision: B)

Each **Feature Service** is responsible for domain-specific permission checks, based on current server-side data:

- Require current TripMembership for Trip-scoped actions.
- Derive `OWNER` / `MEMBER` from the current Membership row, never `trip.created_by`.
- A pending Invitation gives no Trip Workspace access.
- For nested resources, verify they belong to the Trip in the URL; do not reveal another Trip's resource through an otherwise valid ID.
- Recheck time-sensitive permissions and domain state inside the relevant transaction/lock boundary.
- Shared Membership lookup helpers may be factored out when they demonstrably reduce duplication, but must not become a premature universal authorization engine.

Follow the frozen role rules:

- **OWNER only:** invite User, delete Trip. OWNER cannot Leave (`409 OWNER_CANNOT_LEAVE`).
- **OWNER and MEMBER:** view Workspace resources, CRUD Activities, create Proposals, Vote on `PENDING` Proposals, request manual Adoption when rules permit.
- **Invitation:** only the target User can accept or reject.
- **Vote:** a User may change only their own Vote; no mutation once Proposal is `ACCEPTED`.
- **Adoption:** requires current Membership, valid related Trip/Day, the current strict majority, and an atomic transaction. REJECT Votes do not automatically reject the Proposal.

Authentication and authorization must preserve `401` versus `403` semantics and use frozen feature codes and cross-Trip `404` behavior.

### 5.3 Realtime permission boundary

HTTP global Guards do **not** automatically secure Socket.IO. Realtime uses the same cookie-backed identity but must independently authenticate connections and verify current TripMembership before room subscription. When Membership ends, protected room delivery must stop. REST remains the write interface; emit success notifications **only after database COMMIT**, never on rollback.

### 5.4 Ownership

The shared foundation owns authentication infrastructure and general HTTP error normalization. Every Vertical Slice Owner implements and tests their feature's Membership, role, resource-relationship, and transaction-sensitive authorization. Do not reimplement password/JWT/session logic in each feature.

## 6. Testing Expectations

### 6.1 Risk-based strategy (decision: B)

Tests follow the feature's risks and the frozen contracts. Do **not** impose every test category on every trivial helper. At minimum, test new business behavior and relevant negative/boundary cases; implemented REST endpoints also require HTTP-level verification. Higher-risk DB, permissions, realtime, and concurrency behavior requires deeper tests.

### 6.2 Unit / component tests

Use Vitest and mocks to test isolated DTO transformations, Service business rules, authorization decisions, calculations, state transitions, and expected error mapping. Include successes and failures. Mocks do not prove database locking or real transactions.

### 6.3 HTTP tests

For new REST endpoints, verify method/path/status, DTO validation, rejected extra fields, frozen error envelope/codes, missing authentication (`401`), denied permissions (`403` or frozen domain conflict where applicable), and cross-Trip resource isolation. Verify response bodies do not expose passwords, hashes, cookies, or unrelated user data.

### 6.4 Database tests (decision: C)

Use real PostgreSQL for behavior that depends on actual constraints or database semantics, while keeping isolated logic tests mock-based. Test applicable foreign/unique constraints, migrations, transaction rollback/commit, lock ordering and concurrency, optimistic version checks, and cross-resource invariants.

Reuse the established `TEST_DATABASE_URL` / `test:db:prepare` / `test:db` setup; it only accepts designated `_test` databases. Do not run destructive test setup against development or production databases.

The frozen database contract additionally defines required feature-specific invariant tests. In particular, Trip creation, Invitation acceptance/Leave, Activity OCC, Proposal Vote, Adoption/rollback/double-Adopt, and Proposal reopen need real behavior validation when implemented.

### 6.5 Realtime and concurrency tests

For relevant features, verify authenticated room subscription, denial to non-members, timely removal of former Members, correct event payloads, resubscription/resync, and no success event before a successful commit. Failed mutations or rollbacks must produce no success event. Concurrent Proposal Adoption must produce at most one current Proposal-sourced Activity.

### 6.6 End-to-end user journeys

Use HTTP E2E for the actual backend request boundary and browser E2E for important user-facing workflows, without mechanically duplicating all Unit Tests.

**Already in `main`:** PR #55 added Playwright/Chromium Auth browser E2E tests, an isolated Docker test stack (`compose.e2e.yml` / `.env.e2e.example`), and a `Browser E2E checks` CI job. Reuse this infrastructure for appropriate future flows. Follow [`e2e/README.md`](../../e2e/README.md); do not start a second test framework.

### 6.7 CI and Definition of Done

The current repository runs backend Prisma validation/generation, dedicated DB tests, lint, build, Unit Tests and HTTP E2E tests, plus frontend, container and browser E2E checks. Required CI jobs must pass before merge, and at least one non-author PR approval is required.

Every PR should state what was tested, what was deliberately not tested, and follow-up coverage as applicable. Never replace meaningful checks with placeholders. Changes to shared validation, error handling, or global Auth Guard need regression tests for current Auth behavior; existing Playwright tests should be rerun rather than rewritten unnecessarily.

### 6.8 Test ownership

Each Vertical Slice Owner maintains feature-specific tests. Shared infrastructure tests belong to the shared implementation issue (#41). Follow-up validation and practical usage documentation belong to #42.

## 7. Implementation Boundary and Contract References

- **#40:** conventions and documentation only; no runtime behavior change.
- **#41:** minimal shared implementation alignment (global validation, error normalization, global guard + public markers), with regression tests. Preserve existing Auth APIs and cookie behavior.
- **#42:** practical feature guide, final documentation/implementation consistency review, and required CI verification.

Frozen sources:

- [`01-ARCHITECTURE.md`](../contracts/01-ARCHITECTURE.md)
- [`03-AUTH_CONTRACT.md`](../contracts/03-AUTH_CONTRACT.md)
- [`04-DATABASE_CONTRACT.md`](../contracts/04-DATABASE_CONTRACT.md)
- [`05-REST_API_CONTRACT.md`](../contracts/05-REST_API_CONTRACT.md)
- [`06-REALTIME_CONTRACT.md`](../contracts/06-REALTIME_CONTRACT.md)
- [`07-SHARED_TYPES.md`](../contracts/07-SHARED_TYPES.md)
- [`08-ENVIRONMENT_AND_WORKFLOW.md`](../contracts/08-ENVIRONMENT_AND_WORKFLOW.md)

Any discovered conflict with a frozen contract must be proposed and reviewed separately under the existing Contract Change Rule; this document is not a vehicle for silently changing those contracts.
