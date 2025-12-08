# AI Providers System

Sistema de fallback para múltiplos provedores de IA, garantindo alta disponibilidade.

## Estrutura

- `base.ts` - Interface comum e tipos para todos os providers
- `gemini.ts` - Implementação do provider Gemini (Google)
- `grok.ts` - Implementação do provider Grok (xAI)
- `fallback.ts` - Sistema de fallback sequencial
- `README.md` - Esta documentação

## Como Funciona

1. O sistema tenta os providers na ordem configurada em `fallback.ts`
2. Se um provider falhar (rate limit, quota, erro), tenta o próximo
3. Se todos falharem, retorna erro
4. Logs indicam qual provider foi usado com sucesso

## Adicionar Novo Provider

1. Crie um novo arquivo (ex: `openai.ts`) na pasta `ai-providers/`
2. Implemente a interface `AIProvider`:

```typescript
import { AIProvider, createProviderError, isRetryableError } from './base';

export class OpenAIProvider implements AIProvider {
  name = 'OpenAI';
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.apiKey = apiKey;
  }

  async sendMessage(
    message: string,
    history: Array<{ role: string; parts: Array<{ text: string }> }>,
    systemInstruction: string
  ): Promise<string> {
    // Implementar lógica de envio de mensagem
    // Converter history para formato da API
    // Fazer requisição HTTP
    // Retornar resposta
  }

  async generatePlan(
    contextHistory: string,
    systemInstruction: string
  ): Promise<string> {
    // Implementar lógica de geração de plano
    // Retornar JSON string
  }
}
```

3. Adicione o provider em `fallback.ts`:

```typescript
// Em createProviders()
const openaiKey = process.env.OPENAI_API_KEY;
if (openaiKey) {
  try {
    providers.push(new OpenAIProvider(openaiKey));
  } catch (error) {
    console.warn('⚠️ Failed to initialize OpenAI provider:', error);
  }
}
```

4. Adicione a variável de ambiente no README.md e no Netlify

## Variáveis de Ambiente

- `GEMINI_API_KEY` - Chave da API do Gemini (obrigatória)
- `GROK_API_KEY` - Chave da API do Grok/xAI (opcional, fallback)
- `OPENAI_API_KEY` - Chave da API do OpenAI (opcional, se adicionar)

## Tratamento de Erros

- Erros retryable (rate limit, quota, timeout): tenta próximo provider
- Erros não retryable (invalid API key, auth error): para o fallback chain
- Todos os providers falhando: retorna erro ao usuário

## Logs

O sistema registra:
- `🔄 Trying [Provider] for [operation]...` - Tentando provider
- `✅ [Provider] succeeded for [operation]` - Sucesso
- `❌ [Provider] failed for [operation]: [error]` - Falha
- `🚫 [Provider] error is not retryable, stopping fallback chain` - Erro fatal
