#!/usr/bin/env bash
# Atualiza /opt/orion-ai-docker sem perder .env (descarta edits locais em scripts/)
set -euo pipefail
cd "${ORION_INSTALL_DIR:-/opt/orion-ai-docker}"

BRANCH="${ORION_GIT_BRANCH:-feature/vps-ollama-only}"

echo "[git] status:"
git status -sb

# VPS não deve manter fork de scripts — descarta diffs locais em scripts/ antes do pull
if modified=$(git diff --name-only scripts/ 2>/dev/null || true); then
  if [ -n "$modified" ]; then
    echo "[git] Descartando alterações locais em scripts/ (VPS usa só o repo):"
    echo "$modified" | sed 's/^/  /'
    git checkout -- scripts/ || true
  fi
fi

git pull origin "$BRANCH"
echo "[git] OK at $(git rev-parse --short HEAD)"

if [ -f .env.docker ] && [ ! -f .env ]; then
  echo "[env] Migrando .env.docker → .env"
  mv .env.docker .env
elif [ -f .env.docker ] && [ -f .env ]; then
  echo "[env] .env e .env.docker existem — use só .env (compose não lê mais .env.docker)"
fi

echo "[git] Próximo passo: ./scripts/redeploy-app.sh"
