#!/usr/bin/env bash
# Túnel SSH: dev local → Ollama na VPS (porta Docker 11435)
# Uso: ./scripts/dev-ollama-tunnel.sh [user@host]
set -euo pipefail

# Padrão: IP da VPS Orion (Hostinger). Passe user@host se for outro.
REMOTE="${1:-root@31.97.93.86}"
LOCAL_PORT="${OLLAMA_TUNNEL_LOCAL_PORT:-11435}"
REMOTE_PORT="${OLLAMA_TUNNEL_REMOTE_PORT:-11435}"

echo "Abrindo túnel ${LOCAL_PORT} → ${REMOTE}:${REMOTE_PORT}"
echo "No .env local: OLLAMA_URL=http://127.0.0.1:${LOCAL_PORT}"
echo "Ctrl+C para fechar."
exec ssh -N -L "${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT}" "${REMOTE}"
