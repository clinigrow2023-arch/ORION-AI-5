#!/usr/bin/env bash
# Aponta orion-app para Ollama do host (:11434). NÃO para o systemd Ollama de produção.
# Para o container orion-ollama (11435) — host 11434 continua rodando.
set -euo pipefail

INSTALL_DIR="${ORION_INSTALL_DIR:-/opt/orion-ai-docker}"
ENV_FILE="${ENV_FILE:-.env}"
COMPOSE="-f docker-compose.yml -f docker-compose.host-ollama.yml"

cd "$INSTALL_DIR"

echo "[host-ollama] Verificando Ollama no host (11434)..."
if ! curl -sf "http://127.0.0.1:11434/api/tags" >/dev/null; then
  echo "ERRO: Ollama não responde em 127.0.0.1:11434. Inicie o serviço do host antes."
  exit 1
fi

echo "[host-ollama] Modelos no host:"
curl -s "http://127.0.0.1:11434/api/tags" | head -c 400 || true
echo ""

if ! grep -q '^OLLAMA_HOST_URL=' "$ENV_FILE" 2>/dev/null; then
  echo 'OLLAMA_HOST_URL=http://host.docker.internal:11434' >> "$ENV_FILE"
fi

if grep -q '^OLLAMA_URL=' "$ENV_FILE"; then
  sed -i.bak 's|^OLLAMA_URL=.*|OLLAMA_URL=http://host.docker.internal:11434|' "$ENV_FILE"
else
  echo 'OLLAMA_URL=http://host.docker.internal:11434' >> "$ENV_FILE"
fi

echo "[host-ollama] Parando apenas container orion-ollama (11435)..."
docker compose --env-file "$ENV_FILE" stop ollama-orion 2>/dev/null || true

echo "[host-ollama] Recriando orion-app com Ollama do host..."
docker compose --env-file "$ENV_FILE" $COMPOSE build orion-app
docker compose --env-file "$ENV_FILE" $COMPOSE up -d --force-recreate orion-app

echo ""
echo "Pronto. App usa host :11434. Container orion-ollama parado."
echo "Crie o modelo no host se faltar:"
echo "  cd $INSTALL_DIR && OLLAMA_HOST=127.0.0.1:11434 ./scripts/rebuild-ollama-model.sh"
echo ""
echo "Voltar ao Ollama do container:"
echo "  ./scripts/use-container-ollama.sh"
