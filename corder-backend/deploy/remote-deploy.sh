#!/usr/bin/env bash
# Production deployment script (triggered via GitHub Actions SSH or manually).
# Supports both monorepo root (/opt/corder/corder-backend) and standalone backend repo (/opt/corder).
set -euo pipefail

REPO_ROOT="${DEPLOY_REPO_ROOT:-/opt/corder}"
BRANCH="${DEPLOY_BRANCH:-main}"
HEALTH_URL="${DEPLOY_HEALTH_URL:-http://127.0.0.1/health/ready}"
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-corder}"

cd "$REPO_ROOT"

if [ ! -d .git ]; then
  echo "ERROR: $REPO_ROOT is not a git repository."
  exit 1
fi

PREV_SHA="$(git rev-parse HEAD)"
echo "→ Current commit: $PREV_SHA"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
NEW_SHA="$(git rev-parse HEAD)"
echo "→ Target commit:  $NEW_SHA"

if [ -f "$REPO_ROOT/corder-backend/docker-compose.yml" ]; then
  BACKEND_DIR="$REPO_ROOT/corder-backend"
elif [ -f "$REPO_ROOT/docker-compose.yml" ]; then
  BACKEND_DIR="$REPO_ROOT"
else
  echo "ERROR: docker-compose.yml not found in $REPO_ROOT or $REPO_ROOT/corder-backend."
  exit 1
fi

cd "$BACKEND_DIR"

if [ ! -f .env ]; then
  echo "ERROR: $BACKEND_DIR/.env is missing. Create it from .env.production.example first."
  exit 1
fi

# Take a pre-deploy PostgreSQL backup if the database container is already running
if docker compose ps --status running db 2>/dev/null | grep -q "db"; then
  BACKUP_DIR="$BACKEND_DIR/backups"
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/pre-deploy-$(date -u +%Y%m%dT%H%M%SZ)-${PREV_SHA:0:8}.sql.gz"
  echo "→ Taking pre-deploy database backup to $BACKUP_FILE..."
  DB_USER="$(grep -E '^DB_USERNAME=' .env | cut -d= -f2- | tr -d '\r"' || true)"
  DB_NAME_VAL="$(grep -E '^DB_NAME=' .env | cut -d= -f2- | tr -d '\r"' || true)"
  DB_USER="${DB_USER:-corder}"
  DB_NAME_VAL="${DB_NAME_VAL:-corder}"
  if docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME_VAL" | gzip > "$BACKUP_FILE"; then
    ls -1t "$BACKUP_DIR"/pre-deploy-*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
  else
    echo "WARNING: Pre-deploy pg_dump failed; removing partial backup file."
    rm -f "$BACKUP_FILE"
  fi
fi

rollback() {
  echo "ERROR: Deployment failed health verification. Rolling back to $PREV_SHA..."
  docker compose logs --tail=80 api || true
  cd "$REPO_ROOT"
  git reset --hard "$PREV_SHA"
  cd "$BACKEND_DIR"
  docker compose build
  docker compose up -d --remove-orphans
  exit 1
}

echo "→ Building and starting containers..."
docker compose build --pull
docker compose up -d --remove-orphans

echo "→ Waiting for readiness probe ($HEALTH_URL)..."
READY=0
for i in $(seq 1 30); do
  if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done

if [ "$READY" -ne 1 ]; then
  rollback
fi

docker image prune -f >/dev/null 2>&1 || true

echo "OK: $(date -Iseconds) backend deployed ($NEW_SHA) and healthy."
