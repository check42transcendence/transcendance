# Browser E2E Tests

Playwright runs Chromium against the real frontend, backend, and PostgreSQL.
- `auth.spec.ts`: registration, login, session restoration, logout, and protected-route redirects.
- `trips.spec.ts`: login, Trip creation, Owner/Days display, Workspace refresh,
  deletion cancellation, confirmed deletion, and the updated Home list after refresh.
- `validation.spec.ts`: invalid Auth requests through the API.

Keep browser tests focused on core user journeys. Detailed validation, membership
permissions, atomic Trip creation, and database cleanup are covered by frontend
and backend Vitest tests. Activity and Invitation cleanup must be verified when
those models are integrated.

## Run locally

Use Docker with Compose. Run all commands from the repository root
(on macOS, use the Mac terminal). No local Node.js or browser installation
is needed for this workflow.

Generate the local certificate if `certs/localhost.crt` and
`certs/localhost.key` do not already exist:

```bash
sh scripts/generate-local-cert.sh
```

Start the isolated test application:

```bash
docker compose \
  --project-name transcendence-e2e \
  --env-file .env.e2e.example \
  --file compose.e2e.yml \
  up --build --detach --wait backend frontend
```

Compose starts the test database, applies committed migrations, and waits
for the backend and frontend to become healthy. The migration container
normally exits with code `0` after completing its task.

Run all browser tests:

```bash
docker compose \
  --project-name transcendence-e2e \
  --env-file .env.e2e.example \
  --file compose.e2e.yml \
  run --build --rm --no-deps -T e2e
```

Expect all tests to pass. Chromium runs without a visible window.
`--rm` removes only the temporary test runner container.

## Test environment

- `.env.e2e.example` contains test-only settings; no changes to `.env` are needed.
- The database is `transcendence_e2e_test`, with its own Docker data volume.
- The test runner accesses `https://frontend` inside the test network.
  For manual checks, the Mac host can use `https://localhost:9443`.
- Self-signed certificate errors are ignored by the test browser only.
- Auth and Trip tests each create a uniquely named account. Test accounts remain until
  the test database volume is removed.

The Docker workflow does not require connecting your development container
to the test network or running migrations manually.

## Failure records and CI

Failed tests retain traces under `e2e/test-results/`, which is ignored by Git.
The trace survives removal of the test runner container.

GitHub Actions runs the same workflow in `Browser E2E checks`, uploads
failure records as `auth-e2e-results` for seven days, and cleans up the test
containers and database volume afterward.

## Clean up

After testing, remove the test stack and its data:

If the development container was manually attached during initial setup,
disconnect it first:
`docker network disconnect transcendence-e2e_default transcendence-dev`.

```bash
docker compose \
  --project-name transcendence-e2e \
  --env-file .env.e2e.example \
  --file compose.e2e.yml \
  down --volumes --remove-orphans
```

This deletes E2E database data, including test accounts, while preserving
the development database. Omit `--volumes` to keep test data.

See the [project README](../README.md) for application setup and
[Playwright documentation](https://playwright.dev/docs/intro) for the test tool.
