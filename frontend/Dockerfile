FROM node:24.21.0-bookworm-slim AS build

WORKDIR /app

COPY shared/ /shared/
RUN cd /shared && npm ci && npm run build

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


FROM nginx:1.30.5-alpine AS runtime

RUN apk add --no-cache curl

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
