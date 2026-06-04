#!/usr/bin/env bash
# Recria o modelo custom orion-ai a partir de deploy/modelfile/Modelfile
set -euo pipefail

INSTALL_DIR="${ORION_INSTALL_DIR:-/opt/orion-ai-docker}"
ENV_FILE="${ENV_FILE:-.env.docker}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
BASE_MODEL="${OLLAMA_BASE_MODEL:-llama3.2:3b}"
CUSTOM_MODEL="${OLLAMA_MODEL:-orion-ai}"
CONTAINER="${OLLAMA_CONTAINER:-orion-ollama}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env-docker-helpers.sh
source "$SCRIPT_DIR/env-docker-helpers.sh"

cd "$INSTALL_DIR"

MODELFILE_HOST="$INSTALL_DIR/deploy/modelfile/Modelfile"
if [ ! -f "$MODELFILE_HOST" ]; then
  echo "[orion-model] ERRO: não encontrado: $MODELFILE_HOST"
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  load_ollama_vars_from_env_file "$ENV_FILE"
  BASE_MODEL="${OLLAMA_BASE_MODEL:-$BASE_MODEL}"
  CUSTOM_MODEL="${OLLAMA_MODEL:-$CUSTOM_MODEL}"
fi

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

echo "[orion-model] Base: $BASE_MODEL → custom: $CUSTOM_MODEL"

# Garante volume /modelfile montado (containers antigos podem não ter o bind)
if ! compose exec -T ollama-orion test -f /modelfile/Modelfile 2>/dev/null; then
  echo "[orion-model] Recriando ollama-orion para montar deploy/modelfile..."
  compose up -d --force-recreate ollama-orion
  sleep 5
fi

compose exec -T ollama-orion ollama pull "$BASE_MODEL"

if compose exec -T ollama-orion ollama show "$CUSTOM_MODEL" >/dev/null 2>&1; then
  echo "[orion-model] Removendo $CUSTOM_MODEL para rebuild..."
  compose exec -T ollama-orion ollama rm "$CUSTOM_MODEL" || true
fi

MODELFILE_ARG="/modelfile/Modelfile"
if ! compose exec -T ollama-orion test -f "$MODELFILE_ARG" 2>/dev/null; then
  echo "[orion-model] Copiando Modelfile para /tmp/Modelfile no container..."
  docker cp "$MODELFILE_HOST" "${CONTAINER}:/tmp/Modelfile"
  MODELFILE_ARG="/tmp/Modelfile"
fi

echo "[orion-model] Criando modelo com -f $MODELFILE_ARG"
compose exec -T ollama-orion ollama create "$CUSTOM_MODEL" -f "$MODELFILE_ARG"

echo "[orion-model] OK — modelo $CUSTOM_MODEL criado."
compose exec -T ollama-orion ollama list | grep -E "NAME|${CUSTOM_MODEL}" || true
