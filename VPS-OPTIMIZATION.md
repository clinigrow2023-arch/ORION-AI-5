# 🚀 Otimizações na VPS para Ollama Mais Rápido

## 🔍 Problema Atual

Mesmo com otimizações no código, o Ollama ainda está demorando **46 segundos**. Isso indica que o problema está no **servidor VPS**, não no código.

## ⚡ Soluções na VPS

### 1. Usar Modelo Menor (RECOMENDADO)

O modelo `llama3:8b` é pesado. Use um modelo menor:

```bash
# Na VPS, baixe um modelo menor
ollama pull llama3.2:3b

# Ou ainda menor
  ollama pull llama3.2:1b
```

**Impacto:** Respostas 3-5x mais rápidas (10-15 segundos ao invés de 46s)

### 2. Verificar Recursos da VPS

```bash
# Verificar CPU
lscpu

# Verificar RAM
free -h

# Verificar uso do Ollama
ps aux | grep ollama
```

**Recomendações:**

- Mínimo: 2 CPU cores, 4GB RAM
- Ideal: 4 CPU cores, 8GB RAM
- Para llama3:8b: 4+ cores, 8GB+ RAM

### 3. Otimizar Configuração do Ollama

Edite o arquivo de configuração do Ollama:

```bash
# Localizar arquivo de config
find /etc -name "ollama" 2>/dev/null
# ou
find ~/.ollama -name "config" 2>/dev/null
```

Adicione/edite:

```yaml
# Configurações de performance
OLLAMA_NUM_PARALLEL: 1
OLLAMA_MAX_LOADED_MODELS: 1
OLLAMA_NUM_GPU: 0 # Se não tiver GPU
```

### 4. Limitar Contexto no Servidor

O código já limita, mas você pode forçar no servidor:

```bash
# Variável de ambiente
export OLLAMA_NUM_CTX=2048
export OLLAMA_NUM_PREDICT=150
```

### 5. Usar GPU (se disponível)

Se a VPS tiver GPU:

```bash
# Verificar GPU
nvidia-smi

# Ollama detecta GPU automaticamente
# Mas você pode forçar:
export OLLAMA_NUM_GPU=1
```

**Impacto:** Respostas 5-10x mais rápidas com GPU

### 6. Reiniciar Ollama com Otimizações

```bash
# Parar Ollama
sudo systemctl stop ollama

# Iniciar com variáveis otimizadas
OLLAMA_NUM_CTX=2048 OLLAMA_NUM_PREDICT=150 ollama serve

# Ou se usar systemd, edite o serviço:
sudo systemctl edit ollama
```

Adicione:

```ini
[Service]
Environment="OLLAMA_NUM_CTX=2048"
Environment="OLLAMA_NUM_PREDICT=150"
```

### 7. Usar Modelo Quantizado Menor

Modelos quantizados são mais rápidos:

```bash
# Baixar versão quantizada
ollama pull llama3.2:3b-q4_0
```

## 📊 Comparação de Modelos

| Modelo      | Tamanho | Velocidade               | Qualidade            |
| ----------- | ------- | ------------------------ | -------------------- |
| llama3:8b   | 4.7GB   | 🐌 Lento (46s)           | ⭐⭐⭐⭐⭐ Excelente |
| llama3.2:3b | 2.0GB   | ⚡ Rápido (10-15s)       | ⭐⭐⭐⭐ Muito boa   |
| llama3.2:1b | 0.7GB   | ⚡⚡ Muito rápido (5-8s) | ⭐⭐⭐ Boa           |

## 🎯 Solução Rápida (Recomendada)

**1. Baixar modelo menor na VPS:**

```bash
ollama pull llama3.2:3b
```

**2. Atualizar .env:**

```env
OLLAMA_MODEL=llama3.2:3b
```

**3. Reiniciar servidor:**

```bash
npm run dev
```

**Resultado esperado:** 10-15 segundos (vs 46s atual)

## 🔧 Verificar Performance Atual

Na VPS, teste diretamente:

```bash
# Teste simples
time ollama run llama3:8b "Hello, how are you?"

# Teste com parâmetros otimizados
time curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3:8b",
    "prompt": "Hello",
    "num_ctx": 2048,
    "num_predict": 150,
    "stream": false
  }'
```

## 💡 Dica Final

Se a VPS for muito limitada, considere:

1. **Upgrade de recursos** (mais CPU/RAM)
2. **Usar Groq como fallback** (1-3 segundos, gratuito)
3. **Usar modelo muito menor** (llama3.2:1b para respostas instantâneas)
