import { prisma } from "../_prisma.js";
import { DEFAULT_LOCALE, type Locale } from "../../lib/locale.js";
import { AIProvider, AIProviderError, createProviderError } from "./base.js";
import { Ollama3Provider } from "./ollama3.js";
import {
  DEFAULT_SYSTEM_PROMPT,
  ensureOrionGuardrails,
  withLanguageDirective,
} from "../../lib/prompt-defaults.js";

// GroqProvider não está mais disponível após remoção do arquivo
const GroqProvider = null;

// Cache do prompt por idioma para evitar múltiplas queries
const CACHE_TTL = 10000; // 10 segundos (reduzido para garantir atualização)
const promptCache = new Map<Locale, { prompt: string; timestamp: number }>();

/**
 * Busca o prompt do idioma pedido. Registros anteriores ao i18n não têm
 * `locale`, então em inglês eles também são aceitos.
 */
async function findStoredPrompt(locale: Locale): Promise<string | null> {
  const localeFilter =
    locale === DEFAULT_LOCALE
      ? { OR: [{ locale }, { locale: null }] }
      : { locale };

  const systemPrompt = await prisma.systemPrompt.findFirst({
    where: localeFilter,
    orderBy: { updatedAt: "desc" },
  });

  const prompt = systemPrompt?.prompt?.trim();
  return prompt ? prompt : null;
}

/**
 * System instruction efetiva para um idioma.
 *
 * Ordem: prompt do idioma > prompt em inglês > prompt padrão. A diretiva de
 * idioma é sempre anexada por último, então o usuário recebe a resposta no seu
 * idioma mesmo quando só existe o prompt em inglês.
 *
 * EXPORTADO para uso em outros serviços (geminiService, etc)
 */
export const getSystemInstruction = async (
  locale: Locale = DEFAULT_LOCALE
): Promise<string> => {
  const now = Date.now();
  const cached = promptCache.get(locale);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.prompt;
  }

  let basePrompt: string | null = null;

  try {
    basePrompt = await findStoredPrompt(locale);

    // Sem prompt dedicado: herdar o inglês em vez de ignorar a configuração do admin.
    if (!basePrompt && locale !== DEFAULT_LOCALE) {
      basePrompt = await findStoredPrompt(DEFAULT_LOCALE);
    }

    // Primeira execução: semear o padrão para o admin poder editar depois.
    if (!basePrompt) {
      try {
        await prisma.systemPrompt.create({
          data: {
            prompt: DEFAULT_SYSTEM_PROMPT,
            version: 1,
            locale: DEFAULT_LOCALE,
          },
        });
      } catch {
        // Corrida entre instâncias: o registro pode já existir.
      }
      basePrompt = await findStoredPrompt(DEFAULT_LOCALE);
    }
  } catch {
    // Banco indisponível: seguir com o padrão em memória.
    basePrompt = null;
  }

  const instruction = withLanguageDirective(
    ensureOrionGuardrails(basePrompt ?? DEFAULT_SYSTEM_PROMPT),
    locale
  );

  promptCache.set(locale, { prompt: instruction, timestamp: now });
  return instruction;
};

// Função para limpar cache (chamada quando o prompt é atualizado)
export const clearPromptCache = (): void => {
  promptCache.clear();
};

// Create providers based on available configuration
// APENAS OLLAMA3 - todos os outros provedores foram removidos
export function createProviders(): AIProvider[] {
  const providers: AIProvider[] = [];

  // Ollama3 (PRINCIPAL)
  const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  const ollamaModel = process.env.OLLAMA_MODEL || "llama3-8b-fast";
  const ollamaApiKey = process.env.OLLAMA_API_KEY;

  console.log(`[Fallback] Configurando Ollama3 - Modelo: ${ollamaModel}, URL: ${ollamaUrl}`);
  console.log(`[Fallback] OLLAMA_MODEL env: ${process.env.OLLAMA_MODEL || "não definido (usando padrão)"}`);

  try {
    providers.push(new Ollama3Provider(ollamaUrl, ollamaModel, ollamaApiKey));
    console.log(`[Fallback] Ollama3 provider adicionado com sucesso`);
  } catch (error) {
    console.error(`[Fallback] Erro ao criar Ollama3 provider:`, error);
    // Se falhar ao criar, não adicionar
  }

  // Groq (FALLBACK SECUNDÁRIO - se houver chave)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      providers.push(new GroqProvider(groqKey));
    } catch (error) {
      // Se não conseguir instanciar Groq, não adiciona
    }
  }

  if (providers.length === 0) {
    throw new Error(
      "Nenhum AI provider disponível. Configure OLLAMA_URL/modelo ou GROQ_API_KEY."
    );
  }

  return providers;
}

// Try providers in sequence until one succeeds
export async function tryProviders<T>(
  providers: AIProvider[],
  operation: (provider: AIProvider) => Promise<T>,
  operationName: string = "operation"
): Promise<{ result: T; provider: string }> {
  const errors: Array<{ provider: string; error: any }> = [];

  for (const provider of providers) {
    try {
      // Log removido por segurança
      const result = await operation(provider);

      // Log removido por segurança (não expor detalhes)

      // Validar que o resultado não está vazio
      if (result === undefined || result === null) {
        // Log removido por segurança
        throw createProviderError(
          provider.name,
          "Provider returned undefined result",
          undefined,
          true // Retryable
        );
      }

      return { result, provider: provider.name };
    } catch (error: any) {
      const providerError = error as AIProviderError;
      // Se o erro já tem a propriedade retryable definida, usar ela
      // Caso contrário, assumir que é retryable (para continuar o fallback)
      const isRetryable = providerError.retryable !== false;

      // Log removido por segurança

      errors.push({ provider: provider.name, error });

      // If error is not retryable (e.g., invalid API key), don't try other providers
      // Mas só parar se for claramente um erro de autenticação
      if (!isRetryable) {
        const errorMessage = (error?.message || "").toLowerCase();
        const isAuthError =
          errorMessage.includes("invalid api key") ||
          errorMessage.includes("unauthorized") ||
          errorMessage.includes("authentication failed") ||
          errorMessage.includes("invalid authentication");

        // Se não for erro de autenticação, continuar tentando outros providers
        if (!isAuthError) {
          // Log removido por segurança
          continue;
        }

        // Log removido por segurança
        throw error;
      }

      // Continue to next provider
      continue;
    }
  }

  // All providers failed
  const errorMessages = errors
    .map(
      (e) => `${e.provider}: ${e.error?.message || e.error || "Unknown error"}`
    )
    .join("; ");
  throw new Error(
    `All AI providers failed for ${operationName}. Errors: ${errorMessages}`
  );
}

// Send message with fallback
export async function sendMessageWithFallback(
  message: string,
  history: Array<{ role: string; parts: Array<{ text: string }> }>,
  locale: Locale = DEFAULT_LOCALE
): Promise<{ response: string; provider: string }> {
  const providers = createProviders();
  const systemInstruction = await getSystemInstruction(locale);

  const { result, provider } = await tryProviders(
    providers,
    async (provider) => {
      const response = await provider.sendMessage(
        message,
        history,
        systemInstruction
      );
      // Log removido por segurança
      return response;
    },
    "sendMessage"
  );

  // Garantir que result é uma string válida
  if (!result || (typeof result === "string" && result.trim() === "")) {
    // Log removido por segurança
    throw new Error(`Provider ${provider} returned an empty response`);
  }

  return {
    response: typeof result === "string" ? result : String(result),
    provider,
  };
}

// Send message with streaming fallback
export async function sendMessageStreamWithFallback(
  message: string,
  history: Array<{ role: string; parts: Array<{ text: string }> }>,
  onChunk: (chunk: string) => void,
  locale: Locale = DEFAULT_LOCALE
): Promise<{ response: string; provider: string }> {
  const providers = createProviders();
  const systemInstruction = await getSystemInstruction(locale);

  // Tentar Ollama3 primeiro (suporta streaming)
  const ollamaProvider = providers.find((p) => p.name === "Ollama3");

  if (ollamaProvider && "sendMessageStream" in ollamaProvider) {
    try {
      const fullResponse = await (ollamaProvider as any).sendMessageStream(
        message,
        history,
        systemInstruction,
        onChunk
      );

      if (!fullResponse || (typeof fullResponse === "string" && fullResponse.trim() === "")) {
        throw new Error("Ollama3 returned an empty response");
      }

      return {
        response: typeof fullResponse === "string" ? fullResponse : String(fullResponse),
        provider: "Ollama3",
      };
    } catch (error: any) {
      console.log(`[Fallback] Ollama3 streaming failed, trying fallback: ${error.message}`);
      // Se falhar, tentar método normal sem streaming
    }
  }

  // Fallback para método normal (sem streaming)
  return await sendMessageWithFallback(message, history, locale);
}

// Generate plan with fallback
export async function generatePlanWithFallback(
  contextHistory: string,
  locale: Locale = DEFAULT_LOCALE
): Promise<{ response: string; provider: string }> {
  const providers = createProviders();
  const systemInstruction = await getSystemInstruction(locale);

  const { result, provider } = await tryProviders(
    providers,
    async (provider) =>
      await provider.generatePlan(contextHistory, systemInstruction, locale),
    "generatePlan"
  );

  return {
    response: typeof result === "string" ? result : String(result),
    provider,
  };
}
