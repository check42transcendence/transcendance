# Shared Types

The `shared/` package contains TypeScript types shared between the frontend and backend.

Use it as the single source of truth for API request payloads, response objects, and common data structures.
Files such as `api/trips.types.ts` contain types; frontend request functions
remain in `frontend/src/api/trips.ts`. Consumers import from `@tripcollab/shared`.

## Usage

1. Add shared API types under `shared/src/api/` using the `*.types.ts` suffix.
2. Export them from `shared/src/index.ts`.
3. Import them in frontend and backend:

```ts
import type { LoginInput, CurrentUser } from "@tripcollab/shared";
```

4. Remove duplicated type definitions from frontend/backend when they are no longer needed.

## Build & Check

Run from the `shared/` directory:

```bash
npm ci
npm run typecheck
npm run build
```

Build the shared package before building frontend or backend.

**Note:** Shared types provide compile-time safety only. Keep backend runtime validation (e.g. DTO decorators) in place.
