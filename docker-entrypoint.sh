#!/bin/sh
set -e

echo "=== Vanguard Visitor Backend Starting ==="
echo "Node version: $(node --version)"
echo "Time: $(date -u)"

# Validate required environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "FATAL: DATABASE_URL is not set. Cannot start."
  exit 1
fi

echo "DATABASE_URL is set (host: $(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p'))"

# Wait for database to be reachable (up to 30 seconds)
echo "Waiting for database connection..."
RETRIES=15
until node -e "
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  c.connect().then(() => { c.end(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    echo "FATAL: Could not connect to database after 30s"
    exit 1
  fi
  echo "  Database not ready, retrying in 2s... ($RETRIES attempts left)"
  sleep 2
done
echo "Database is reachable"

# Run migrations (with timeout to prevent hanging)
echo "Running database migrations..."
timeout 120 npx prisma migrate deploy || {
  echo "WARNING: Migration timed out or failed (exit $?), continuing..."
}
echo "Migrations complete"

# Run seed ONCE if RUN_SEED=true (first-time setup only)
# Uses a marker file to prevent re-running on every container restart
SEED_MARKER="/app/.seed-completed"
if [ "$RUN_SEED" = "true" ] && [ ! -f "$SEED_MARKER" ]; then
  echo "Running database seed (first-time setup)..."
  timeout 120 npx --yes tsx prisma/seed.ts && touch "$SEED_MARKER"
  echo "Seed completed"
elif [ "$RUN_SEED" = "true" ] && [ -f "$SEED_MARKER" ]; then
  echo "Skipping seed (already completed — remove $SEED_MARKER to force re-run)"
fi

# Seed superadmin user if SEED_SUPERADMIN=true (idempotent, safe to run each start)
if [ "$SEED_SUPERADMIN" = "true" ]; then
  echo "Seeding superadmin user..."
  timeout 60 npx --yes tsx prisma/seed-superadmin.ts || {
    echo "WARNING: Superadmin seed failed (exit $?), continuing..."
  }
  echo "Superadmin seeded"
fi

echo "Starting application on port ${PORT:-3000}..."
exec node dist/main
