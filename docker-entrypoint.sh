#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

# Run seed if RUN_SEED=true (first-time setup)
if [ "$RUN_SEED" = "true" ]; then
  echo "Running database seed..."
  npx --yes tsx prisma/seed.ts
  echo "Seed completed."
fi

echo "Starting application..."
exec node dist/main
