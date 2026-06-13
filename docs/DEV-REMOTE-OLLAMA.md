# Dev local usando Ollama da VPS

Seu `.env` local pode apontar para o **mesmo MongoDB** (dados reais) e para o **Ollama da VPS** via túnel SSH. Não é necessário rodar Ollama no Windows.

## Passo a passo

### 1. Túnel SSH (terminal separado, deixe aberto)

**Stack Docker** (`orion-ollama` na porta **11435** do host):

```bash
# Use IP ou hostname completo — NÃO use só "srv1192543" (não resolve no Windows)
ssh -N -L 11435:127.0.0.1:11435 root@31.97.93.86
# ou
ssh -N -L 11435:127.0.0.1:11435 root@srv1192543.hstgr.cloud
```

**Ollama no host** (`use-host-ollama.sh`, porta **11434**):

```bash
ssh -N -L 11434:127.0.0.1:11434 root@31.97.93.86
```

### 2. Variáveis no `.env` local

Use o template `env.dev-remote-ollama.example` — copie para o seu `.env`:

```env
OLLAMA_URL=http://127.0.0.1:11435
OLLAMA_API_KEY=<igual ao OLLAMA_API_KEY do .env na VPS>
OLLAMA_MODEL=orion-ai
OLLAMA_PLAN_MODEL=llama3.2:3b
OLLAMA_USE_MODELFILE=1
OLLAMA_PLAN_TIMEOUT_MS=300000
```

### 3. Subir o dev

```bash
npx prisma generate
npm run dev
```

No log do `[0]` deve aparecer algo como:

```text
[dev-server] Ollama: http://127.0.0.1:11435
[dev-server] Ollama reachable ✓
```

Se aparecer **inalcançável**, o túnel não está aberto ou a porta está errada.

## Timeout de plano (120s)

Planos na VPS em CPU podem passar de 2 minutos se a fila estiver cheia. Aumente no `.env`:

```env
OLLAMA_PLAN_TIMEOUT_MS=300000
```

## Segurança

- **Nunca** `prisma migrate reset` no banco de produção.
- `prisma db push` só adiciona campos/coleções — confira que o output é `[+]` apenas.
- Dev com Mongo de produção = usuários e conversas reais; teste com cuidado.

## Alternativa sem túnel

Expor a porta Ollama na VPS publicamente **não é recomendado**. O túnel SSH é o caminho mais seguro.
