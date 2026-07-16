#!/usr/bin/env bash
# Runs on the server (triggered via GitHub Action SSH).
# Repo root: this repo (backend alone; no backend/ subfolder).
set -euo pipefail

REPO_ROOT="${DEPLOY_REPO_ROOT:-/opt/corder}"
BRANCH="${DEPLOY_BRANCH:-main}"
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-corder}"

cd "$REPO_ROOT"

if [ ! -d .git ]; then
  echo "ERROR: $REPO_ROOT is not a git repository."
  exit 1
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

if [ ! -f .env ]; then
  echo "ERROR: $REPO_ROOT/.env is missing. Create it from .env.production.example first."
  exit 1
fi

docker compose build --pull
docker compose up -d --remove-orphans

docker image prune -f >/dev/null 2>&1 || true

echo "OK: $(date -Iseconds) backend is up to date."
