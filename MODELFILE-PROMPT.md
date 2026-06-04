# Prompt no Modelfile Ollama (VPS)

O prompt do chat **não vem mais do painel admin** nem do MongoDB. Ele fica em:

`deploy/modelfile/Modelfile`

O app usa o modelo **`orion-ai`** (custom), criado a partir desse arquivo.

## Editar o prompt

1. SSH na VPS:

```bash
cd /opt/orion-ai-docker
nano deploy/modelfile/Modelfile
```

2. Altere o bloco `SYSTEM """ ... """` (prompt completo Orion já está no repo; versão otimizada sem perder regras/etapas/sinais).

3. Recrie o modelo:

```bash
chmod +x scripts/rebuild-ollama-model.sh
./scripts/rebuild-ollama-model.sh
```

Se aparecer `no Modelfile or safetensors files found`, rode antes:

```bash
docker compose --env-file .env.docker up -d --force-recreate ollama-orion
./scripts/rebuild-ollama-model.sh
```

4. Reinicie só o app (opcional):

```bash
docker compose --env-file .env.docker up -d --force-recreate orion-app
```

## Variáveis (`.env.docker`)

```env
OLLAMA_USE_MODELFILE=1
OLLAMA_BASE_MODEL=llama3.2:3b
OLLAMA_MODEL=orion-ai
```

- **OLLAMA_BASE_MODEL** — modelo baixado do Ollama Hub (`FROM` no Modelfile deve ser o mesmo).
- **OLLAMA_MODEL** — nome do modelo custom usado pela API.

## Deploy completo

`./scripts/deploy-vps-docker.sh` já faz pull da base + `ollama create orion-ai`.

## Action Plan

O plano continua com prompt JSON curto na API (`/api/plan`), separado do Modelfile do chat.

## Painel admin

A aba de editar prompt foi removida. Instruções só neste arquivo e no Modelfile na VPS.
