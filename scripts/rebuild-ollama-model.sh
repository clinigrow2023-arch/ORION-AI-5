#!/usr/bin/env bash
# Recria o modelo custom orion-ai a partir de deploy/modelfile/Modelfile
set -euo pipefail

INSTALL_DIR="${ORION_INSTALL_DIR:-/opt/orion-ai-docker}"
ENV_FILE="${ENV_FILE:-.env.docker}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
BASE_MODEL="${OLLAMA_BASE_MODEL:-llama3.2:3b}"
CUSTOM_MODEL="${OLLAMA_MODEL:-orion-ai}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env-docker-helpers.sh
source "$SCRIPT_DIR/env-docker-helpers.sh"

cd "$INSTALL_DIR"

if [ -f "$ENV_FILE" ]; then
  load_ollama_vars_from_env_file "$ENV_FILE"
  BASE_MODEL="${OLLAMA_BASE_MODEL:-$BASE_MODEL}"
  CUSTOM_MODEL="${OLLAMA_MODEL:-$CUSTOM_MODEL}"
fi

echo "[orion-model] Base: $BASE_MODEL → custom: $CUSTOM_MODEL"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T ollama-orion ollama pull "$BASE_MODEL"

if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T ollama-orion ollama show "$CUSTOM_MODEL" >/dev/null 2>&1; then
  echo "[orion-model] Removendo $CUSTOM_MODEL para rebuild..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T ollama-orion ollama rm "$CUSTOM_MODEL" || true
fi

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T ollama-orion \
  ollama create "$CUSTOM_MODEL" -f /modelfile/Modelfile

echo "[orion-model] OK. Teste: ollama run $CUSTOM_MODEL \"Hello\""
