#!/usr/bin/env bash
# Export every PaddySpeaks D1 database to SQL files (P0.7).
#
#   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… scripts/platform_build/export_d1.sh [out-dir]
#
# Needs: Node 20+, network access to Cloudflare, and a token with
# "D1: Read" on the account. Writes <out-dir>/<db>-<UTC timestamp>.sql plus a
# SHA-256 manifest. The forms export contains PERSONAL DATA (testimonial names
# and emails): keep it off public storage and encrypt it at rest — see
# docs/BACKUP-RECOVERY.md. Never commit an export to this repository.
set -euo pipefail

OUT="${1:-./d1-backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DBS=(paddyspeaks-analytics paddyspeaks-leaderboard paddyspeaks-forms)
WRANGLER="npx --yes wrangler@3"

: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN (D1 read)}"
mkdir -p "$OUT"
cd "$(dirname "$0")/../../analytics/worker"   # wrangler.toml holds the bindings

for db in "${DBS[@]}"; do
  file="$OUT/$db-$STAMP.sql"
  [[ "$OUT" = /* ]] || file="$OLDPWD/$file"
  echo "▸ exporting $db → $file"
  $WRANGLER d1 export "$db" --remote --output "$file"
done

cd "$OLDPWD"
( cd "$OUT" && sha256sum ./*-"$STAMP".sql > "manifest-$STAMP.sha256" )
echo "✓ done: $(ls "$OUT"/*-"$STAMP".sql | wc -l) databases, manifest $OUT/manifest-$STAMP.sha256"
