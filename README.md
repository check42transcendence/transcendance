*This project has been created as part of the 42 curriculum by yihe, weiyang, yuczhang, yzhang2, and zhma.*

# Travel Planner

## Description

A collaborative travel planning platform for small groups who have
already decided to travel together.

The planned core features include trip workspaces, shared itineraries,
proposals, voting, and trip chat.

## Current Status

Currently implemented:

- React frontend with TypeScript and Vite.
- NestJS backend with TypeScript.
- `GET /api/health` endpoint.
- Frontend connectivity check with success and failure states.
- Vite development proxy for local `/api` requests.
- Production frontend image served by Nginx.
- Production backend image running as a non-root user.
- PostgreSQL container with persistent storage.
- Docker Compose startup, service health checks, and internal networking.
- GitHub Actions checks for the frontend, backend, and containerized stack.

Prisma integration, authentication, travel features, real-time
collaboration, and HTTPS are not implemented yet.

The current containerized stack uses HTTP for local development.
HTTPS will be added in a separate infrastructure change.

## Project Structure

- `frontend/`: React application, frontend Dockerfile, and Nginx configuration.
- `backend/`: NestJS application and backend Dockerfile.
- `compose.yml`: frontend, backend, and PostgreSQL services.
- `.env.example`: example local environment configuration.
- `.nvmrc`: Node.js version used for development.
- `.github/workflows/ci.yml`: automated project checks.

## Containerized Application

### Prerequisites

- Git.
- Docker with Docker Compose support.

Create the local environment file:

```bash
cp .env.example .env
```

Replace the example PostgreSQL password in `.env` with a local
development password. The `.env` file is ignored by Git and must not
be committed.

Build and start the complete application:

```bash
docker compose up --build
```

Open:

```text
http://localhost:8080
```

The backend health endpoint is available through the Nginx gateway at:

```text
http://localhost:8080/api/health
```

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

Start the backend in one terminal:

```bash
cd backend
npm ci
npm run start:dev
```

Start the frontend in another terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173` and click **Check backend**.

The local backend health endpoint is available at:

```text
http://localhost:3000/api/health
```

The Vite development proxy targets `127.0.0.1:3000`. The frontend
development server and backend must therefore run on the same host
or inside the same development container.

## Validation

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Backend:

```bash
cd backend
npm run lint
npm run build
npm test
npm run test:e2e
```

Containerized stack:

```bash
docker compose config --quiet
docker compose up --build --detach --wait
curl --fail http://127.0.0.1:8080/api/health
docker compose down
```

## Continuous Integration

GitHub Actions runs the following jobs for pull requests targeting
`main` and for pushes to `main`:

- `Frontend checks`: dependency installation, lint, and production build.
- `Backend checks`: dependency installation, lint, build, unit tests,
  and end-to-end tests.
- `Container checks`: Compose validation, image builds, service startup,
  health checks, and HTTP verification through the Nginx gateway.

## Resources

- React: https://react.dev/
- Vite: https://vite.dev/
- NestJS: https://docs.nestjs.com/
- Docker Compose: https://docs.docker.com/compose/
- PostgreSQL: https://www.postgresql.org/docs/
- Nginx: https://nginx.org/en/docs/

AI assistance was used to help draft the initial product proposal,
guide development environment setup, troubleshoot installation issues,
and explain and provide starter infrastructure configuration.
