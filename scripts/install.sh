#!/usr/bin/env bash
# Install HTMLSignage stack
set -euo pipefail
IFS=$'\n\t'

log()   { printf '\033[1;34m[INFO]\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m[WARN]\033[0m %s\n' "$*"; }
error() { printf '\033[1;31m[ERR ]\033[0m %s\n' "$*" >&2; }

on_error() {
  local exit_code=$?
  local line=${1:-?}
  error "Installation failed at line ${line}. Review the output above for details." 
  exit "${exit_code}"
}

require_root() {
  if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
    error "Run as root"
    exit 1
  fi
}

normalize_port() {
  local value=$1
  if [[ ! $value =~ ^[0-9]+$ ]]; then
    return 1
  fi
  if (( value < 1 || value > 65535 )); then
    return 1
  fi
  printf '%s' "$value"
}

prompt_port() {
  local prompt=$1
  local default=$2
  local input sanitized
  while true; do
    read -rp "${prompt} [${default}]: " input || return 1
    input=${input:-$default}
    if sanitized=$(normalize_port "$input"); then
      printf '%s' "$sanitized"
      return 0
    fi
    warn "Please enter a valid TCP port (1-65535)."
  done
}

prompt_value() {
  local prompt=$1
  local default=$2
  local is_secret=${3:-false}
  local flag="-rp"
  if [[ $is_secret == true ]]; then
    flag="-rsp"
  fi
  local input
  while true; do
    read ${flag} "${prompt} [${default}]: " input || return 1
    [[ $is_secret == true ]] && printf '\n'
    input=${input:-$default}
    if [[ -n $input ]]; then
      printf '%s' "$input"
      return 0
    fi
    warn "Value must not be empty."
  done
}

replace_placeholders() {
  local file=$1
  shift
  if [[ ! -f $file ]]; then
    error "Cannot replace placeholders – file not found: $file"
    exit 1
  fi
  python3 - "$file" "$@" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
replacements = {}
for item in sys.argv[2:]:
    if '=' not in item:
        continue
    key, value = item.split('=', 1)
    replacements[key] = value
text = path.read_text(encoding='utf-8')
for key, value in replacements.items():
    text = text.replace(key, value)
path.write_text(text, encoding='utf-8')
PY
}

install_packages() {
  local php_version=$1
  log "Installing packages"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  local packages=(
    nginx
    "php${php_version}-fpm"
    "php${php_version}-cli"
    "php${php_version}-xml"
    "php${php_version}-mbstring"
    "php${php_version}-curl"
    "php${php_version}-gd"
    jq
    unzip
    curl
    git
    rsync
  )
  apt-get install -y --no-install-recommends "${packages[@]}"
}

deploy_application() {
  local app_dir=$1
  log "Deploying application files"
  install -d "$app_dir"
  if [[ -d "$app_dir/webroot" ]]; then
    warn "Removing legacy webroot directory from prior releases"
    if [[ -d "$app_dir/webroot/data" ]]; then
      warn "Migrating data directory from legacy layout"
      install -d "$app_dir/data"
      rsync -a "$app_dir/webroot/data/" "$app_dir/data/"
    fi
    rm -rf "$app_dir/webroot"
  fi

  rsync -a --delete --delete-delay \
    --filter='P .git/' \
    --exclude 'data/*.json' \
    webroot/ "$app_dir"/

  while IFS= read -r -d '' json; do
    local target="$app_dir/data/$(basename "$json")"
    if [[ ! -e $target ]]; then
      install -D -m 0644 "$json" "$target"
    fi
  done < <(find webroot/data -maxdepth 1 -type f -name '*.json' -print0)

  chown -R www-data:www-data "$app_dir"
  find "$app_dir" -type d -print0 | xargs -0 chmod 2755
  find "$app_dir" -type f -print0 | xargs -0 chmod 0644
}

configure_nginx() {
  local php_sock=$1
  local public_port=$2
  local admin_port=$3
  local app_dir=$4

  log "Deploying nginx configuration"
  install -d /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/nginx/snippets

  install -m 0644 config/nginx/signage-slideshow.conf /etc/nginx/sites-available/signage-slideshow.conf
  install -m 0644 config/nginx/signage-admin.conf /etc/nginx/sites-available/signage-admin.conf
  install -m 0644 config/nginx/snippets/signage-pairing.conf /etc/nginx/snippets/signage-pairing.conf

  replace_placeholders "$app_dir/admin/index.html" "__PUBLIC_PORT__=${public_port}"
  replace_placeholders /etc/nginx/sites-available/signage-slideshow.conf \
    "__PUBLIC_PORT__=${public_port}" \
    "__PHP_SOCK__=${php_sock}"
  replace_placeholders /etc/nginx/sites-available/signage-admin.conf \
    "__ADMIN_PORT__=${admin_port}" \
    "__PHP_SOCK__=${php_sock}"
  replace_placeholders /etc/nginx/snippets/signage-pairing.conf "__PHP_SOCK__=${php_sock}"

  ln -sf /etc/nginx/sites-available/signage-slideshow.conf /etc/nginx/sites-enabled/signage-slideshow.conf
  ln -sf /etc/nginx/sites-available/signage-admin.conf /etc/nginx/sites-enabled/signage-admin.conf
  rm -f /etc/nginx/sites-enabled/default
}

configure_php() {
  local php_version=$1
  log "Configuring PHP limits"
  local ini_dir="/etc/php/${php_version}/fpm/conf.d"
  install -d "$ini_dir"
  cat >"${ini_dir}/zz-signage.ini" <<'EOPHP'
upload_max_filesize = 256M
post_max_size       = 256M
memory_limit        = 512M
max_execution_time  = 120
max_input_time      = 120
expose_php = Off
EOPHP
}

update_htpasswd() {
  local user=$1
  local pass=$2
  local file=$3

  local hash
  hash=$(openssl passwd -apr1 "$pass")

  local tmp
  tmp=$(mktemp)
  python3 - "$file" "$tmp" "$user" "$hash" <<'PY'
import sys
from pathlib import Path

src, dst, user, hash_value = sys.argv[1:5]
src_path = Path(src)
entries = []
found = False
if src_path.exists():
    for line in src_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line:
            continue
        name, _, _ = line.partition(':')
        if name == user:
            if not found:
                entries.append(f"{user}:{hash_value}")
                found = True
        else:
            entries.append(line)
if not found:
    entries.append(f"{user}:{hash_value}")
Path(dst).write_text("\n".join(entries) + "\n", encoding='utf-8')
PY

  install -m 0640 -o root -g www-data "$tmp" "$file"
  rm -f "$tmp"
}

configure_basic_auth() {
  local user=$1
  local pass=$2
  local file=/etc/nginx/.signage_admin

  log "Configuring basic auth"
  if [[ -z $user || -z $pass ]]; then
    error "Admin credentials must not be empty"
    exit 1
  fi

  update_htpasswd "$user" "$pass" "$file"
}

reload_services() {
  local php_service=$1
  log "Validating nginx configuration"
  nginx -t

  log "Reloading services"
  if command -v systemctl >/dev/null 2>&1; then
    systemctl reload-or-restart "$php_service"
    systemctl reload-or-restart nginx
  else
    service "$php_service" reload || service "$php_service" restart
    service nginx reload || service nginx restart
  fi
}

print_summary() {
  local admin_port=$1
  local public_port=$2
  local admin_user=$3

  local ip
  ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  if [[ -z $ip ]]; then
    ip=$(ip route get 1 2>/dev/null | awk '{for (i=1; i<=NF; ++i) if ($i=="src") {print $(i+1); exit}}')
  fi
  ip=${ip:-127.0.0.1}

  cat <<EOF

Installation complete.

Admin UI:   http://${ip}:${admin_port}/admin/ (user: ${admin_user})
Slideshow:  http://${ip}:${public_port}/

Configs:
  /etc/nginx/sites-available/signage-admin.conf
  /etc/nginx/sites-available/signage-slideshow.conf
  /etc/nginx/snippets/signage-pairing.conf

Change admin password:
  htpasswd /etc/nginx/.signage_admin ${admin_user}
  systemctl reload nginx

EOF

}

main() {
  trap 'on_error $LINENO' ERR
  require_root
  umask 022

  local php_version=8.3
  local php_service="php${php_version}-fpm"
  local php_sock_default="/run/php/php${php_version}-fpm.sock"

  local public_port=${SIGNAGE_PUBLIC_PORT:-80}
  local admin_port=${SIGNAGE_ADMIN_PORT:-8888}
  local admin_user=${SIGNAGE_ADMIN_USER:-admin}
  local admin_pass=${SIGNAGE_ADMIN_PASS:-admin}
  local php_sock=${PHP_SOCK:-$php_sock_default}
  local app_dir=${APP_DIR:-/var/www/signage}

  if [[ -t 0 ]]; then
    public_port=$(prompt_port "Public port" "$public_port")
    admin_port=$(prompt_port "Admin port" "$admin_port")
    admin_user=$(prompt_value "Admin username" "$admin_user")
    admin_pass=$(prompt_value "Admin password" "$admin_pass" true)
  else
    local sanitized
    if sanitized=$(normalize_port "$public_port"); then
      public_port=$sanitized
    else
      error "SIGNAGE_PUBLIC_PORT must be a number between 1 and 65535"
      exit 1
    fi
    if sanitized=$(normalize_port "$admin_port"); then
      admin_port=$sanitized
    else
      error "SIGNAGE_ADMIN_PORT must be a number between 1 and 65535"
      exit 1
    fi
    if [[ -z $admin_user || -z $admin_pass ]]; then
      error "SIGNAGE_ADMIN_USER and SIGNAGE_ADMIN_PASS must not be empty"
      exit 1
    fi
  fi

  install_packages "$php_version"
  deploy_application "$app_dir"
  configure_nginx "$php_sock" "$public_port" "$admin_port" "$app_dir"
  configure_php "$php_version"
  configure_basic_auth "$admin_user" "$admin_pass"
  reload_services "$php_service"
  print_summary "$admin_port" "$public_port" "$admin_user"
}

main "$@"
