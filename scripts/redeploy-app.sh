#!/usr/bin/env bash
# Rebuild da imagem orion-app (obrigatório após git pull — recreate sozinho usa imagem antiga)
set -euo pipefail

INSTALL_DIR="${ORION_INSTALL_DIR:-/opt/orion-ai-docker}"
ENV_FILE="${ENV_FILE:-.env.docker}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

cd "$INSTALL_DIR"

echo "[orion-app] Building orion-app image (sem cache se Prisma falhou antes)..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --pull --no-cache orion-app

echo "[orion-app] Restarting container..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate orion-app

sleep 3
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs orion-app --tail 8

echo "[orion-app] Logs devem mostrar: Prompt: Modelfile (no API system field)"
