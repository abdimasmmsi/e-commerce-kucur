#!/usr/bin/env bash
# Pulihkan database dari backup. PERINGATAN: menimpa isi database sekarang.
#   bash deploy/restore.sh backups/db-20261026-020000.sql.gz
#   bash deploy/restore.sh backups/db-....sql.gz backups/uploads-....tar.gz   (opsional: pulihkan uploads juga)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-kucur-prod-mysql}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-kucur-prod-backend}"
DB_FILE="${1:-}"
UP_FILE="${2:-}"

[ -n "$DB_FILE" ] && [ -f "$DB_FILE" ] || { echo "Pemakaian: bash deploy/restore.sh <db-*.sql.gz> [uploads-*.tar.gz]" >&2; exit 1; }
gzip -t "$DB_FILE" || { echo "File backup rusak (gzip -t gagal)." >&2; exit 1; }
[ -z "$UP_FILE" ] || gzip -t "$UP_FILE" || { echo "File uploads rusak." >&2; exit 1; }

echo "Database di container $MYSQL_CONTAINER akan DITIMPA dengan: $DB_FILE"
read -r -p "Ketik PULIHKAN untuk melanjutkan: " answer
[ "$answer" = "PULIHKAN" ] || { echo "Dibatalkan."; exit 1; }

# Backup pengaman sebelum menimpa.
echo "Membuat backup pengaman dulu..."
bash "$ROOT/deploy/backup.sh"

echo "Menghentikan backend sementara..."
docker stop "$BACKEND_CONTAINER" >/dev/null

gzip -dc "$DB_FILE" | docker exec -i "$MYSQL_CONTAINER" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 "$MYSQL_DATABASE"'
echo "Database dipulihkan."

if [ -n "$UP_FILE" ]; then
  docker start "$BACKEND_CONTAINER" >/dev/null
  gzip -dc "$UP_FILE" | docker exec -i "$BACKEND_CONTAINER" tar xf - -C /app
  echo "Uploads dipulihkan."
else
  docker start "$BACKEND_CONTAINER" >/dev/null
fi
echo "Backend dijalankan lagi. Cek: docker ps  dan  docker logs kucur-prod-backend"
