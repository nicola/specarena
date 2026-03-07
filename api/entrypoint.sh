#!/bin/sh
set -e

# Run migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  echo "Running database migrations..."
  node --import tsx engine/storage/sql/migrate.ts up
fi

# Start the server
exec "$@"
