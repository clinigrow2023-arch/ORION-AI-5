#!/usr/bin/env bash
# Volta orion-app para o Ollama do container (11435 → orion-ollama).
set -euo pipefail

INSTALL_DIR="${ORION_INSTALL_DIR:-/opt/orion-ai-docker}"
ENV_FILE="${ENV_FILE:-.env}"

cd "$INSTALL_DIR"

if grep -q '^OLLAMA_URL=' "$ENV_FILE"; then
  sed -i.bak 's|^OLLAMA_URL=.*|OLLAMA_URL=http://ollama-orion:11434|' "$ENV_FILE"
fi

docker compose --env-file "$ENV_FILE" up -d ollama-orion
docker compose --env-file "$ENV_FILE" build orion-app
docker compose --env-file "$ENV_FILE" up -d --force-recreate orion-app

echo "[container-ollama] App → http://ollama-orion:11434 (host port 11435)"
