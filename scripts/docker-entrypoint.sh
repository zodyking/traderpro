#!/bin/sh
set -eu

if [ -n "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] Running database migrations..."
  npx drizzle-kit migrate
else
  echo "[entrypoint] DATABASE_URL not set; skipping migrations"
fi

exec "$@"
