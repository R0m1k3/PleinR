#!/bin/sh
set -e

# Ensure an AUTH_SECRET exists. If none is provided, generate one and persist it
# to the app-data volume so sessions stay valid across restarts.
if [ -z "$AUTH_SECRET" ]; then
  SECRET_FILE=/app/data/auth_secret
  if [ -f "$SECRET_FILE" ]; then
    AUTH_SECRET=$(cat "$SECRET_FILE")
  else
    AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
    mkdir -p /app/data
    printf '%s' "$AUTH_SECRET" > "$SECRET_FILE"
    echo "→ AUTH_SECRET généré et persisté dans $SECRET_FILE"
  fi
  export AUTH_SECRET
fi

echo "→ Applying database migrations…"
node dist/migrate.cjs

if [ "$SEED_ON_START" = "true" ]; then
  echo "→ Seeding database (SEED_ON_START=true)…"
  node dist/seed.cjs || echo "  seed step reported an issue, continuing"
fi

echo "→ Starting Plein R on port ${PORT:-3000}…"
exec node server.js
