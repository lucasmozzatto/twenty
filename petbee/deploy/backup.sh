#!/usr/bin/env bash
# Backup diário do Postgres do Twenty. Guarda 14 dias em /opt/twenty-backups.
# IMPORTANTE: backups na mesma máquina protegem contra erro, não contra
# desastre. Copie-os para fora (Google Drive via rclone, S3, etc.) quando
# possível — instruções no README.
set -euo pipefail

cd "$(dirname "$0")"
BACKUP_DIR=/opt/twenty-backups
mkdir -p "$BACKUP_DIR"

STAMP=$(date +%Y%m%d-%H%M)
docker compose exec -T db pg_dump -U postgres -d default | gzip > "$BACKUP_DIR/twenty-$STAMP.sql.gz"

# Remove backups com mais de 14 dias
find "$BACKUP_DIR" -name 'twenty-*.sql.gz' -mtime +14 -delete

echo "backup ok: twenty-$STAMP.sql.gz ($(du -h "$BACKUP_DIR/twenty-$STAMP.sql.gz" | cut -f1))"
