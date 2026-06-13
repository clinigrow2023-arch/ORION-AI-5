#!/usr/bin/env bash
# Run 50-user load test against Orion (VPS).
set -euo pipefail

INSTALL_DIR="${ORION_INSTALL_DIR:-/opt/orion-ai-docker}"
ENV_FILE="${ENV_FILE:-.env}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

cd "$INSTALL_DIR"

: "${LOAD_TEST_URL:=https://orionaii.com}"
: "${LOAD_TEST_EMAIL:?Set LOAD_TEST_EMAIL}"
: "${LOAD_TEST_PASSWORD:?Set LOAD_TEST_PASSWORD}"
: "${LOAD_TEST_CONCURRENT:=50}"

if [[ ! -f scripts/load-test-50.mjs ]]; then
  echo "Missing scripts/load-test-50.mjs — run: git pull"
  exit 1
fi

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d orion-app

if ! docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec orion-app \
  test -f /app/scripts/load-test-50.mjs; then
  echo "Script not in container. Recreate app (mounts ./scripts):"
  echo "  docker compose --env-file $ENV_FILE up -d --force-recreate orion-app"
  exit 1
fi

echo "Load test → $LOAD_TEST_URL (${LOAD_TEST_CONCURRENT} chats)"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec \
  -e LOAD_TEST_URL \
  -e LOAD_TEST_EMAIL \
  -e LOAD_TEST_PASSWORD \
  -e LOAD_TEST_CONCURRENT \
  -e LOAD_TEST_PLAN="${LOAD_TEST_PLAN:-1}" \
  -e LOAD_TEST_PLAN_CONCURRENT="${LOAD_TEST_PLAN_CONCURRENT:-2}" \
  -e LOAD_TEST_STRESS="${LOAD_TEST_STRESS:-0}" \
  orion-app node /app/scripts/load-test-50.mjs
