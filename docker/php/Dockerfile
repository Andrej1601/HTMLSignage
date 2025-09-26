FROM php:8.2-fpm-alpine

RUN set -eux; \
    apk add --no-cache bash curl git icu-libs icu-data-full; \
    docker-php-ext-install opcache

WORKDIR /var/www/html

COPY --chown=www-data:www-data webroot/ /var/www/html/
COPY --chown=www-data:www-data config/php/opcache.ini /usr/local/etc/php/conf.d/opcache.ini

ENV PHP_OPCACHE_VALIDATE_TIMESTAMPS=1 \
    PHP_OPCACHE_MAX_ACCELERATED_FILES=20000 \
    PHP_OPCACHE_MEMORY_CONSUMPTION=256

CMD ["php-fpm"]
