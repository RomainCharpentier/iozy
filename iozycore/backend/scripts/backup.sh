#!/usr/bin/env bash
# Daily backup of the IozyCore database.
# Schedule it with the DSM Task Scheduler (Synology), for example every
# day at 3:00. The files it makes are then picked up by
# Hyper Backup to external storage or cold cloud storage (step 20).

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/volume1/backups/iozycore}"
CONTAINER_NAME="${CONTAINER_NAME:-iozycore-postgres-1}"
DB_NAME="${DB_NAME:-iozycore}"
DB_USER="${DB_USER:-iozycore}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"

docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" \
    | gzip > "$BACKUP_DIR/iozycore_${TIMESTAMP}.sql.gz"

# Keep the last 30 days of local backups.
find "$BACKUP_DIR" -name "iozycore_*.sql.gz" -mtime +30 -delete

echo "Backup done : $BACKUP_DIR/iozycore_${TIMESTAMP}.sql.gz"
