# syntax=docker/dockerfile:1.4

FROM node:20-alpine AS assets
WORKDIR /app

COPY package*.json ./
RUN npm install --include=dev --no-fund --no-audit

COPY vite.config.admin.js vite.config.player.js vitest.config.js ./
COPY scripts ./scripts
COPY webroot ./webroot

RUN npm run build:admin && npm run build:player

FROM php:8.2-fpm-alpine AS runtime

RUN set -eux; \
    apk add --no-cache bash curl git icu-libs icu-data-full; \
    docker-php-ext-install opcache

WORKDIR /var/www/html

COPY --from=assets --chown=www-data:www-data /app/webroot/ /var/www/html/
COPY --chown=www-data:www-data config/php/opcache.ini /usr/local/etc/php/conf.d/opcache.ini

ENV PHP_OPCACHE_VALIDATE_TIMESTAMPS=1 \
    PHP_OPCACHE_MAX_ACCELERATED_FILES=20000 \
    PHP_OPCACHE_MEMORY_CONSUMPTION=256

CMD ["php-fpm"]
