#!/usr/bin/env bash
# Deploy Orion em Docker na VPS — branch de teste, sem mexer em main/produção Vercel.
# Não para nem reconfigura o Ollama do host na porta 11434.
set -euo pipefail

REPO_URL="${ORION_REPO_URL:-https://github.com/clinigrow2023-arch/ORION-AI-5.git}"
BRANCH="${ORION_GIT_BRANCH:-feature/vps-ollama-only}"
INSTALL_DIR="${ORION_INSTALL_DIR:-/opt/orion-ai-docker}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
ENV_FILE="${ENV_FILE:-.env.docker}"
MODEL="${OLLAMA_MODEL:-llama3.2:3b}"

log() { echo "[orion-deploy] $*"; }

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não encontrado. Instale Docker Engine + Compose plugin na VPS."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose (plugin) não encontrado."
  exit 1
fi

mkdir -p "$(dirname "$INSTALL_DIR")"

if [ ! -d "$INSTALL_DIR/.git" ]; then
  log "Clonando $REPO_URL (branch $BRANCH) em $INSTALL_DIR"
  git clone -b "$BRANCH" --single-branch "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

log "Atualizando código ($BRANCH)..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f env.docker.example ]; then
    cp env.docker.example "$ENV_FILE"
    log "Criado $ENV_FILE a partir de env.docker.example — edite os segredos e rode de novo."
    exit 1
  fi
  echo "Arquivo $ENV_FILE ausente. Copie env.docker.example e preencha."
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

log "Build e subida dos containers..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --pull
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

log "Aguardando Ollama do stack..."
for i in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T ollama-orion ollama list >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T ollama-orion ollama show "$MODEL" >/dev/null 2>&1; then
  log "Modelo $MODEL já presente no volume do container."
else
  log "Baixando modelo $MODEL (pode demorar na primeira vez)..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T ollama-orion ollama pull "$MODEL"
fi

APP_PORT="${ORION_APP_HOST_PORT:-3001}"
OLLAMA_PORT="${OLLAMA_ORION_HOST_PORT:-11435}"

log "Pronto."
log "  App:    http://$(hostname -f 2>/dev/null || echo localhost):${APP_PORT}"
log "  Ollama: http://127.0.0.1:${OLLAMA_PORT} (stack novo — host :11434 intacto)"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
