# Backend Feature Audit — Issue #39

**Status:** Completed documentation audit; merged in PR #54\
**Parent:** [#36 — Backend Feature Foundation](https://github.com/check42transcendence/transcendence/issues/36)  
**Issue:** [#39 — Audit Backend Feature Structure](https://github.com/check42transcendence/transcendence/issues/39)  
**Baseline:** `main`, following the merge of [Auth PR #15](https://github.com/check42transcendence/transcendence/pull/15) (2026-10-21) and [Database Test PR #35](https://github.com/check42transcendence/transcendence/pull/35) (2026-10-20)  
**Review date:** 2026-10-22

This is a historical audit of the baseline below. Findings and follow-up text
record that snapshot; use the current backend guide and source for today's status.

## 1. Purpose and Scope

Review the merged NestJS Auth and database implementation as a practical reference for future Vertical Slices. Identify existing patterns, unclear boundaries, duplication, and follow-up work against the frozen P0 contracts.

**Audit only:** no changes to backend behavior, implementation, or frozen contracts are proposed in this issue. The audit describes what was inspected; it is not a certification of all security or concurrency behavior.

## 2. Audit Checklist

### Architecture
- [x] Controller responsibilities and separation from Prisma
- [x] Service responsibilities and dependency injection
- [x] Repository / Prisma responsibilities
- [x] Module organization and exports

### Validation
- [x] Request DTO structure and runtime validation
- [x] Input normalization and validation errors in Auth
- [x] Identify duplicate validation configuration

### Authentication and Authorization
- [x] JWT Cookie, authentication Guard, and current-user identity
- [x] Identify the boundary between authentication and domain authorization
- [ ] Verify Trip Membership / Owner / Member authorization (no corresponding business feature implementation to audit yet)

### Errors
- [x] Database unique-constraint conflict conversion
- [x] Auth domain-to-HTTP error conversion
- [x] Compare error behavior against the frozen REST contract
- [ ] Verify standardized responses for every unexpected error and malformed request (shared handling is not established)

### Tests and CI
- [x] Review Auth and Repository tests
- [x] Review the database test foundation and CI configuration
- [x] Confirm successful PR #15 CI result
- [ ] Verify a complete real-database Auth flow E2E suite (not established by the inspected tests)

## 3. Existing Backend Structure

| File or directory | Current responsibility |
| --- | --- |
| `backend/src/main.ts` | Bootstraps NestJS, registers cookie parsing, sets `/api` prefix |
| `backend/src/app.module.ts` | Imports application-level modules |
| `backend/src/auth/auth.controller.ts` | Handles registration, login, logout, and current-user HTTP endpoints |
| `backend/src/auth/dto/` | Auth request validation and input transformation |
| `backend/src/auth/auth.service.ts` | Coordinates account creation, credential checks, and current-user lookup |
| `backend/src/auth/auth.dependencies.ts` | Provides repository and password service abstraction tokens |
| `backend/src/auth/auth-session.service.ts` | Signs JWTs, sets login cookies, and clears logout cookies |
| `backend/src/auth/guards/jwt-auth.guard.ts` | Verifies cookie JWT and places authenticated identity on the request |
| `backend/src/auth/decorators/current-user.decorator.ts` | Extracts authenticated identity from the request |
| `backend/src/auth/auth.module.ts` | Wires Auth providers, JWT support, and imported user storage |
| `backend/src/users/users.repository.ts` | Implements User reads/writes using Prisma and translates recognized unique conflicts |
| `backend/src/users/users.module.ts` | Exports `UsersRepository` to importing modules |
| `backend/src/database/prisma.service.ts` | Provides Prisma Client and database connection lifecycle |
| `backend/src/database/prisma.module.ts` | Exports shared `PrismaService` |
| `backend/prisma/` | Prisma schema and committed migrations |
| `backend/test/` | App E2E and database-oriented tests/helpers |

### Observed data-access flow

```text
HTTP request
  → AuthController
  → AuthService
  → AuthUserRepository (injection token)
  → UsersRepository (concrete implementation)
  → PrismaService
  → PostgreSQL
```

Protected requests also pass through `JwtAuthGuard`; login/logout use `AuthSessionService` to manage cookies. This is a description of the current Auth flow, not a requirement that every future feature use the same Auth-specific helpers.

## 4. Findings

### 4.1 Database Foundation — PrismaService / PrismaModule

**Files:**
- `backend/src/database/prisma.service.ts`
- `backend/src/database/prisma.module.ts`
- `backend/src/users/users.module.ts`

- [x] `PrismaService` extends the generated Prisma Client and uses the PostgreSQL adapter.
- [x] Connection details come from `DATABASE_URL`, not hard-coded credentials.
- [x] Module lifecycle hooks connect and disconnect Prisma.
- [x] `PrismaModule` registers and exports `PrismaService`.
- [x] `UsersModule` imports `PrismaModule` and exports `UsersRepository`.

**Assessment:** Shared database connection infrastructure is already present and reusable. Feature repositories should inject the existing Prisma service instead of constructing separate Prisma Clients in application code. This finding does **not** assess all database transaction and migration invariants.

### 4.2 UsersRepository — Data Access and Error Boundary

**Files:**
- `backend/src/users/users.repository.ts`
- `backend/src/users/auth-user-conflict.error.ts`
- `backend/src/users/users.repository.spec.ts`
- `backend/test/users.repository.e2e-spec.ts`
- `backend/prisma/migrations/20261012230150_create_user/migration.sql`

- [x] Repository obtains `PrismaService` through dependency injection.
- [x] User lookups and creation are implemented through Prisma within the repository.
- [x] Email and username are trimmed before lookup/storage; queries request case-insensitive matching.
- [x] Committed SQL migrations create case-insensitive unique indexes for email and username.
- [x] Known Prisma `P2002` conflicts are mapped to `AuthUserConflictError('email' | 'username')`.
- [x] Unrecognized errors are rethrown rather than silently converted to known conflicts.
- [x] Repository unit tests and PostgreSQL-backed matching tests exist.

**Assessment:** User persistence follows a reasonable separation between database access and application-facing errors. Password hashing is not performed inside the repository. Keep detailed constraint enforcement and edge-case verification in relevant feature/database tests.

### 4.3 Auth Controller, DTO, Service, and Module

**Files:**
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/dto/register.dto.ts`
- `backend/src/auth/dto/login.dto.ts`
- `backend/src/auth/auth.dependencies.ts`
- `backend/src/auth/auth.module.ts`

- [x] Controller receives HTTP requests and delegates user operations to `AuthService`.
- [x] Auth Controller does not directly run Prisma queries.
- [x] DTOs use `class-validator` and `class-transformer` for runtime input validation and normalization.
- [x] `AuthService` accesses user storage and password functions through injected abstraction tokens.
- [x] `AuthModule` provides the bindings required for the concrete implementations.
- [x] Returned Auth user objects do not expose `passwordHash`.
- [x] Validation errors from the Auth endpoint pipes use the canonical `400 VALIDATION_ERROR` structure.

**Improvement:** `register` and `login` each inline substantially the same `ValidationPipe` configuration. Future features should not copy this configuration repeatedly; decide on a consistent validation strategy before introducing many more DTOs.

### 4.4 Authentication and Authorization

**Files:**
- `backend/src/auth/auth-session.service.ts`
- `backend/src/auth/guards/jwt-auth.guard.ts`
- `backend/src/auth/decorators/current-user.decorator.ts`
- `backend/src/auth/utils/password.util.ts`

- [x] Password hashing and verification use bcrypt.
- [x] Successful login issues a JWT in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie.
- [x] `GET /api/auth/me` is protected by `JwtAuthGuard`.
- [x] Guard verifies the token and checks the subject is a UUID before exposing identity.
- [x] `CurrentUser` reads the authenticated identity attached to the request.
- [ ] Trip Membership and role-based checks have not yet been demonstrated by a completed Trip feature.

**Boundary:** JWT authentication establishes **who** the user is. Feature authorization must independently determine **what** the user can do, based on current database Membership/roles, not an unverified client-provided role or an assumed permanent JWT role.

**Note:** Current logout clears the cookie but does not revoke an already-issued JWT; this behavior is also documented in `backend/README.md`. Any change to that security model should be a separately reviewed decision.

### 4.5 Domain Errors and API Errors

- [x] `UsersRepository` translates recognized DB uniqueness failures into `AuthUserConflictError`.
- [x] `AuthService` maps known conflicts to `409 EMAIL_ALREADY_EXISTS` / `USERNAME_ALREADY_EXISTS`.
- [x] Unknown email and incorrect password share `401 INVALID_CREDENTIALS` semantics.
- [x] Missing/invalid authentication uses `401 AUTHENTICATION_REQUIRED`.
- [ ] There is no shared global exception filter in the inspected bootstrap path to guarantee the frozen `{ "error": { "code", "message", "details" } }` envelope for every unexpected exception.

**Improvement:** Establish a consistent application-wide API error approach without changing the existing stable Auth endpoint contracts. Feature-specific domain errors remain the responsibility of the owning Vertical Slice.

### 4.6 Tests and CI

**Reviewed tests:**
- `backend/src/auth/auth.controller.spec.ts`
- `backend/src/auth/auth.service.spec.ts`
- `backend/src/auth/dto/register.dto.spec.ts`
- `backend/src/users/users.repository.spec.ts`
- `backend/test/users.repository.e2e-spec.ts`
- `backend/test/database/database.db-spec.ts`

- [x] Auth route tests cover login/session, logout, authenticated `/me`, and authentication failures with mocked User storage.
- [x] Auth Service tests cover successful paths and duplicate account conflicts.
- [x] Register DTO tests cover transformations and invalid input.
- [x] Repository tests cover lookup normalization, uniqueness-error mapping, and unexpected errors.
- [x] The database test foundation provides a dedicated `_test` database workflow.
- [x] GitHub Actions includes Prisma validation/generation, database tests, lint, build, unit tests, and E2E tests.
- [x] The last inspected PR #15 head CI run concluded `success`.
- [ ] The inspected suite does not demonstrate a full real-PostgreSQL register → login → protected request → logout E2E test; do not claim this coverage from mocked-controller tests alone.

**Assessment:** Existing tests offer a meaningful baseline. Deeper integration, permissions, cross-resource access, and concurrency tests belong to the relevant future features.

## 5. Contract Alignment

The implementation was reviewed against these frozen P0 sources:

- [`01-ARCHITECTURE.md`](https://github.com/check42transcendence/transcendence/blob/main/docs/contracts/01-ARCHITECTURE.md) — backend/domain/database responsibilities.
- [`03-AUTH_CONTRACT.md`](https://github.com/check42transcendence/transcendence/blob/main/docs/contracts/03-AUTH_CONTRACT.md) — identity, JWT cookie, Membership/role authorization.
- [`04-DATABASE_CONTRACT.md`](https://github.com/check42transcendence/transcendence/blob/main/docs/contracts/04-DATABASE_CONTRACT.md) — Prisma, constraints, transactions, and migrations.
- [`05-REST_API_CONTRACT.md`](https://github.com/check42transcendence/transcendence/blob/main/docs/contracts/05-REST_API_CONTRACT.md) — API status and error envelope.
- [`07-SHARED_TYPES.md`](https://github.com/check42transcendence/transcendence/blob/main/docs/contracts/07-SHARED_TYPES.md) — types and runtime validation.
- [`08-ENVIRONMENT_AND_WORKFLOW.md`](https://github.com/check42transcendence/transcendence/blob/main/docs/contracts/08-ENVIRONMENT_AND_WORKFLOW.md) — CI and development conventions.

**Result:** The merged Auth and Prisma code provides a viable starting pattern. Duplicate validation configuration, general error normalization, and future domain authorization are **follow-up implementation/convention topics**, not reasons to reimplement Auth within #39.

## 6. Recommendations and Follow-up Ownership

1. **Reuse the current layering:** Controller → Service → Repository/Prisma; keep persistence details out of HTTP controllers.
2. **Standardize validation:** agree on shared `ValidationPipe` behavior and canonical `400` errors without introducing unnecessary abstractions.
3. **Normalize API errors:** keep stable machine codes and distinguish domain conflicts from unexpected infrastructure failures.
4. **Define the authorization boundary:** authenticated identity from the Guard; current Membership/role and domain checks in the appropriate owning feature.
5. **Preserve Vertical Slice ownership:** each feature owner implements their own DTOs, services, persistence, tests, and domain rules.
6. **Test by layer:** DTO/unit/HTTP tests where appropriate, plus database and integration tests for real constraints, permissions, and transactions.

**Tracked follow-up work (under parent #36):**

- **Backend Feature Conventions:** document the team-wide responsibilities and structure.
- **Backend Shared Implementation Alignment:** make minimal shared code changes **only if necessary**; do not duplicate ongoing feature implementation.
- **Backend Feature Guide & Validation:** give future owners a practical example and verify final documentation against implementation and CI.

## 7. Conclusion

**Audit findings complete.** The merged backend has a usable feature structure, shared Prisma integration, Auth validation and JWT identity support, and a functioning test/CI baseline. The identified gaps can be handled in the remaining Backend Feature Foundation sub-issues without an immediate broad refactor.

**Issue #39 is ready for documentation PR review.** Mark it Done only after the required PR approval, CI checks, and merge to `main`.
