#!/bin/sh
set -e

echo "→ Applying database migrations…"
node dist/migrate.cjs

if [ "$SEED_ON_START" = "true" ]; then
  echo "→ Seeding database (SEED_ON_START=true)…"
  node dist/seed.cjs || echo "  seed step reported an issue, continuing"
fi

echo "→ Starting Plein R on port ${PORT:-3000}…"
exec node server.js
