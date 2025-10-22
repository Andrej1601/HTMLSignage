# syntax=docker/dockerfile:1.4

FROM node:20-alpine AS assets
WORKDIR /app

COPY package*.json ./
RUN npm install --include=dev --no-fund --no-audit

COPY vite.config.admin.js vite.config.player.js vitest.config.js ./
COPY scripts ./scripts
COPY webroot ./webroot

RUN npm run build:admin && npm run build:player

FROM nginx:1.25-alpine AS runtime

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=assets /app/webroot/ /var/www/html/

WORKDIR /var/www/html
