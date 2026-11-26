#!/usr/bin/env bash
# Run the Round 3 schema and exercises against a throwaway PostgreSQL database.
#   bash healthlab/sql/verify.sh            (needs a local PostgreSQL 16 and psql)
#   bash healthlab/sql/verify.sh --write    also saves the output to exercises.out,
#                                           which healthlab.design embeds in the page
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
db="hip_verify_$$"
psql_() { if [ "$(id -u)" = 0 ]; then su postgres -c "psql -X -q $*"; else psql -X -q "$@"; fi; }
psql_ "-c 'CREATE DATABASE $db'"
trap 'psql_ "-c \"DROP DATABASE IF EXISTS $db\""' EXIT
sql="$(mktemp)"; chmod 644 "$sql"
cat "$here/schema.sql" "$here/exercises.sql" > "$sql"
if [ "${1:-}" = "--write" ]; then
  psql_ "-v ON_ERROR_STOP=1 -d $db -f $sql" > "$here/exercises.out"
  echo "wrote $here/exercises.out"
else
  psql_ "-v ON_ERROR_STOP=1 -d $db -f $sql"
fi
rm -f "$sql"
