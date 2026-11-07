#!/usr/bin/env bash
# Deploy topovik to vucadigital.by (alongside existing vuca site/cms).
# Usage:
#   bash /home/portgas/topovik/deploy/deploy.sh
#   SKIP_SYNC=1 bash /home/portgas/topovik/deploy/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${DEPLOY_HOST:-vucadigital.by}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/topovik}"
RSYNC_SSH=(ssh -o BatchMode=yes -o IdentitiesOnly=yes)
SKIP_SYNC="${SKIP_SYNC:-0}"

export LANG=C.UTF-8
export LC_ALL=C.UTF-8

echo "==> target host: $HOST  dir: $REMOTE_DIR"
echo "==> ensure remote rsync + dirs"
"${RSYNC_SSH[@]}" "$HOST" bash -s <<REMOTE
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
mkdir -p '$REMOTE_DIR/cms/public/uploads' '$REMOTE_DIR/deploy/nginx' /var/www/certbot
if command -v rsync >/dev/null 2>&1; then
  command -v rsync
  exit 0
fi
apt-get update -qq || true
apt-get install -y -qq rsync
command -v rsync
REMOTE

if [ "$SKIP_SYNC" != "1" ]; then
  echo "==> sync monorepo (preserve mtimes; UTF-8 names)"
  # Uploads go in a dedicated pass (many small files; keep first pass lean).
  rsync -azH --protect-args --info=stats2,progress2 \
    -e "${RSYNC_SSH[*]}" \
    --exclude '.git/' \
    --exclude 'node_modules/' \
    --exclude '**/node_modules/' \
    --exclude 'frontend/.next/' \
    --exclude 'cms/.strapi/' \
    --exclude 'cms/.tmp/' \
    --exclude 'cms/dist/' \
    --exclude 'cms/public/uploads/' \
    --exclude 'old/' \
    --exclude 'scripts/migrate/filtered.sql' \
    --exclude 'scripts/migrate/out/' \
    --exclude 'scripts/migrate/node_modules/' \
    --exclude '.env' \
    --exclude '.env.local' \
    --exclude 'cms/.env' \
    --exclude 'frontend/.env.local' \
    "$ROOT/" "$HOST:$REMOTE_DIR/"

  echo "==> sync uploads separately (mtime + UTF-8, compressed)"
  rsync -azH --protect-args --info=stats2,progress2 \
    -e "${RSYNC_SSH[*]}" \
    "$ROOT/cms/public/uploads/" "$HOST:$REMOTE_DIR/cms/public/uploads/"
else
  echo "==> SKIP_SYNC=1 — skipping full tree rsync"
fi

echo "==> install .env + nginx + scripts + Dockerfiles"
rsync -a -e "${RSYNC_SSH[*]}" \
  "$ROOT/deploy/env.production" "$HOST:$REMOTE_DIR/.env"
rsync -a -e "${RSYNC_SSH[*]}" \
  "$ROOT/deploy/nginx/topovik.com.http-bootstrap.conf" \
  "$HOST:/etc/nginx/sites-available/topovik.com.http-bootstrap"
rsync -a -e "${RSYNC_SSH[*]}" \
  "$ROOT/deploy/nginx/topovik.com.conf" \
  "$HOST:/etc/nginx/sites-available/topovik.com"
rsync -a -e "${RSYNC_SSH[*]}" \
  "$ROOT/deploy/remote-up.sh" \
  "$ROOT/deploy/continue-apps.sh" \
  "$HOST:$REMOTE_DIR/deploy/"
rsync -a -e "${RSYNC_SSH[*]}" \
  "$ROOT/docker-compose.prod.yml" \
  "$HOST:$REMOTE_DIR/docker-compose.prod.yml"
rsync -a -e "${RSYNC_SSH[*]}" \
  "$ROOT/cms/Dockerfile" "$HOST:$REMOTE_DIR/cms/Dockerfile"
rsync -a -e "${RSYNC_SSH[*]}" \
  "$ROOT/frontend/Dockerfile" \
  "$ROOT/frontend/src/lib/strapi.ts" \
  "$HOST:$REMOTE_DIR/frontend/"

echo "==> remote-up.sh"
"${RSYNC_SSH[@]}" "$HOST" "chmod +x '$REMOTE_DIR/deploy/remote-up.sh' && bash '$REMOTE_DIR/deploy/remote-up.sh'"

echo "==> deploy finished → $HOST"
