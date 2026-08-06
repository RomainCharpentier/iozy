#!/usr/bin/env bash
# Sauvegarde quotidienne de la base IozyCore.
# À planifier via le Planificateur de tâches de DSM (Synology), ex. tous les
# jours à 3h. Les fichiers produits sont ensuite pris en charge par
# Hyper Backup vers un stockage externe/cloud froid (étape 20).

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/volume1/backups/iozycore}"
CONTAINER_NAME="${CONTAINER_NAME:-iozycore-postgres-1}"
DB_NAME="${DB_NAME:-iozycore}"
DB_USER="${DB_USER:-iozycore}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"

docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" \
    | gzip > "$BACKUP_DIR/iozycore_${TIMESTAMP}.sql.gz"

# Conserve les 30 derniers jours de sauvegardes locales.
find "$BACKUP_DIR" -name "iozycore_*.sql.gz" -mtime +30 -delete

echo "Sauvegarde effectuée : $BACKUP_DIR/iozycore_${TIMESTAMP}.sql.gz"
