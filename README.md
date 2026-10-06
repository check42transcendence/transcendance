*This project has been created as part of the 42 curriculum by login1, login2, login3, login4, login5.*

# Travel Planner

## Description

A collaborative travel planning platform for small groups who have
already decided to travel together.

The planned core features include trip workspaces, shared itineraries,
proposals, voting, and trip chat.

## Current Status

The project is in its initial setup phase.

Currently implemented:
- React frontend with TypeScript and Vite.
- NestJS backend with TypeScript.
- GET /api/health endpoint.
- Frontend connectivity check with success and failure states.
- Vite development proxy for /api requests.

Database integration, authentication, travel features, HTTPS,
and single-command container deployment are not implemented yet.

## Project Structure

- frontend/: React application.
- backend/: NestJS application.
- .nvmrc: Node.js version used for development.

## Development Instructions

Prerequisites:
- Git.
- Node.js matching .nvmrc, with npm.
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

Start the frontend in another terminal, from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173 and click "Check backend".

The backend health endpoint is available at:
http://localhost:3000/api/health

The development proxy targets 127.0.0.1:3000.
The frontend development server and backend must currently run
on the same host or inside the same container.

When using a development container, publish ports 5173 and 3000
to the host.

## Build

Run `npm run build` inside each of the frontend and backend directories.

## Resources

- React: https://react.dev/
- Vite: https://vite.dev/
- NestJS: https://docs.nestjs.com/

AI assistance was used to help draft the initial product proposal,
guide development environment setup, troubleshoot installation issues,
and explain and provide starter code for the health endpoint and
frontend connectivity check.