#!/usr/bin/env bash
# Install HTMLSignage stack
set -euo pipefail

log(){ printf '\033[1;34m[INFO]\033[0m %s\n' "$*"; }
error(){ printf '\033[1;31m[ERR ]\033[0m %s\n' "$*" >&2; }

require_root(){
  if [[ $EUID -ne 0 ]]; then
    error "Run as root"
    exit 1
  fi
}

main(){
  require_root
  umask 022

  SIGNAGE_PUBLIC_PORT=${SIGNAGE_PUBLIC_PORT:-80}
  SIGNAGE_ADMIN_PORT=${SIGNAGE_ADMIN_PORT:-8888}
  SIGNAGE_ADMIN_USER=${SIGNAGE_ADMIN_USER:-admin}
  SIGNAGE_ADMIN_PASS=${SIGNAGE_ADMIN_PASS:-admin}
  PHP_SOCK=${PHP_SOCK:-/run/php/php8.3-fpm.sock}
  APP_DIR=/var/www/signage

  if [[ -t 0 ]]; then
    read -rp "Public port [${SIGNAGE_PUBLIC_PORT}]: " input
    SIGNAGE_PUBLIC_PORT=${input:-$SIGNAGE_PUBLIC_PORT}

    read -rp "Admin port [${SIGNAGE_ADMIN_PORT}]: " input
    SIGNAGE_ADMIN_PORT=${input:-$SIGNAGE_ADMIN_PORT}

    read -rp "Admin username [${SIGNAGE_ADMIN_USER}]: " input
    SIGNAGE_ADMIN_USER=${input:-$SIGNAGE_ADMIN_USER}

    read -rsp "Admin password [${SIGNAGE_ADMIN_PASS}]: " input
    echo
    SIGNAGE_ADMIN_PASS=${input:-$SIGNAGE_ADMIN_PASS}
  fi

  log "Installing packages"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y nginx php8.3-fpm php8.3-cli php8.3-xml php8.3-mbstring php8.3-curl jq unzip curl git rsync

  log "Deploying application files"
  rsync -a webroot/ "$APP_DIR"/
  chown -R www-data:www-data "$APP_DIR"
  find "$APP_DIR" -type d -exec chmod 2755 {} +
  find "$APP_DIR" -type f -exec chmod 0644 {} +

  log "Deploying nginx configuration"
  install -d /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/nginx/snippets
  cp config/nginx/signage-slideshow.conf /etc/nginx/sites-available/
  cp config/nginx/signage-admin.conf /etc/nginx/sites-available/
  cp config/nginx/snippets/signage-pairing.conf /etc/nginx/snippets/
  sed -i "s/__PUBLIC_PORT__/${SIGNAGE_PUBLIC_PORT}/" /etc/nginx/sites-available/signage-slideshow.conf
  sed -i "s/__ADMIN_PORT__/${SIGNAGE_ADMIN_PORT}/" /etc/nginx/sites-available/signage-admin.conf
  sed -i "s|__PHP_SOCK__|${PHP_SOCK}|" /etc/nginx/sites-available/signage-admin.conf /etc/nginx/snippets/signage-pairing.conf
  ln -sf /etc/nginx/sites-available/signage-slideshow.conf /etc/nginx/sites-enabled/signage-slideshow.conf
  ln -sf /etc/nginx/sites-available/signage-admin.conf /etc/nginx/sites-enabled/signage-admin.conf
  rm -f /etc/nginx/sites-enabled/default

  log "Configuring PHP limits"
  cat >/etc/php/8.3/fpm/conf.d/zz-signage.ini <<'EOPHP'
upload_max_filesize = 256M
post_max_size       = 256M
memory_limit        = 512M
max_execution_time  = 120
max_input_time      = 120
expose_php = Off
EOPHP
  systemctl reload php8.3-fpm

  log "Configuring basic auth"
  if [[ ! -f /etc/nginx/.signage_admin ]]; then
    printf "%s:%s\n" "$SIGNAGE_ADMIN_USER" "$(openssl passwd -apr1 "$SIGNAGE_ADMIN_PASS")" > /etc/nginx/.signage_admin
    chmod 640 /etc/nginx/.signage_admin
  fi

  nginx -t
  systemctl reload nginx

  IP=$(hostname -I | awk '{print $1}')
  cat <<EOF

Installation complete.

Admin UI:   http://${IP}:${SIGNAGE_ADMIN_PORT}/admin/ (user: ${SIGNAGE_ADMIN_USER})
Slideshow:  http://${IP}:${SIGNAGE_PUBLIC_PORT}/

Configs:
  /etc/nginx/sites-available/signage-admin.conf
  /etc/nginx/sites-available/signage-slideshow.conf
  /etc/nginx/snippets/signage-pairing.conf

Change admin password:
  htpasswd /etc/nginx/.signage_admin ${SIGNAGE_ADMIN_USER}
  systemctl reload nginx

EOF
}

main "$@"
