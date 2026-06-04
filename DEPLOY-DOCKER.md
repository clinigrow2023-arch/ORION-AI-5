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

O script faz `git pull` na branch de feature, `docker compose build` e `up -d`, e garante o modelo no Ollama **do container**.

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

## Nginx (app na 3001)

```nginx
location / {
  proxy_pass http://127.0.0.1:3001;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_buffering off;
}
```

`SITE_URL` em `.env.docker` deve ser o domínio público (IPN Digistore, links de e-mail).

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
