# 🔄 Como Trocar o Modelo do Ollama

## 🎯 Modelos Recomendados

### Opção 1: llama3.2:3b (RECOMENDADO - Melhor Equilíbrio)
- ✅ **Velocidade:** 10-15 segundos
- ✅ **Qualidade:** ⭐⭐⭐⭐ Muito boa
- ✅ **RAM:** ~2GB
- ✅ **Seguimento de instruções:** Muito melhor que 1b

### Opção 2: llama3:8b (Melhor Qualidade)
- ✅ **Velocidade:** 20-30 segundos
- ✅ **Qualidade:** ⭐⭐⭐⭐⭐ Excelente
- ✅ **RAM:** ~5GB
- ✅ **Seguimento de instruções:** Excelente

## 📋 Passos para Trocar

### 1. Na VPS, baixar o modelo:

```bash
# Para llama3.2:3b (RECOMENDADO)
ollama pull llama3.2:3b

# OU para llama3:8b (melhor qualidade)
ollama pull llama3:8b
```

### 2. Verificar se o modelo foi baixado:

```bash
ollama list
```

Você deve ver o modelo na lista.

### 3. Atualizar o arquivo `.env` local:

```env
# Para llama3.2:3b
OLLAMA_MODEL=llama3.2:3b

# OU para llama3:8b
OLLAMA_MODEL=llama3:8b
```

### 4. Reiniciar o servidor:

```bash
npm run dev
```

## ✅ Resultado Esperado

Com `llama3.2:3b`:
- ✅ Respostas em 10-15 segundos
- ✅ Modelo segue as instruções CRITICAL corretamente
- ✅ Para de recusar ajudar
- ✅ Qualidade muito boa

Com `llama3:8b`:
- ✅ Respostas em 20-30 segundos
- ✅ Modelo segue perfeitamente as instruções
- ✅ Qualidade máxima
- ✅ Nunca recusa ajudar

## ⚠️ Por que o 1b não funciona?

O `llama3.2:1b` é muito pequeno (1 bilhão de parâmetros):
- ❌ Treinamento de segurança muito rígido
- ❌ Ignora instruções do system prompt
- ❌ Sempre recusa ajudar (comportamento padrão)
- ❌ Não consegue "aprender" com as instruções CRITICAL

Modelos maiores (3b, 8b) têm:
- ✅ Mais capacidade de seguir instruções
- ✅ Melhor compreensão de contexto
- ✅ Respeitam o system prompt
- ✅ Seguem as instruções CRITICAL corretamente

## 💡 Recomendação Final

**Use `llama3.2:3b`** - é o melhor equilíbrio:
- Rápido o suficiente (10-15s)
- Segue as instruções corretamente
- Qualidade muito boa
- Não recusa ajudar

