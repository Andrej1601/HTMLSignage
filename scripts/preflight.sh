#!/usr/bin/env bash
set -euo pipefail

log(){ printf '\033[1;34m[CHECK]\033[0m %s\n' "$*"; }
warn(){ printf '\033[1;33m[WARN ]\033[0m %s\n' "$*"; }
fail(){ printf '\033[1;31m[FAIL]\033[0m %s\n' "$*"; }
ok(){ printf '\033[1;32m[ OK ]\033[0m %s\n' "$*"; }

REQUIRED_CMDS=(docker)
REQUIRED_PORTS=(80 443)
MIN_DISK_MB=2048

check_commands(){
  local missing=0
  for cmd in "${REQUIRED_CMDS[@]}"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      fail "Command '$cmd' missing";
      missing=1
    else
      ok "Found $cmd"
    fi
  done
  if command -v docker >/dev/null 2>&1; then
    if docker compose version >/dev/null 2>&1; then
      ok "Docker Compose plugin available"
    elif command -v docker-compose >/dev/null 2>&1; then
      ok "docker-compose CLI available"
    else
      fail "Docker Compose not installed (plugin or docker-compose)"
      missing=1
    fi
  fi
  if [[ $missing -eq 1 ]]; then
    warn "Install missing commands before continuing."
    return 1
  fi
}

check_ports(){
  local busy=0
  for port in "${REQUIRED_PORTS[@]}"; do
    local listeners=""
    if command -v ss >/dev/null 2>&1; then
      listeners=$(ss -lnt 2>/dev/null | awk 'NR>1 {print $4}')
    elif command -v netstat >/dev/null 2>&1; then
      listeners=$(netstat -lnt 2>/dev/null | awk 'NR>2 {print $4}')
    else
      warn "Cannot inspect ports – missing ss/netstat"
      continue
    }
    if printf '%s\n' "$listeners" | grep -qE "[:.]${port}$"; then
      warn "Port ${port} already in use"
      busy=1
    else
      ok "Port ${port} available"
    fi
  done
  [[ $busy -eq 0 ]]
}

check_disk(){
  local avail
  avail=$(df -Pm . | awk 'NR==2 {print $4}')
  if [[ -z $avail ]]; then
    warn "Could not determine free disk space"
    return 0
  fi
  if (( avail < MIN_DISK_MB )); then
    fail "Only ${avail}MB free, ${MIN_DISK_MB}MB required"
    return 1
  fi
  ok "Disk space OK (${avail}MB free)"
}

check_permissions(){
  if [[ ! -w webroot/data ]]; then
    warn "webroot/data is not writable by current user"
    return 1
  fi
  ok "webroot/data writable"
}

run_all(){
  local status=0
  log "Running deployment preflight checks"
  check_commands || status=1
  check_ports || status=1
  check_disk || status=1
  check_permissions || status=1

  if [[ $status -ne 0 ]]; then
    fail "Preflight checks failed"
    exit 1
  fi
  ok "All checks passed"
}

run_all "$@"
