#!/usr/bin/env bash
# Seed the LOCAL dev database (127.0.0.1:5433/order_backend) for scope testing:
# order-backend's Mezban demo seeder, then scope-test-data.sql. Both are additive
# and rerunnable. psql.sh refuses to run if the backend .env points elsewhere.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="${ORDER_BACKEND_DIR:-$HOME/src/order-backend}"

"$HERE/psql.sh" -q -c "select 1" >/dev/null
(cd "$BACKEND_DIR" && .venv/bin/python scripts/seed_demo_data.py)
"$HERE/psql.sh" -f "$HERE/scope-test-data.sql"
