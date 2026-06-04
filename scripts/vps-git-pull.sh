#!/usr/bin/env bash
# Atualiza /opt/orion-ai-docker sem perder .env.docker (descarta diff só em scripts rastreados com conflito comum)
set -euo pipefail
cd "${ORION_INSTALL_DIR:-/opt/orion-ai-docker}"

echo "[git] status:"
git status -sb

if ! git diff --quiet scripts/run-load-test-vps.sh 2>/dev/null; then
  echo "[git] Restoring scripts/run-load-test-vps.sh from remote (local VPS edits discarded)"
  git checkout -- scripts/run-load-test-vps.sh || true
fi

git pull origin "${ORION_GIT_BRANCH:-feature/vps-ollama-only}"
echo "[git] OK at $(git rev-parse --short HEAD)"
