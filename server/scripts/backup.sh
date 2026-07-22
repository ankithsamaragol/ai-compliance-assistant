#!/bin/bash
# Dumps the app database to server/backups/, keeping the last 30 backups.
# Run manually, or on a schedule via cron (see README for the crontab line).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/../backups"
ENV_FILE="$SCRIPT_DIR/../.env"
KEEP=30

mkdir -p "$BACKUP_DIR"

if [ -f "$ENV_FILE" ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d '=' -f2-)
fi
DATABASE_URL="${DATABASE_URL:-postgres://localhost:5432/ai_compliance_assistant}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUT_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.dump"

pg_dump "$DATABASE_URL" -Fc -f "$OUT_FILE"
echo "Backup written to $OUT_FILE"

# Rotate: keep only the most recent $KEEP backups
ls -1t "$BACKUP_DIR"/backup_*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | while IFS= read -r f; do rm -- "$f"; done
