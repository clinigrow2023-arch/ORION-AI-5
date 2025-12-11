# ⚡ Otimizações de Performance - Ollama

## Problema
Respostas estavam demorando **52+ segundos**, o que é muito lento para uma experiência de chat.

## Otimizações Implementadas

### 1. ✅ Limitação de Histórico de Conversa
**Antes:** Enviava todo o histórico (pode ser centenas de mensagens)
**Agora:** Limita às últimas **10 mensagens** (5 turnos de conversa)

**Impacto:** Reduz drasticamente o tamanho do prompt, acelerando processamento.

```typescript
const MAX_HISTORY_MESSAGES = 10;
const limitedHistory = history.slice(-MAX_HISTORY_MESSAGES);
```

### 2. ✅ Truncamento de Mensagens Longas
**Antes:** Enviava mensagens completas (podem ter milhares de caracteres)
**Agora:** Limita cada mensagem do histórico a **500 caracteres**

**Impacto:** Reduz ainda mais o tamanho do prompt.

### 3. ✅ Limitação de System Instruction
**Antes:** System instruction completa (pode ter 5000+ caracteres)
**Agora:** Limita a **2000 caracteres** se muito longa

**Impacto:** Reduz tempo de processamento do prompt.

### 4. ✅ Limitação de Tokens Gerados
**Antes:** Sem limite (modelo gerava até completar)
**Agora:** Máximo de **512 tokens** por resposta (`num_predict: 512`)

**Impacto:** Respostas mais rápidas e concisas. 512 tokens ≈ 400 palavras, suficiente para a maioria das respostas.

### 5. ✅ Otimizações de Sampling
- `top_p: 0.9` - Nucleus sampling (mais rápido)
- `repeat_penalty: 1.1` - Reduz repetição
- `temperature: 0.7` - Mantido (balance entre criatividade e velocidade)

**Impacto:** Geração de tokens mais eficiente.

### 6. ✅ Timeout Otimizado
**Antes:** 120 segundos
**Agora:** 90 segundos (com otimizações, deve ser suficiente)

## Resultado Esperado

**Antes:** ~52 segundos
**Esperado:** **15-25 segundos** (redução de 50-70%)

## Como Funciona

1. **Histórico limitado:** Apenas contexto recente é enviado
2. **Prompt menor:** Menos tokens para processar = mais rápido
3. **Resposta limitada:** 512 tokens = resposta rápida e focada
4. **Sampling otimizado:** Algoritmos mais eficientes

## Trade-offs

### ✅ Vantagens
- **Muito mais rápido** (50-70% de redução)
- **Menor uso de recursos** no servidor
- **Respostas mais focadas** (não fica divagando)

### ⚠️ Limitações
- **Contexto limitado:** Apenas últimas 10 mensagens
- **Respostas mais curtas:** Máximo 512 tokens (~400 palavras)
- **Mensagens antigas:** Não são consideradas após 10 mensagens

## Ajustes Futuros

Se precisar de mais contexto ou respostas mais longas, você pode ajustar:

```typescript
// Em api/ai-providers/ollama3.ts

// Mais histórico (mais lento)
const MAX_HISTORY_MESSAGES = 20; // ao invés de 10

// Respostas mais longas (mais lento)
num_predict: 1024, // ao invés de 512
```

## Monitoramento

Os logs agora mostram:
- Quantas mensagens foram truncadas
- Tamanho do prompt final
- Tempo de resposta

Exemplo:
```
[Ollama3] History truncated from 25 to 10 messages for performance
[Ollama3] Request body prepared, model: llama3:8b, prompt length: 2500
[Ollama3] Response received after 18.5 seconds
```

## Próximos Passos

1. **Teste as mudanças** - Reinicie o servidor
2. **Monitore os logs** - Veja o tempo de resposta
3. **Ajuste se necessário** - Se ainda estiver lento, considere:
   - Usar um modelo menor (llama3:3b ao invés de 8b)
   - Ativar fallback providers (Groq é muito rápido)
   - Implementar cache para respostas similares

