# Performance na VPS (KVM8) — o que é real

## Docker não é o problema

Overhead do Docker em CPU/RAM para Ollama é tipicamente **1–5%**. O gargalo é **inferência LLM em CPU** (tokens/segundo), não o container.

Uma **KVM8** (8 vCPU + ~32 GB RAM) aguenta **muitos usuários cadastrados**, mas só **poucos chats/planos ao mesmo tempo** com latência boa — isso é física do modelo, não “VPS fraca”.

## Metas realistas (CPU + `llama3.2:3b`)

| Cenário | Latência típica |
|--------|------------------|
| 1 usuário, chat (`orion-ai`) | **15–45 s** (primeiro token pode demorar) |
| 1 usuário, plano (`llama3.2:3b`) | **25–40 s** |
| 4–8 usuários simultâneos | **30–90 s** cada (fila) |
| 50 simultâneos (stress test) | **minutos** — não é meta de produção |

Meta **&lt; 30 s sempre** em CPU puro com prompt grande **não é garantível** sem GPU ou modelo/host mais rápido.

## O que já acelera no código

- Chat: `num_predict` menor, `num_ctx` 2048 no Modelfile, histórico 2 mensagens
- Plano: modelo base `llama3.2:3b` (sem Modelfile pesado)
- Fila: `OLLAMA_APP_MAX_CONCURRENT` — evita fila de 4+ minutos
- `OLLAMA_NUM_THREADS=8` no container Ollama (usa os vCPUs da KVM8)

## O que acelera de verdade (ordem de impacto)

### 1. Usar o Ollama do host na porta 11434 (se tiver modelo maior/GPU)

Se no host já existe Ollama com **GPU** ou modelo otimizado:

```env
OLLAMA_URL=http://host.docker.internal:11434
```

Ver `DEPLOY-DOCKER.md` → “Migrar para o Ollama grande do host”.

### 2. Quantização mais agressiva

No container:

```bash
ollama pull llama3.2:3b
# ou variantes Q4 se disponíveis no catálogo
```

Menos bits → mais tokens/s em CPU.

### 3. Ajustar concorrência na KVM8

`.env.docker`:

```env
OLLAMA_NUM_PARALLEL=8
OLLAMA_NUM_THREADS=8
OLLAMA_APP_MAX_CONCURRENT=6
OLLAMA_QUEUE_MAX_WAIT_MS=45000
```

Mais de 6–8 inferências paralelas em CPU costuma **piorar** o tempo por usuário.

### 4. Rebuild do Modelfile após mudar `num_ctx`

```bash
./scripts/rebuild-ollama-model.sh
```

### 5. Próximo nível (hardware)

- GPU na VPS ou servidor dedicado com CUDA
- API cloud só para pico (não é o escopo atual do branch Ollama-only)

## Dados não se perdem

| Dado | Onde fica |
|------|-----------|
| Mensagens do chat | MongoDB — `Conversation.messages` (salvo pelo app após cada resposta) |
| Plano gerado | MongoDB — `Conversation.actionPlan` (salvo ao gerar `/api/plan`) |

Ao reabrir a aba **Action Plan** e escolher a conversa, o plano salvo é carregado de novo.

Após `git pull` + redeploy, rode na VPS (uma vez):

```bash
docker compose --env-file .env.docker exec orion-app npx prisma db push
```
