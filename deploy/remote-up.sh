#!/usr/bin/env bash
# Runs ON the server from /var/www/topovik
# Safe alongside vuca (host :3000 / :1337). Topovik uses :3010 / :1340 / :5434.
set -euo pipefail
export LANG=C.UTF-8 LC_ALL=C.UTF-8
export DEBIAN_FRONTEND=noninteractive

cd /var/www/topovik
mkdir -p /var/www/certbot

set -a
# shellcheck disable=SC1091
source ./.env
set +a

CMS_PORT=1340
WEB_PORT=3010

mkdir -p /etc/apt/sources.list.d/disabled
shopt -s nullglob
for f in /etc/apt/sources.list.d/*mongo* /etc/apt/sources.list.d/*Mongo*; do
  mv -f "$f" /etc/apt/sources.list.d/disabled/ 2>/dev/null || true
done
shopt -u nullglob

if ! command -v docker >/dev/null 2>&1; then
  echo '==> installing docker.io + compose plugin (Ubuntu apt)'
  apt-get update -qq || true
  apt-get install -y -qq docker.io docker-compose-v2 curl ca-certificates || \
    apt-get install -y -qq docker.io curl ca-certificates
fi
systemctl enable --now docker

if ! docker compose version >/dev/null 2>&1; then
  echo '==> installing docker compose v2 plugin binary'
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64) CARCH=x86_64 ;;
    aarch64|arm64) CARCH=aarch64 ;;
    *) CARCH=$ARCH ;;
  esac
  mkdir -p /usr/libexec/docker/cli-plugins /usr/local/lib/docker/cli-plugins
  curl -fsSL "https://github.com/docker/compose/releases/download/v2.32.4/docker-compose-linux-${CARCH}" \
    -o /usr/libexec/docker/cli-plugins/docker-compose
  chmod +x /usr/libexec/docker/cli-plugins/docker-compose
  ln -sfn /usr/libexec/docker/cli-plugins/docker-compose \
    /usr/local/lib/docker/cli-plugins/docker-compose
fi
docker --version
docker compose version

# HTTP bootstrap first (do not break vuca default site)
ln -sfn /etc/nginx/sites-available/topovik.com.http-bootstrap /etc/nginx/sites-enabled/topovik.com
nginx -t
systemctl reload nginx

echo '==> 1/3 postgres'
docker compose -f docker-compose.prod.yml up -d postgres
echo 'waiting postgres healthy...'
for i in $(seq 1 60); do
  if docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_isready -U "${POSTGRES_USER:-topovik}" -d "${POSTGRES_DB:-topovik}" >/dev/null 2>&1; then
    echo "postgres ready (try $i)"
    break
  fi
  sleep 2
done

echo '==> syncing DB role password to .env'
PW_ESC=${POSTGRES_PASSWORD//\'/\'\'}
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "${POSTGRES_USER:-topovik}" -d "${POSTGRES_DB:-topovik}" \
  -v ON_ERROR_STOP=1 \
  -c "ALTER USER \"${POSTGRES_USER:-topovik}\" WITH PASSWORD '${PW_ESC}';" \
  || echo 'WARN: could not ALTER USER password (continuing)'

echo '==> checking dump / articles table'
HAS=$(
  docker compose -f docker-compose.prod.yml exec -T postgres \
    psql -U "${POSTGRES_USER:-topovik}" -d "${POSTGRES_DB:-topovik}" \
    -tAc "SELECT to_regclass('public.articles');" 2>/dev/null | tr -d '[:space:]' || true
)
echo "articles regclass=[${HAS}]"
if [ "$HAS" != "articles" ]; then
  echo '==> restoring postgres dump...'
  docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_restore -U "${POSTGRES_USER:-topovik}" -d "${POSTGRES_DB:-topovik}" \
    --no-owner --role="${POSTGRES_USER:-topovik}" --clean --if-exists /dump/topovik.dump \
    || echo 'WARN: pg_restore exited non-zero (often OK with --clean warnings)'
else
  echo '==> articles already present — skip restore'
fi

echo '==> 2/3 build + start cms (Strapi) on :'"$CMS_PORT"
docker compose -f docker-compose.prod.yml build cms
docker compose -f docker-compose.prod.yml up -d cms
echo "waiting cms on :$CMS_PORT ..."
cms_ready=0
for i in $(seq 1 120); do
  if curl -sf -o /dev/null "http://127.0.0.1:${CMS_PORT}/admin"; then
    echo "cms ready (try $i)"
    cms_ready=1
    break
  fi
  sleep 3
done
if [ "$cms_ready" != 1 ]; then
  echo "ERROR: cms did not become ready on :$CMS_PORT" >&2
  exit 1
fi

echo '==> 3/3 build + start frontend (Next) on :'"$WEB_PORT"
docker compose -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.prod.yml up -d --remove-orphans postgres redis cms frontend

echo '==> waiting cms/frontend ports'
both_ready=0
for i in $(seq 1 90); do
  cms_ok=0
  web_ok=0
  curl -sf -o /dev/null "http://127.0.0.1:${CMS_PORT}/admin" && cms_ok=1 || true
  curl -sf -o /dev/null "http://127.0.0.1:${WEB_PORT}/" && web_ok=1 || true
  if [ "$cms_ok" = 1 ] && [ "$web_ok" = 1 ]; then
    echo "both ready (try $i)"
    both_ready=1
    break
  fi
  sleep 2
done
if [ "$both_ready" != 1 ]; then
  echo "ERROR: cms/frontend ports not ready" >&2
  docker compose -f docker-compose.prod.yml ps >&2 || true
  exit 1
fi

docker compose -f docker-compose.prod.yml ps
RUNNING=$(docker compose -f docker-compose.prod.yml ps --status running --services 2>/dev/null | tr '\n' ' ' || true)
echo "running services: $RUNNING"
for svc in postgres redis cms frontend; do
  if echo " $RUNNING " | grep -q " $svc "; then
    echo "OK: $svc running"
  else
    echo "ERROR: $svc NOT running" >&2
    exit 1
  fi
done

echo '==> issue / renew Let'\''s Encrypt cert (needs DNS topovik.com → this server)'
if ! command -v certbot >/dev/null 2>&1; then
  apt-get update -qq || true
  apt-get install -y -qq certbot || true
fi
if command -v certbot >/dev/null 2>&1; then
  certbot certonly --webroot -w /var/www/certbot \
    -d topovik.com -d www.topovik.com \
    --agree-tos --non-interactive --keep-until-expiring \
    -m admin@topovik.com \
    || certbot certonly --webroot -w /var/www/certbot \
         -d topovik.com \
         --agree-tos --non-interactive --keep-until-expiring \
         -m admin@topovik.com \
    || echo 'certbot failed — keeping HTTP bootstrap (check DNS A for topovik.com)'
fi

if [ -f /etc/letsencrypt/live/topovik.com/fullchain.pem ]; then
  ln -sfn /etc/nginx/sites-available/topovik.com /etc/nginx/sites-enabled/topovik.com
  nginx -t && systemctl reload nginx
  systemctl enable --now certbot.timer 2>/dev/null || true
else
  echo 'no local LE cert yet — HTTP bootstrap remains enabled'
fi

echo DONE
curl -sI "http://127.0.0.1:${WEB_PORT}/" | head -10 || true
curl -sI "http://127.0.0.1:${CMS_PORT}/admin" | head -10 || true
curl -sI -H 'Host: topovik.com' http://127.0.0.1/ | head -10 || true
# sanity: vuca still up
curl -sI -H 'Host: vucadigital.by' http://127.0.0.1/ | head -8 || true
