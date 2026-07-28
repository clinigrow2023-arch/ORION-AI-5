import { AIProvider, createProviderError, isRetryableError } from "./base.js";
import { CHAT_NUM_PREDICT } from "../../lib/chat-constants.js";
import {
  CHAT_TIMEOUT_MS,
  PLAN_NUM_PREDICT,
  PLAN_TIMEOUT_MS,
} from "../../lib/ollama-server-constants.js";
import { parsePlanJsonFromText } from "../../lib/plan-utils.js";
import {
  buildConversationPrompt,
  attachSystemIfPresent,
  buildPlanSystemPrompt,
  buildPlanUserPrompt,
  enhanceSystemInstruction,
  getOllamaAuthHeaders,
  truncatePlanContext,
} from "./ollama-helpers.js";
import { DEFAULT_LOCALE, type Locale } from "../../lib/locale.js";

const OLLAMA_DEBUG = process.env.OLLAMA_DEBUG === "1";
function ollamaLog(...args: unknown[]) {
  if (OLLAMA_DEBUG) console.log(...args);
}

// Ollama provider — VPS local inference only
export class Ollama3Provider implements AIProvider {
  name = "Ollama";
  private baseUrl: string;
  private model: string;
  private apiKey: string;

  constructor(
    baseUrl: string = process.env.OLLAMA_URL || "http://localhost:11434",
    model: string = process.env.OLLAMA_MODEL || "llama3-8b-fast",
    apiKey?: string
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
    // Usar token secreto para proteger a VPS
    this.apiKey = apiKey || process.env.OLLAMA_API_KEY || "";

    // Debug: mostrar qual modelo está sendo usado
    ollamaLog(`[Ollama] model=${this.model}`);
  }

  async sendMessage(
    message: string,
    history: Array<{ role: string; parts: Array<{ text: string }> }>,
    systemInstruction: string,
    locale: Locale = DEFAULT_LOCALE
  ): Promise<string> {
    try {
      // Log removido por segurança (não expor URL da VPS)

      const fullPrompt = buildConversationPrompt(message, history, locale);
      const headers = getOllamaAuthHeaders(this.apiKey);
      const systemForRequest = systemInstruction.trim()
        ? enhanceSystemInstruction(systemInstruction)
        : "";

      const requestBody: Record<string, unknown> = {
        model: this.model,
        prompt: fullPrompt,
        stream: false,
        num_ctx: 2048,
        options: {
          temperature: 0.65,
          num_predict: CHAT_NUM_PREDICT,
          top_p: 0.9,
          repeat_penalty: 1.15,
        },
      };
      attachSystemIfPresent(requestBody, systemForRequest);

      // Logs removidos por segurança (não expor modelo, URL, ou detalhes de requisição)

      // Timeout reduzido para respostas mais rápidas: 60 segundos
      const controller = new AbortController(); 
      const timeoutMs = CHAT_TIMEOUT_MS;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const startTime = Date.now();
      let response: Response;
      try {
        console.log(
          `[Ollama] chat model=${this.model} promptLen=${fullPrompt.length} systemLen=${systemForRequest.length}`
        );
        response = await fetch(`${this.baseUrl}/api/generate`, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[Ollama3] Response received after ${elapsedTime} seconds`);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === "AbortError") {
          throw createProviderError(
            this.name,
            `Request timeout after ${timeoutMs / 1000} seconds`,
            "TIMEOUT",
            true
          );
        }
        throw fetchError;
      }

      if (!response.ok) {
        let errorData: any = {};
        try {
          const errorText = await response.text();
          errorData = JSON.parse(errorText);
        } catch (e) {
          // Fallback
        }

        const isRetryable = isRetryableError({
          message: errorData.error || `HTTP ${response.status}`,
          status: response.status,
        });

        throw createProviderError(
          this.name,
          errorData.error || `HTTP error! status: ${response.status}`,
          response.status,
          isRetryable
        );
      }

      const data = await response.json();
      console.log(`[Ollama3] Response keys:`, Object.keys(data));

      // Ollama pode retornar response diretamente ou em diferentes formatos
      let content = "";
      if (data.response) {
        content = data.response;
      } else if (typeof data === "string") {
        content = data;
      } else if (data.text) {
        content = data.text;
      } else {
        console.error(
          `[Ollama3] Invalid response format. Keys:`,
          Object.keys(data)
        );
        throw createProviderError(
          this.name,
          `Invalid response format from Ollama API. Expected 'response' field, got: ${JSON.stringify(
            data
          ).substring(0, 100)}`,
          undefined,
          false
        );
      }

      // Validar se a resposta não está vazia
      if (!content || content.trim() === "") {
        console.error(`[Ollama3] Empty response received`);
        throw createProviderError(
          this.name,
          "Empty response from Ollama API",
          undefined,
          true // Retryable - pode ser um problema temporário
        );
      }

      console.log(`[Ollama3] Success! Response length: ${content.length}`);
      console.log(
        `[Ollama3] Response preview: ${content.substring(0, 200)}...`
      );
      if (data.total_duration) {
        console.log(`[Ollama3] Total duration: ${data.total_duration / 1e9}s`);
      }
      if (data.eval_duration) {
        console.log(`[Ollama3] Eval duration: ${data.eval_duration / 1e9}s`);
      }
      if (data.prompt_eval_duration) {
        console.log(
          `[Ollama3] Prompt eval duration: ${data.prompt_eval_duration / 1e9}s`
        );
      }
      return content;
    } catch (error: any) {
      if (error.provider) {
        // Log removido por segurança
        throw error; // Already a provider error
      }

      // Log removido por segurança (não expor stack trace ou detalhes de erro)

      const isRetryable = isRetryableError(error);
      throw createProviderError(
        this.name,
        error.message || "Unknown error from Ollama API",
        error.code || error.status,
        isRetryable
      );
    }
  }

  async generatePlan(
    contextHistory: string,
    options?: { regenerate?: boolean; locale?: Locale }
  ): Promise<string> {
    try {
      const truncatedHistory = truncatePlanContext(contextHistory);
      const planLocale = options?.locale ?? DEFAULT_LOCALE;
      const compact = /:1b|1b:|\.1b/i.test(this.model);
      const regenerating = !!options?.regenerate;
      const headers = getOllamaAuthHeaders(this.apiKey);

      let numPredict = PLAN_NUM_PREDICT;
      let lastError = "Invalid plan JSON from model";

      for (let attempt = 0; attempt < 2; attempt++) {
        const prompt = buildPlanUserPrompt(truncatedHistory, {
          regenerate: regenerating,
          compact,
          locale: planLocale,
        });

        const requestBody: Record<string, unknown> = {
          model: this.model,
          prompt,
          stream: false,
          format: "json",
          num_ctx: 2048,
          options: {
            temperature: regenerating ? 0.82 : 0.3,
            num_predict: numPredict,
            top_p: regenerating ? 0.92 : 0.85,
            repeat_penalty: regenerating ? 1.25 : 1.1,
            seed: regenerating
              ? Math.floor(Math.random() * 2_147_483_647)
              : 42,
          },
        };
        attachSystemIfPresent(requestBody, buildPlanSystemPrompt(planLocale));

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), PLAN_TIMEOUT_MS);

        const startTime = Date.now();
        let response: Response;
        try {
          console.log(
            `[Ollama] plan model=${this.model} ctxLen=${contextHistory.length} num_predict=${numPredict} attempt=${attempt + 1}`
          );
          response = await fetch(`${this.baseUrl}/api/generate`, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
          console.log(
            `[Ollama3] Plan generation response received after ${elapsedTime} seconds`
          );
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === "AbortError") {
            throw createProviderError(
              this.name,
              `Plan generation timeout after ${PLAN_TIMEOUT_MS / 1000} seconds`,
              "TIMEOUT",
              true
            );
          }
          throw fetchError;
        }

        if (!response.ok) {
          let errorData: any = {};
          try {
            const errorText = await response.text();
            errorData = JSON.parse(errorText);
          } catch {
            /* ignore */
          }

          const isRetryable = isRetryableError({
            message: errorData.error || `HTTP ${response.status}`,
            status: response.status,
          });

          throw createProviderError(
            this.name,
            errorData.error || `HTTP error! status: ${response.status}`,
            response.status,
            isRetryable
          );
        }

        const data = await response.json();
        console.log(
          `[Ollama3] Plan generation response status: ${response.status} ${response.statusText}`
        );

        let jsonText = "";
        if (data.response) {
          jsonText = data.response;
        } else if (typeof data === "string") {
          jsonText = data;
        } else if (data.text) {
          jsonText = data.text;
        } else {
          throw createProviderError(
            this.name,
            `Invalid response format from Ollama API`,
            undefined,
            false
          );
        }

        if (!jsonText.trim()) {
          throw createProviderError(
            this.name,
            "No data received from plan generation",
            undefined,
            false
          );
        }

        const parsed = parsePlanJsonFromText(jsonText);
        const hasContent =
          parsed &&
          typeof parsed === "object" &&
          Object.keys(parsed as object).length > 0;

        if (hasContent) {
          console.log(
            `[Ollama3] Plan JSON OK (len=${jsonText.length}, done=${data.done_reason ?? "?"})`
          );
          return JSON.stringify(parsed);
        }

        lastError =
          data.done_reason === "length"
            ? "Plan JSON was truncated (model token limit)"
            : "Plan response was not valid JSON";

        if (data.done_reason === "length" && attempt === 0) {
          numPredict = Math.min(numPredict * 2, 1400);
          console.warn(
            `[Ollama3] Plan truncated — retry with num_predict=${numPredict}`
          );
          continue;
        }

        console.error(`[Ollama3] Plan parse failed: ${lastError}`);
        break;
      }

      throw createProviderError(this.name, lastError, undefined, true);
    } catch (error: any) {
      if (error.provider) {
        // Log removido por segurança
        throw error; // Already a provider error
      }

      // Log removido por segurança (não expor stack trace ou detalhes de erro)

      const isRetryable = isRetryableError(error);
      throw createProviderError(
        this.name,
        error.message || "Unknown error from Ollama API",
        error.code || error.status,
        isRetryable
      );
    }
  }

  // Método de streaming para respostas mais rápidas
  async sendMessageStream(
    message: string,
    history: Array<{ role: string; parts: Array<{ text: string }> }>,
    systemInstruction: string,
    onChunk: (chunk: string) => void,
    locale: Locale = DEFAULT_LOCALE
  ): Promise<string> {
    try {
      const fullPrompt = buildConversationPrompt(message, history, locale);
      const headers = getOllamaAuthHeaders(this.apiKey);
      const systemForRequest = systemInstruction.trim()
        ? enhanceSystemInstruction(systemInstruction)
        : "";

      const requestBody: Record<string, unknown> = {
        model: this.model,
        prompt: fullPrompt,
        stream: true,
        num_ctx: 2048,
        options: {
          temperature: 0.65,
          num_predict: CHAT_NUM_PREDICT,
          top_p: 0.9,
          repeat_penalty: 1.15,
        },
      };
      attachSystemIfPresent(requestBody, systemForRequest);

      ollamaLog(`[Ollama] stream model=${this.model} systemLen=${systemForRequest.length}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/api/generate`, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === "AbortError") {
          throw createProviderError(
            this.name,
            `Chat stream timeout after ${CHAT_TIMEOUT_MS / 1000} seconds`,
            "TIMEOUT",
            true
          );
        }
        throw fetchError;
      }

      if (!response.ok) {
        let errorData: any = {};
        try {
          const errorText = await response.text();
          errorData = JSON.parse(errorText);
        } catch (e) {
          // Fallback
        }

        const isRetryable = isRetryableError({
          message: errorData.error || `HTTP ${response.status}`,
          status: response.status,
        });

        throw createProviderError(
          this.name,
          errorData.error || `HTTP error! status: ${response.status}`,
          response.status,
          isRetryable
        );
      }

      // Processar stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw createProviderError(
          this.name,
          "Response body is not readable",
          undefined,
          false
        );
      }

      const decoder = new TextDecoder();
      let fullResponse = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decodificar chunk
        buffer += decoder.decode(value, { stream: true });

        // Processar linhas completas
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Manter última linha incompleta no buffer

        for (const line of lines) {
          if (line.trim() === "") continue;

          try {
            const json = JSON.parse(line);

            // Ollama retorna chunks no campo 'response'
            if (json.response) {
              const chunk = json.response;
              fullResponse += chunk;
              onChunk(chunk); // Enviar chunk para callback
            }

            // Se done for true, finalizou
            if (json.done) {
              break;
            }
          } catch (parseError) {
            // Ignorar linhas que não são JSON válido
            continue;
          }
        }
      }

      // Processar último buffer se houver
      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer);
          if (json.response) {
            const chunk = json.response;
            fullResponse += chunk;
            onChunk(chunk);
          }
        } catch (e) {
          // Ignorar
        }
      }

      console.log(
        `[Ollama3] Streaming completed. Total length: ${fullResponse.length}`
      );

      // Validar resposta
      if (!fullResponse || fullResponse.trim() === "") {
        throw createProviderError(
          this.name,
          "Empty response from Ollama API",
          undefined,
          true
        );
      }

      return fullResponse;
    } catch (error: any) {
      if (error.provider) {
        throw error;
      }

      const isRetryable = isRetryableError(error);
      throw createProviderError(
        this.name,
        error.message || "Unknown error from Ollama API",
        error.code || error.status,
        isRetryable
      );
    }
  }
}
