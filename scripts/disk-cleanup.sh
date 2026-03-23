#!/usr/bin/env bash
# ─── HTMLSignage Disk Cleanup & Monitor ───────────────────────────────────────
# Runs via cron to prevent disk-full situations.
# Logs to /opt/HTMLSignage/logs/disk-cleanup.log (or stdout if not writable).

set -euo pipefail

THRESHOLD=85  # warn/cleanup when disk usage exceeds this percentage
LOG="/opt/HTMLSignage/logs/disk-cleanup.log"

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg" >> "$LOG" 2>/dev/null || echo "$msg"
}

# Current usage percentage (root filesystem)
USAGE=$(df / --output=pcent | tail -1 | tr -d ' %')

log "Disk usage: ${USAGE}%"

if [ "$USAGE" -lt "$THRESHOLD" ]; then
  log "Below threshold (${THRESHOLD}%), no action needed."
  exit 0
fi

log "Above threshold (${THRESHOLD}%), starting cleanup..."

# 1. Clean pnpm store (unused packages)
if command -v pnpm &>/dev/null; then
  pnpm store prune 2>/dev/null && log "pnpm store pruned" || true
fi

# 2. Clean node compile cache
rm -rf /tmp/node-compile-cache 2>/dev/null && log "Removed /tmp/node-compile-cache" || true

# 3. Clean old Prisma engines (keep only latest)
PRISMA_CACHE="$HOME/.cache/prisma"
if [ -d "$PRISMA_CACHE" ]; then
  PRISMA_DIRS=$(ls -dt "$PRISMA_CACHE"/*/ 2>/dev/null | tail -n +2)
  if [ -n "$PRISMA_DIRS" ]; then
    echo "$PRISMA_DIRS" | xargs rm -rf 2>/dev/null
    log "Cleaned old Prisma engine caches"
  fi
fi

# 4. Truncate old application logs (keep last 2000 lines)
for logfile in /opt/HTMLSignage/logs/*.log; do
  if [ -f "$logfile" ] && [ "$(wc -l < "$logfile")" -gt 2000 ]; then
    tail -2000 "$logfile" > "${logfile}.tmp" && mv "${logfile}.tmp" "$logfile"
    log "Truncated $logfile"
  fi
done 2>/dev/null || true

# 5. Clean systemd journal (if we have permission)
journalctl --vacuum-size=100M 2>/dev/null && log "Journal vacuumed to 100M" || true

# 6. Remove old tmp files (older than 7 days)
find /tmp -maxdepth 1 -user "$(whoami)" -mtime +7 -not -name "." -exec rm -rf {} \; 2>/dev/null || true
log "Cleaned old tmp files"

# Final check
USAGE_AFTER=$(df / --output=pcent | tail -1 | tr -d ' %')
log "Disk usage after cleanup: ${USAGE_AFTER}%"

if [ "$USAGE_AFTER" -ge 95 ]; then
  log "CRITICAL: Disk usage still at ${USAGE_AFTER}% after cleanup!"
  # Could add email/webhook notification here
fi
