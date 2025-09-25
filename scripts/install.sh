#!/usr/bin/env bash
# Install HTMLSignage stack
set -euo pipefail

log(){ printf '\033[1;34m[INFO]\033[0m %s\n' "$*"; }
error(){ printf '\033[1;31m[ERR ]\033[0m %s\n' "$*" >&2; }

trap 'error "Installation failed (line $LINENO)."; exit 1' ERR

require_root(){
  if [[ $EUID -ne 0 ]]; then
    error "Run as root"
    exit 1
  fi
}

prompt_for(){
  local var default prompt silent input
  var=$1; default=$2; prompt=$3; silent=${4:-0}
  if [[ $silent -eq 1 ]]; then
    read -rsp "${prompt} [${default}]: " input
    echo
  else
    read -rp "${prompt} [${default}]: " input
  fi
  printf -v "$var" '%s' "${input:-$default}"
}

sed_escape(){
  printf '%s' "$1" | sed -e 's/[\\/|&]/\\&/g'
}

replace_placeholder(){
  local file=$1 token=$2 value
  value=$(sed_escape "$3")
  sed -i "s|${token}|${value}|g" "$file"
}

install_packages(){
  log "Installing packages"
  export DEBIAN_FRONTEND=noninteractive
  local packages=(
    nginx
    php8.3-fpm
    php8.3-cli
    php8.3-xml
    php8.3-mbstring
    php8.3-curl
    php8.3-gd
    jq
    unzip
    curl
    git
    rsync
    openssl
  )
  apt-get update -y
  apt-get install -y "${packages[@]}"
}

deploy_application(){
  log "Deploying application files"
  install -d "$APP_DIR"
  rsync -a webroot/ "$APP_DIR"/
  chown -R www-data:www-data "$APP_DIR"
  find "$APP_DIR" -type d -exec chmod 2755 {} +
  find "$APP_DIR" -type f -exec chmod 0644 {} +
  replace_placeholder "$APP_DIR/admin/index.html" "__PUBLIC_PORT__" "$SIGNAGE_PUBLIC_PORT"
}

deploy_nginx(){
  log "Deploying nginx configuration"
  install -d /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/nginx/snippets
  install -m 0644 config/nginx/signage-slideshow.conf /etc/nginx/sites-available/signage-slideshow.conf
  install -m 0644 config/nginx/signage-admin.conf /etc/nginx/sites-available/signage-admin.conf
  install -m 0644 config/nginx/snippets/signage-pairing.conf /etc/nginx/snippets/signage-pairing.conf
  replace_placeholder /etc/nginx/sites-available/signage-slideshow.conf "__PUBLIC_PORT__" "$SIGNAGE_PUBLIC_PORT"
  replace_placeholder /etc/nginx/sites-available/signage-admin.conf "__ADMIN_PORT__" "$SIGNAGE_ADMIN_PORT"
  local php_targets=(
    /etc/nginx/sites-available/signage-admin.conf
    /etc/nginx/sites-available/signage-slideshow.conf
    /etc/nginx/snippets/signage-pairing.conf
  )
  for target in "${php_targets[@]}"; do
    replace_placeholder "$target" "__PHP_SOCK__" "$PHP_SOCK"
  done
  ln -sf /etc/nginx/sites-available/signage-slideshow.conf /etc/nginx/sites-enabled/signage-slideshow.conf
  ln -sf /etc/nginx/sites-available/signage-admin.conf /etc/nginx/sites-enabled/signage-admin.conf
  rm -f /etc/nginx/sites-enabled/default
}

configure_php(){
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
}

configure_basic_auth(){
  log "Configuring basic auth"
  if [[ ! -f /etc/nginx/.signage_admin ]]; then
    printf "%s:%s\n" "$SIGNAGE_ADMIN_USER" "$(openssl passwd -apr1 "$SIGNAGE_ADMIN_PASS")" > /etc/nginx/.signage_admin
  fi
  chown root:www-data /etc/nginx/.signage_admin
  chmod 640 /etc/nginx/.signage_admin
}

validate_and_reload(){
  nginx -t
  systemctl reload nginx
}

print_summary(){
  local IP
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

main(){
  require_root
  umask 022

  SIGNAGE_PUBLIC_PORT=${SIGNAGE_PUBLIC_PORT:-80}
  SIGNAGE_ADMIN_PORT=${SIGNAGE_ADMIN_PORT:-8888}
  SIGNAGE_ADMIN_USER=${SIGNAGE_ADMIN_USER:-admin}
  SIGNAGE_ADMIN_PASS=${SIGNAGE_ADMIN_PASS:-admin}
  PHP_SOCK=${PHP_SOCK:-/run/php/php8.3-fpm.sock}
  APP_DIR=${APP_DIR:-/var/www/signage}

  if [[ -t 0 ]]; then
    prompt_for SIGNAGE_PUBLIC_PORT "$SIGNAGE_PUBLIC_PORT" "Public port"
    prompt_for SIGNAGE_ADMIN_PORT "$SIGNAGE_ADMIN_PORT" "Admin port"
    prompt_for SIGNAGE_ADMIN_USER "$SIGNAGE_ADMIN_USER" "Admin username"
    prompt_for SIGNAGE_ADMIN_PASS "$SIGNAGE_ADMIN_PASS" "Admin password" 1
  fi

  install_packages
  deploy_application
  deploy_nginx
  configure_php
  configure_basic_auth
  validate_and_reload
  print_summary
}

main "$@"
