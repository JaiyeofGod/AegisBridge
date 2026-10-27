FROM node:24.22.0-bookworm-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.18.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web apps/web

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    AEGIS_REQUIRE_PUBLIC_API=1

RUN pnpm install --frozen-lockfile \
    && pnpm --filter @aegisbridge/web build

FROM nginx:1.28-alpine

COPY apps/web/nginx/40-security-headers.sh /docker-entrypoint.d/40-security-headers.sh
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY --from=build /app/apps/web/dist/content-security-policy.txt /opt/aegis/content-security-policy.txt

RUN chmod 755 /docker-entrypoint.d/40-security-headers.sh \
    && rm -f /etc/nginx/conf.d/default.conf

EXPOSE 80
