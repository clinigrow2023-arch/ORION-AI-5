# ⚡⚡⚡ GROQ - Respostas ULTRA RÁPIDAS (1-3 segundos)

## 🚀 Por que Groq?

**Groq é EXTREMAMENTE RÁPIDO!**

- Respostas em **1-3 segundos** (vs 27s do Ollama)
- API gratuita com boa quota
- Modelo poderoso (llama-3.3-70b-versatile)

## ✅ Configuração

### 1. Obter API Key do Groq

1. Acesse: https://console.groq.com/
2. Crie uma conta (gratuita)
3. Vá em **API Keys**
4. Crie uma nova chave
5. Copie a chave (começa com `gsk_...`)

### 2. Adicionar ao .env

```env
GROQ_API_KEY=gsk_sua-chave-aqui
```

### 3. Reiniciar Servidor

```bash
npm run dev
```

## 📊 Comparação de Velocidade

| Provider | Tempo Médio      | Status              |
| -------- | ---------------- | ------------------- |
| **Groq** | **1-3 segundos** | ⚡⚡⚡ ULTRA RÁPIDO |
| Ollama   | 27 segundos      | 🐌 Lento            |
| OpenAI   | 3-5 segundos     | ⚡ Rápido           |

## 🎯 Como Funciona

O sistema tenta na seguinte ordem:

1. **Ollama (llama3)** - **PRIMEIRO** (sempre)
2. **Groq** (se configurado) - fallback se Ollama falhar ⚡
3. **OpenAI** (se configurado) - fallback se ambos falharem

## ⚠️ Se Groq Não Estiver Configurado

O sistema sempre tentará Ollama primeiro. Se Ollama falhar e Groq não estiver configurado, tentará OpenAI (se configurado).

## 💡 Dica

Se você tem a chave do Groq comentada no `.env`, descomente:

```env
# Antes (comentado):
# GROQ_API_KEY=your_groq_api_key_here

# Depois (ativo):
GROQ_API_KEY=your_groq_api_key_here
```

## 🎉 Resultado

Com Groq configurado, suas respostas serão **10x mais rápidas**!

**Antes:** 27 segundos
**Agora:** **1-3 segundos** 🚀
