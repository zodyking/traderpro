#!/bin/sh
set -eu

if [ -n "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] Running database migrations..."
  # Use the image-local drizzle-kit; bare `npx` can fetch a transient copy that
  # cannot resolve `drizzle-kit` when loading drizzle.config.ts.
  if [ -x ./node_modules/.bin/drizzle-kit ]; then
    ./node_modules/.bin/drizzle-kit migrate
  else
    npm run db:migrate
  fi
else
  echo "[entrypoint] DATABASE_URL not set; skipping migrations"
fi

exec "$@"
