#!/usr/bin/env bash
# Backup harian database Kucur (+ opsional folder uploads).
#   bash deploy/backup.sh            -> backups/db-YYYYmmdd-HHMMSS.sql.gz
#   BACKUP_UPLOADS=1 bash deploy/backup.sh   -> juga backups/uploads-YYYYmmdd-HHMMSS.tar.gz
# Simpan 14 backup terakhir (ubah dengan KEEP=30). Salin folder backups/ ke luar VPS secara berkala!
#
# Cron harian jam 02:00 (crontab -e, ganti /home/USER/kucur):
#   0 2 * * * BACKUP_UPLOADS=1 /usr/bin/bash /home/USER/kucur/deploy/backup.sh >> /home/USER/kucur/backups/backup.log 2>&1
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${BACKUP_DIR:-$ROOT/backups}"
KEEP="${KEEP:-14}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-kucur-prod-mysql}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-kucur-prod-backend}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$OUT"
umask 077

DB_FILE="$OUT/db-$STAMP.sql.gz"
# Kata sandi dibaca di dalam container (tidak muncul di daftar proses host).
docker exec "$MYSQL_CONTAINER" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --routines --triggers --default-character-set=utf8mb4 --no-tablespaces "$MYSQL_DATABASE"' | gzip -9 > "$DB_FILE.tmp"
gzip -t "$DB_FILE.tmp"
# Jaga-jaga dump kosong/terpotong: harus ada tabel User.
if [ "$(gzip -dc "$DB_FILE.tmp" | grep -c 'CREATE TABLE `User`')" -lt 1 ]; then
  rm -f "$DB_FILE.tmp"; echo "GAGAL: dump tidak berisi tabel User" >&2; exit 1
fi
mv "$DB_FILE.tmp" "$DB_FILE"
echo "$(date '+%F %T') OK  $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"

if [ "${BACKUP_UPLOADS:-0}" = "1" ]; then
  UP_FILE="$OUT/uploads-$STAMP.tar.gz"
  docker exec "$BACKEND_CONTAINER" tar czf - -C /app uploads > "$UP_FILE.tmp"
  gzip -t "$UP_FILE.tmp"
  mv "$UP_FILE.tmp" "$UP_FILE"
  echo "$(date '+%F %T') OK  $UP_FILE ($(du -h "$UP_FILE" | cut -f1))"
fi

# Rotasi: simpan KEEP terbaru per jenis.
for prefix in db uploads; do
  ls -1t "$OUT"/$prefix-*.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f --
done
