# Deploy Docker na VPS (sem derrubar Ollama de produção)

Stack em containers na branch **`feature/vps-ollama-only`**. A **`main`** e a Vercel **não são alteradas** por este fluxo.

## Arquitetura

| Serviço | Container | Porta no host | Notas |
|---------|-----------|---------------|--------|
| Ollama legado (produção) | *(host, systemd)* | **11434** | **Não é tocado** por este compose |
| Ollama Orion (novo) | `orion-ollama` | **11435** | Modelo menor, volume Docker próprio |
| App Orion | `orion-app` | **3001** (padrão) | React + API |

O app fala com `http://ollama-orion:11434` **dentro da rede Docker**, nunca com `127.0.0.1:11434`.

Modelo padrão do stack novo: **`llama3.2:3b`** (leve). Ajuste em `.env.docker`:

```env
OLLAMA_MODEL=llama3.2:3b
```

## Pré-requisitos na VPS (KVM8)

- Docker Engine + plugin Compose v2
- Git
- `.env.docker` com segredos (MongoDB, JWT, Gmail, Digistore)

## Primeira instalação

```bash
# Na VPS
sudo mkdir -p /opt/orion-ai-docker
sudo curl -fsSL https://raw.githubusercontent.com/clinigrow2023-arch/ORION-AI-5/feature/vps-ollama-only/scripts/deploy-vps-docker.sh -o /usr/local/bin/orion-docker-deploy.sh
sudo chmod +x /usr/local/bin/orion-docker-deploy.sh

# Ou clone manual e rode o script do repo
git clone -b feature/vps-ollama-only https://github.com/clinigrow2023-arch/ORION-AI-5.git /opt/orion-ai-docker
cd /opt/orion-ai-docker
cp env.docker.example .env.docker
nano .env.docker   # preencher DATABASE_URL, JWT_SECRET, SITE_URL, etc.

./scripts/deploy-vps-docker.sh
```

Variáveis opcionais do script:

```bash
export ORION_INSTALL_DIR=/opt/orion-ai-docker
export ORION_GIT_BRANCH=feature/vps-ollama-only
export ORION_REPO_URL=https://github.com/clinigrow2023-arch/ORION-AI-5.git
./scripts/deploy-vps-docker.sh
```

## Atualizar depois de mudanças no Git

```bash
cd /opt/orion-ai-docker
./scripts/deploy-vps-docker.sh
```

O script faz `git pull`, **`docker compose build orion-app`** (importante) e `up -d`, e garante o modelo no Ollama **do container**.

**Atenção:** `docker compose up -d --force-recreate orion-app` **sem build** reutiliza a imagem antiga. Após `git pull`, rode:

```bash
./scripts/redeploy-app.sh
```

Logs corretos do app:

```text
Prompt: Modelfile (no API system field)
[Ollama] chat model=orion-ai ... systemLen=0
```

## Comandos úteis

```bash
cd /opt/orion-ai-docker
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f orion-app
docker compose --env-file .env.docker logs -f ollama-orion
docker compose --env-file .env.docker exec ollama-orion ollama list
```

Parar só o stack Docker (Ollama do host continua):

```bash
docker compose --env-file .env.docker down
```

## Domínio (ex.: orion.orionaii.com)

DNS: registro **A** `orion` → `31.97.93.86` (já configurado no painel).

Na VPS:

```bash
apt update && apt install -y nginx certbot python3-certbot-nginx
cp /opt/orion-ai-docker/deploy/nginx-orion.conf /etc/nginx/sites-available/orion
ln -sf /etc/nginx/sites-available/orion /etc/nginx/sites-enabled/orion
rm -f /etc/nginx/sites-enabled/default   # se existir e conflitar
nginx -t && systemctl reload nginx
ufw allow 80/tcp && ufw allow 443/tcp

certbot --nginx -d orion.orionaii.com
```

Atualize `.env.docker`:

```env
SITE_URL=https://orion.orionaii.com
```

```bash
cd /opt/orion-ai-docker
docker compose --env-file .env.docker up -d --force-recreate orion-app
```

Teste: `https://orion.orionaii.com` (sem `:3001`).

Digistore IPN (quando for cortar Vercel): `https://orion.orionaii.com/api/digistore-ipn`

## Migrar para o Ollama grande do host (futuro)

Quando quiser usar o Ollama já existente na 11434, **sem** o container `ollama-orion`:

1. No `.env.docker`, defina `OLLAMA_URL=http://host.docker.internal:11434` (Linux: adicione em `docker-compose.yml` under `orion-app`:

   ```yaml
   extra_hosts:
     - "host.docker.internal:host-gateway"
   ```

2. Remova ou comente o serviço `ollama-orion` e a dependência `depends_on`.
3. Use o mesmo `OLLAMA_MODEL` que já está no host.

Até lá, os dois Ollamas coexistem: produção em **11434**, teste Orion em **11435**.

## Persistência (chat + plano)

- **Chat:** mensagens em `Conversation.messages` (MongoDB).
- **Plano:** após gerar, gravado em `Conversation.actionPlan` na mesma conversa.

Após deploy com campo novo no schema:

```bash
docker compose --env-file .env.docker exec orion-app npx prisma db push
```

Detalhes e metas de latência: **`docs/PERFORMANCE-VPS.md`**.

## Performance e escala (~1000 usuários)

Respostas **quase instantâneas** com LLM local em CPU não são realistas; o alvo é **5–12 s no chat** e **15–30 s no Action Plan** após otimizações.

**Prompt do chat:** embutido no modelo Ollama `orion-ai` via `deploy/modelfile/Modelfile` (não usa mais painel admin). Ver `MODELFILE-PROMPT.md`.

**Já no código:** histórico curto (2 msgs), `num_predict` menor, endpoint `/api/plan` dedicado (JSON compacto).

**Na VPS (`.env.docker`):**

```env
OLLAMA_NUM_PARALLEL=8
OLLAMA_PLAN_MODEL=llama3.2:3b
```

Chat usa `orion-ai` (Modelfile). **Plano** usa `llama3.2:3b` (sem system gigante) — evita timeout de 180s.

**Nginx:** `proxy_read_timeout 300s` em `deploy/nginx-orion.conf`.

**Teste de carga (50 usuários simultâneos):**

```bash
cd /opt/orion-ai-docker
git pull
./scripts/redeploy-app.sh

export LOAD_TEST_URL=https://orionaii.com
export LOAD_TEST_EMAIL=seu@email.com
export LOAD_TEST_PASSWORD=sua_senha
export LOAD_TEST_CONCURRENT=50
# planos: no máximo 10 em paralelo (CPU); desligar com LOAD_TEST_PLAN=0
./scripts/run-load-test-vps.sh
```

Requer `git pull` + `./scripts/redeploy-app.sh` (código do plano) e `docker compose up -d --force-recreate orion-app` (volume `./scripts`).

Sem rebuild, só o teste (após `git pull`):

```bash
docker compose --env-file .env.docker up -d --force-recreate orion-app
export LOAD_TEST_EMAIL=... LOAD_TEST_PASSWORD=...
./scripts/run-load-test-vps.sh
```

**Interpretação (exemplo real):** 50 chats OK mas p50 ~150s = CPU saturada; mensagem real durante o teste pode levar ~4 min. Isso é esperado no stress test.

**Teste realista** (8 usuários + 1 plano por vez):

```bash
export LOAD_TEST_CONCURRENT=8
export LOAD_TEST_PLAN_CONCURRENT=1
export LOAD_TEST_PLAN=1
./scripts/run-load-test-vps.sh
```

**Proteção em produção** (após `git pull` + redeploy):

```env
OLLAMA_APP_MAX_CONCURRENT=4
OLLAMA_QUEUE_MAX_WAIT_MS=45000
```

Acima de 4 inferências simultâneas, novos pedidos esperam até ~45s e recebem **503 BUSY** em vez de ficar 4 min na fila.

Stress (10 planos paralelos): `LOAD_TEST_STRESS=1 ./scripts/run-load-test-vps.sh`

**Para máxima velocidade (quando validar):** apontar o app para o Ollama **8B do host** (`:11434`) com GPU/RAM — ver seção “Migrar para o Ollama grande”.

**Escala:** 1000 usuários cadastrados OK; picos simultâneos limitados pelo CPU. KVM8 + `OLLAMA_NUM_PARALLEL=8` aguenta dezenas de chats leves; 50 simultâneos reais exigem GPU ou vários nós.
