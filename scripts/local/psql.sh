#!/usr/bin/env bash
# psql against the LOCAL dev database only (127.0.0.1:5433/order_backend).
# The password is read from order-backend's .env; host, port, and database are
# fixed here and the script refuses to run if that .env points anywhere else.
#
#   scripts/local/psql.sh -f scripts/local/scope-test-data.sql
#   scripts/local/psql.sh -c "select email, role from users"
set -euo pipefail

BACKEND_DIR="${ORDER_BACKEND_DIR:-$HOME/src/order-backend}"
PSQL="${PSQL:-/Library/PostgreSQL/18/bin/psql}"
URL="$(grep -E '^DATABASE_URL=' "$BACKEND_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"')"

case "$URL" in
  *@localhost:5433/order_backend|*@127.0.0.1:5433/order_backend) ;;
  *)
    echo "Refusing: order-backend DATABASE_URL is not the local 5433/order_backend database." >&2
    exit 1
    ;;
esac

export PGPASSWORD="$(printf '%s' "$URL" | sed -E 's#^[^:]+://[^:]+:([^@]*)@.*#\1#')"
exec "$PSQL" -h 127.0.0.1 -p 5433 -U postgres -d order_backend -X -v ON_ERROR_STOP=1 "$@"
