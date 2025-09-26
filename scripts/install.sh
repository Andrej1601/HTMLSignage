#!/usr/bin/env bash
# Install HTMLSignage stack
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)

log(){ printf '\033[1;34m[INFO]\033[0m %s\n' "$*"; }
warn(){ printf '\033[1;33m[WARN]\033[0m %s\n' "$*"; }
error(){ printf '\033[1;31m[ERR ]\033[0m %s\n' "$*" >&2; }

declare -a CONFIG_KEYS=(
  SIGNAGE_PUBLIC_PORT
  SIGNAGE_ADMIN_PORT
  SIGNAGE_ADMIN_USER
  SIGNAGE_ADMIN_PASS
  PHP_SOCK
  APP_DIR
)

declare -A CONFIG_DEFAULTS=(
  [SIGNAGE_PUBLIC_PORT]=80
  [SIGNAGE_ADMIN_PORT]=8888
  [SIGNAGE_ADMIN_USER]=admin
  [SIGNAGE_ADMIN_PASS]=admin
  [PHP_SOCK]=/run/php/php8.3-fpm.sock
  [APP_DIR]=/var/www/signage
)

declare -A CONFIG_PROMPTS=(
  [SIGNAGE_PUBLIC_PORT]="Public port"
  [SIGNAGE_ADMIN_PORT]="Admin port"
  [SIGNAGE_ADMIN_USER]="Admin username"
  [SIGNAGE_ADMIN_PASS]="Admin password"
)

declare -A CONFIG_SILENT_PROMPT=(
  [SIGNAGE_ADMIN_PASS]=1
)

trap 'error "Installation failed (line $LINENO)."; exit 1' ERR

require_root(){
  if [[ $EUID -ne 0 ]]; then
    error "Run as root"
    exit 1
  fi
}

run_preflight(){
  local skip=${SKIP_PREFLIGHT:-0}
  for arg in "$@"; do
    if [[ $arg == "--skip-preflight" ]]; then
      skip=1
    fi
  done
  if [[ $skip -eq 1 ]]; then
    log "Skipping preflight checks"
    return
  fi
  if [[ -x "$(dirname "$0")/preflight.sh" ]]; then
    log "Running preflight checks"
    if ! "$(dirname "$0")/preflight.sh"; then
      error "Preflight checks failed"
      exit 1
    fi
  else
    warn "Preflight script not found; continuing"
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

load_defaults(){
  local key
  for key in "${CONFIG_KEYS[@]}"; do
    printf -v "$key" '%s' "${!key:-${CONFIG_DEFAULTS[$key]}}"
  done
}

collect_settings(){
  load_defaults
  if [[ -t 0 ]]; then
    local key prompt silent
    for key in "${CONFIG_KEYS[@]}"; do
      prompt=${CONFIG_PROMPTS[$key]:-}
      [[ -z $prompt ]] && continue
      silent=${CONFIG_SILENT_PROMPT[$key]:-0}
      prompt_for "$key" "${!key}" "$prompt" "$silent"
    done
  fi
}

sed_escape(){
  printf '%s' "$1" | sed -e 's/[\\/|&]/\\&/g'
}

replace_placeholder(){
  local file=$1 token=$2 value
  value=$(sed_escape "$3")
  sed -i "s|${token}|${value}|g" "$file"
}

replace_placeholders(){
  local file=$1
  shift
  while (($#)); do
    replace_placeholder "$file" "$1" "$2"
    shift 2 || true
  done
}

install_template(){
  local src=$1 dest=$2 mode=${3:-0644}
  install -m "$mode" "$src" "$dest"
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
  replace_placeholders "$APP_DIR/admin/index.html" \
    "__PUBLIC_PORT__" "$SIGNAGE_PUBLIC_PORT"
}

deploy_nginx(){
  log "Deploying nginx configuration"
  install -d /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/nginx/snippets
  install_template config/nginx/signage-slideshow.conf /etc/nginx/sites-available/signage-slideshow.conf
  install_template config/nginx/signage-admin.conf /etc/nginx/sites-available/signage-admin.conf
  install_template config/nginx/snippets/signage-pairing.conf /etc/nginx/snippets/signage-pairing.conf

  replace_placeholders /etc/nginx/sites-available/signage-slideshow.conf \
    "__PUBLIC_PORT__" "$SIGNAGE_PUBLIC_PORT" \
    "__PHP_SOCK__" "$PHP_SOCK"

  replace_placeholders /etc/nginx/sites-available/signage-admin.conf \
    "__ADMIN_PORT__" "$SIGNAGE_ADMIN_PORT" \
    "__PHP_SOCK__" "$PHP_SOCK"

  replace_placeholders /etc/nginx/snippets/signage-pairing.conf \
    "__PHP_SOCK__" "$PHP_SOCK"

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

seed_admin_user(){
  log "Registering admin account in application store"

  local user_script="$SCRIPT_DIR/users.php"
  if [[ ! -f "$user_script" ]]; then
    warn "User management helper not found; skipping admin registration"
    return
  fi

  local php_cli=""
  if command -v php >/dev/null 2>&1; then
    php_cli=$(command -v php)
  elif command -v php8.3 >/dev/null 2>&1; then
    php_cli=$(command -v php8.3)
  else
    warn "PHP CLI not available; skipping admin registration"
    return
  fi

  local seed_log
  seed_log=$(mktemp -t signage-seed.XXXXXX || true)
  if [[ -z "$seed_log" ]]; then
    warn "Unable to create temporary file; skipping admin registration"
    return
  fi
  install -d -m 2775 "$APP_DIR/data"
  chown www-data:www-data "$APP_DIR/data" 2>/dev/null || true
  if ! SIGNAGE_BASE_PATH="$APP_DIR" \
       SIGNAGE_USER_PASSWORD="$SIGNAGE_ADMIN_PASS" \
       SIGNAGE_USER_PASSWORD_CONFIRM="$SIGNAGE_ADMIN_PASS" \
       "$php_cli" "$user_script" add "$SIGNAGE_ADMIN_USER" admin >"$seed_log" 2>&1; then
    warn "Unable to register admin account; rerun '$php_cli scripts/users.php add $SIGNAGE_ADMIN_USER admin' manually"
    cat "$seed_log" >&2 || true
    rm -f "$seed_log"
    return
  fi

  rm -f "$seed_log"

  local users_file="$APP_DIR/data/users.json"
  if [[ -f "$users_file" ]]; then
    chown www-data:www-data "$users_file" 2>/dev/null || true
    chmod 640 "$users_file" 2>/dev/null || true
  fi

  local audit_file="$APP_DIR/data/audit.log"
  if [[ -f "$audit_file" ]]; then
    chown www-data:www-data "$audit_file" 2>/dev/null || true
    chmod 640 "$audit_file" 2>/dev/null || true
  fi
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

  run_preflight "$@"

  collect_settings

  install_packages
  deploy_application
  deploy_nginx
  configure_php
  configure_basic_auth
  seed_admin_user
  validate_and_reload
  print_summary
}

main "$@"
