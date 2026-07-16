#!/usr/bin/env bash
# Starts PostgreSQL first, then the API, for local development.
# PostgreSQL requires Docker: start Docker Desktop, then run this script.

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "→ CORDER Backend - Development"
echo ""

# Is PostgreSQL already listening on port 5432?
if command -v nc >/dev/null 2>&1; then
  if nc -z localhost 5432 2>/dev/null; then
    echo "→ PostgreSQL is already running (localhost:5432)."
  else
    if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
      echo "→ Starting PostgreSQL with Docker..."
      docker compose -f docker-compose.dev.yml up -d
      echo "→ Waiting a few seconds..."
      sleep 5
    else
      echo "ERROR: PostgreSQL is not running and Docker is unavailable."
      echo "  - Open Docker Desktop"
      echo "  - Or install local PostgreSQL (port 5432, user: corder, password: corder_secret, DB: corder)"
      echo "  - Then: docker compose -f docker-compose.dev.yml up -d"
      exit 1
    fi
  fi
else
  echo "→ (nc not found, skipping PostgreSQL check; start the DB if you hit errors.)"
fi

echo "→ Starting backend (port 4000)..."
echo ""
exec pnpm run start:dev
