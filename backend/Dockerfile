FROM node:24.21.0-bookworm-slim AS build

WORKDIR /app

COPY shared/ /shared/
RUN cd /shared && npm ci && npm run build

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/ ./
RUN DATABASE_URL=postgresql://transcendence:build_only@postgres:5432/transcendence \
    npm run prisma:generate
RUN npm run build


# Keeps development tools for database preparation.
FROM build AS migration

CMD ["npm", "run", "test:db:prepare"]


# Removes development dependencies for the application.
FROM build AS production-dependencies

RUN npm prune --omit=dev --omit=peer


FROM node:24.21.0-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY --from=build /shared /shared
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
