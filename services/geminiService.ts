import { GoogleGenAI, Schema, Type } from "@google/genai";
import { ActionPlan } from "../types";
import { LOCALE_HEADER } from "../lib/locale";
import { getActiveLocale } from "../lib/i18n";
import {
  DEFAULT_SYSTEM_PROMPT,
  buildPlanPrompt,
  withLanguageDirective,
} from "../lib/prompt-defaults";

// Usar endpoint local para desenvolvimento, com fallback para provedores locais
const API_ENDPOINT = "/api/gemini";

/** Códigos estáveis de erro para a UI traduzir sem depender do texto. */
export type AiErrorCode =
  | "api_key_leaked"
  | "api_key_missing"
  | "access_denied"
  | "unauthorized"
  | "empty_response"
  | "provider_failed"
  | "unknown";

/** Erro do serviço de IA com código estável (independente do idioma). */
export class AiServiceError extends Error {
  readonly code: AiErrorCode;

  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.name = "AiServiceError";
    this.code = code;
  }
}

/**
 * Erro a partir de uma resposta HTTP do nosso backend.
 *
 * O código vem do status, nunca do texto: as mensagens da API já são
 * traduzidas e por isso não servem para detecção.
 */
async function errorFromResponse(response: Response): Promise<AiServiceError> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  const message = body.error ?? `HTTP ${response.status}`;

  switch (response.status) {
    case 401:
      return new AiServiceError("unauthorized", message);
    case 403:
      return new AiServiceError("access_denied", message);
    default:
      return new AiServiceError("provider_failed", message);
  }
}

/**
 * Traduz falhas do SDK do Gemini (usado apenas no fallback de desenvolvimento)
 * em um código estável. Aqui a inspeção de texto é aceitável porque as
 * mensagens vêm do Google, sempre em inglês.
 */
function toAiServiceError(error: unknown): AiServiceError {
  if (error instanceof AiServiceError) {
    return error;
  }

  const raw = error as { message?: string; status?: unknown } | null;
  const message = raw?.message ?? "Unknown AI error";
  const lower = message.toLowerCase();

  if (lower.includes("leaked") || lower.includes("permission_denied")) {
    return new AiServiceError("api_key_leaked", message);
  }

  if (lower.includes("api key") || lower.includes("api_key")) {
    return new AiServiceError("api_key_missing", message);
  }

  return new AiServiceError("unknown", message);
}

// Check if we're in development
const isDevelopment =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

// Get API key for development fallback (only used if API endpoint fails)
const getDevApiKey = (): string => {
  if (typeof import.meta !== "undefined" && (import.meta as any).env) {
    // Try to get from Vite env (only in dev, not bundled)
    return (import.meta as any).env.VITE_GEMINI_API_KEY || "";
  }
  return "";
};

// Schema for the JSON response (used in generateFormalPlan)
const planSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    diagnosis: {
      type: Type.STRING,
      description:
        "A clear, analytical diagnosis of what caused the distance or breakup in simple human terms, and the man's current emotional level.",
    },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          stepNumber: { type: Type.INTEGER },
          title: { type: Type.STRING },
          description: {
            type: Type.STRING,
            description: "Clear instructions with psychological justification.",
          },
          duration: {
            type: Type.STRING,
            description: "Specific timing (e.g., '3 days', '5-7 days')",
          },
        },
        required: ["stepNumber", "title", "description", "duration"],
      },
    },
    messageTemplates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          situation: {
            type: Type.STRING,
            description: "When to use this message",
          },
          text: {
            type: Type.STRING,
            description: "The exact text content, personalized to the user.",
          },
          timing: { type: Type.STRING, description: "When to send it" },
        },
        required: ["situation", "text", "timing"],
      },
    },
    dos: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "List of things the user MUST do to build value and emotional safety.",
    },
    donts: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of behaviors to avoid (pressure, lowering value).",
    },
    distancingStrategy: {
      type: Type.STRING,
      description:
        "Explanation of the specific timing and strategy (e.g., 12-word phrase, The One Text Message) to use.",
    },
    neurologicalTriggers: {
      type: Type.STRING,
      description:
        "How to use specific Secret Signals (e.g., The Awakening Phrase, The Fascination Signal, The Silent Signals, The 'I Owe You' Signal, The Princess in Distress Signal, The Private Island Signal, The X-Ray Question, The Get Your Ex Back Signal, The Secret Signal to Prevent Distance, The Love-Lasting Signal).",
    },
  },
  required: [
    "diagnosis",
    "steps",
    "messageTemplates",
    "dos",
    "donts",
    "distancingStrategy",
    "neurologicalTriggers",
  ],
};

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private modelName = "gemini-2.5-flash";
  // History for the continuous chat
  private chatHistory: { role: "user" | "model"; parts: { text: string }[] }[] =
    [];

  /**
   * System instruction do fallback direto de desenvolvimento (quando
   * `/api/gemini` não está disponível). Reaproveita o prompt padrão do servidor
   * e anexa a diretiva de idioma por último, para que a resposta saia no idioma
   * ativo mesmo neste caminho alternativo.
   */
  private getSystemInstruction(): string {
    return withLanguageDirective(DEFAULT_SYSTEM_PROMPT, getActiveLocale());
  }

  private async initializeAI(): Promise<void> {
    if (!this.ai) {
      const apiKey = getDevApiKey();
      if (!apiKey) {
        throw new AiServiceError(
          "api_key_missing",
          "VITE_GEMINI_API_KEY is not set for the local development fallback"
        );
      }
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  async sendMessageStream(
    message: string,
    onChunk: (text: string) => void
  ): Promise<string> {
    try {
      // Get auth token for authorization header
      const token =
        typeof window !== "undefined" && localStorage.getItem("auth_token");

      // Try API endpoint first
      let response: Response | null = null;
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          // Idioma ativo: o backend usa como fallback quando o usuário ainda
          // não tem preferência salva.
          [LOCALE_HEADER]: getActiveLocale(),
        };

        // Adicionar token de autenticação se disponível
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        // Adicionar header para ativar streaming
        headers["X-Stream"] = "true";

        response = await fetch(`${API_ENDPOINT}?stream=true`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message,
            history: this.chatHistory,
          }),
        });

        if (response.ok) {
          // Verificar se é streaming (SSE)
          const contentType = response.headers.get("content-type");
          
          if (contentType?.includes("text/event-stream")) {
            // Processar SSE streaming
            const reader = response.body?.getReader();
            if (!reader) {
              throw new Error("Response body is not readable");
            }

            const decoder = new TextDecoder();
            let buffer = "";
            let fullResponse = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (line.trim() === "") continue;
                if (!line.startsWith("data: ")) continue;

                // Só o parse entra no try: um erro enviado pelo servidor precisa
                // interromper o stream, não ser confundido com linha inválida.
                let data: {
                  error?: string;
                  chunk?: string;
                  done?: boolean;
                  response?: string;
                };
                try {
                  data = JSON.parse(line.substring(6));
                } catch {
                  continue;
                }

                if (data.error) {
                  throw new AiServiceError("provider_failed", data.error);
                }

                if (data.chunk) {
                  fullResponse += data.chunk;
                  onChunk(data.chunk);
                }

                if (data.done && data.response) {
                  // Atualizar histórico
                  this.chatHistory.push({ role: "user", parts: [{ text: message }] });
                  this.chatHistory.push({
                    role: "model",
                    parts: [{ text: data.response }],
                  });
                  return data.response;
                }
              }
            }

            // Se chegou aqui sem done, usar o que foi acumulado
            if (fullResponse) {
              this.chatHistory.push({ role: "user", parts: [{ text: message }] });
              this.chatHistory.push({
                role: "model",
                parts: [{ text: fullResponse }],
              });
              return fullResponse;
            }

            throw new AiServiceError(
              "empty_response",
              "Streaming ended without a complete response"
            );
          } else {
            // Fallback para modo não-streaming (compatibilidade)
            const data = await response.json();

            console.log("API Response Data:", {
              hasResponse: !!data.response,
              responseType: typeof data.response,
              responseLength: data.response?.length || 0,
              responsePreview: data.response?.substring(0, 200) || "empty",
              fullData: data,
            });

            const fullText = data.response || "";

            // Validar se a resposta não está vazia
            if (
              !fullText ||
              (typeof fullText === "string" && fullText.trim() === "")
            ) {
              console.error("❌ Empty response from API:", {
                data,
                response: data.response,
                responseType: typeof data.response,
              });
              throw new AiServiceError(
                "empty_response",
                "AI returned an empty response"
              );
            }

            // Simulate streaming para compatibilidade
            if (fullText && onChunk) {
              const words = fullText.split(" ");
              for (let i = 0; i < words.length; i++) {
                const chunk = (i === 0 ? "" : " ") + words[i];
                onChunk(chunk);
                await new Promise((resolve) => setTimeout(resolve, 10));
              }
            }

            // Update history
            if (data.history) {
              this.chatHistory = data.history;
            } else {
              this.chatHistory.push({ role: "user", parts: [{ text: message }] });
              this.chatHistory.push({
                role: "model",
                parts: [{ text: fullText }],
              });
            }

            return fullText;
          }
        }

        // 404 em desenvolvimento significa que o dev-server não está no ar:
        // o fallback direto (no catch) assume. Qualquer outro status é erro real.
        if (!response.ok && !(response.status === 404 && isDevelopment)) {
          throw await errorFromResponse(response);
        }
      } catch (apiError: any) {
        // Fallback direto para a API do Gemini apenas em desenvolvimento, quando
        // a rota `/api/gemini` não respondeu (rede caiu ou 404).
        const canUseDevFallback =
          isDevelopment && (response === null || response.status === 404);

        if (!canUseDevFallback) {
          throw apiError;
        }

        try {
          await this.initializeAI();
          if (!this.ai) {
            throw new AiServiceError(
              "api_key_missing",
              "Failed to initialize the AI client"
            );
          }

          const systemInstruction = this.getSystemInstruction();
          const chat = this.ai.chats.create({
            model: this.modelName,
            config: {
              systemInstruction: systemInstruction,
              // Configurações de segurança mais permissivas para permitir conteúdo de relacionamento
              safetySettings: [
                {
                  category: "HARM_CATEGORY_HARASSMENT" as any,
                  threshold: "BLOCK_NONE" as any,
                },
                {
                  category: "HARM_CATEGORY_HATE_SPEECH" as any,
                  threshold: "BLOCK_NONE" as any,
                },
                {
                  category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" as any,
                  threshold: "BLOCK_MEDIUM_AND_ABOVE" as any,
                },
                {
                  category: "HARM_CATEGORY_DANGEROUS_CONTENT" as any,
                  threshold: "BLOCK_MEDIUM_AND_ABOVE" as any,
                },
              ],
            },
            history: this.chatHistory,
          });

          const result = await chat.sendMessageStream({ message });

          let fullText = "";
          for await (const chunk of result) {
            const text = chunk.text;
            if (text) {
              fullText += text;
              onChunk(text);
            }
          }

          // Update local history
          this.chatHistory.push({ role: "user", parts: [{ text: message }] });
          this.chatHistory.push({
            role: "model",
            parts: [{ text: fullText }],
          });

          return fullText;
        } catch (fallbackError: any) {
          console.error("❌ Direct API fallback failed:", fallbackError);
          throw toAiServiceError(fallbackError);
        }
      }

      // Defensivo: todos os caminhos acima retornam ou lançam.
      throw new AiServiceError(
        "empty_response",
        "AI request finished without a usable response"
      );
    } catch (error: any) {
      console.error("Gemini Chat Error:", error);
      throw toAiServiceError(error);
    }
  }

  /** Prompt do plano: as chaves do JSON ficam em inglês, os valores no idioma ativo. */
  private buildPlanPrompt(contextHistory: string): string {
    return buildPlanPrompt(contextHistory, getActiveLocale());
  }

  async generateFormalPlan(contextHistory: string): Promise<ActionPlan> {
    try {
      // Get auth token for authorization header
      const token =
        typeof window !== "undefined" && localStorage.getItem("auth_token");

      // Try API endpoint first
      let response: Response | null = null;
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          [LOCALE_HEADER]: getActiveLocale(),
        };

        // Adicionar token de autenticação se disponível
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        response = await fetch(API_ENDPOINT, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: this.buildPlanPrompt(contextHistory),
            history: [],
          }),
        });

        if (response.ok) {
          const data = await response.json();

          // A API agora retorna JSON estruturado diretamente em data.response
          let parsedPlan: ActionPlan;

          if (typeof data.response === "string") {
            // Se response é string, tentar parsear como JSON
            try {
              parsedPlan = JSON.parse(data.response) as ActionPlan;
            } catch {
              // Se falhar, tentar extrair JSON com regex (fallback)
              const jsonMatch = data.response.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                parsedPlan = JSON.parse(jsonMatch[0]) as ActionPlan;
              } else {
                throw new AiServiceError(
                  "empty_response",
                  "No valid JSON found in the plan response"
                );
              }
            }
          } else if (typeof data.response === "object") {
            // Se response já é um objeto, usar diretamente
            parsedPlan = data.response as ActionPlan;
          } else {
            throw new AiServiceError(
              "empty_response",
              "Unexpected plan response format"
            );
          }

          // Validar que o plano tem todas as propriedades necessárias
          if (this.validatePlan(parsedPlan)) {
            return parsedPlan;
          }

          throw new AiServiceError(
            "empty_response",
            "Generated plan is missing required properties"
          );
        }

        // Mesmo critério do chat: só 404 em desenvolvimento leva ao fallback.
        if (!(response.status === 404 && isDevelopment)) {
          throw await errorFromResponse(response);
        }
      } catch (apiError) {
        const canUseDevFallback =
          isDevelopment && (response === null || response.status === 404);

        if (!canUseDevFallback) {
          throw apiError;
        }

        await this.initializeAI();
        if (!this.ai) {
          throw new AiServiceError(
            "api_key_missing",
            "Failed to initialize the AI client"
          );
        }

        const prompt = this.buildPlanPrompt(contextHistory);
        const systemInstruction = this.getSystemInstruction();

        const fallbackResponse = await this.ai.models.generateContent({
          model: this.modelName,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: planSchema,
            systemInstruction: systemInstruction,
            // Configurações de segurança mais permissivas para permitir conteúdo de relacionamento
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT" as any,
                threshold: "BLOCK_NONE" as any,
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH" as any,
                threshold: "BLOCK_NONE" as any,
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" as any,
                threshold: "BLOCK_MEDIUM_AND_ABOVE" as any,
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT" as any,
                threshold: "BLOCK_MEDIUM_AND_ABOVE" as any,
              },
            ],
          },
        });

        const jsonText = fallbackResponse.text;
        if (!jsonText) {
          throw new AiServiceError(
            "empty_response",
            "No data received from plan generation"
          );
        }

        const parsedPlan = JSON.parse(jsonText) as ActionPlan;
        // Validar que o plano tem todas as propriedades necessárias
        if (this.validatePlan(parsedPlan)) {
          return parsedPlan;
        }

        throw new AiServiceError(
          "empty_response",
          "Generated plan is missing required properties"
        );
      }

      // Defensivo: todos os caminhos acima retornam ou lançam.
      throw new AiServiceError(
        "empty_response",
        "Plan generation finished without a usable response"
      );
    } catch (error: any) {
      console.error("Gemini Plan Generation Error:", error);
      throw toAiServiceError(error);
    }
  }

  private validatePlan(plan: any): plan is ActionPlan {
    return (
      plan &&
      typeof plan.diagnosis === "string" &&
      Array.isArray(plan.steps) &&
      plan.steps.length > 0 &&
      Array.isArray(plan.messageTemplates) &&
      plan.messageTemplates.length > 0 &&
      Array.isArray(plan.dos) &&
      plan.dos.length > 0 &&
      Array.isArray(plan.donts) &&
      plan.donts.length > 0 &&
      typeof plan.distancingStrategy === "string" &&
      typeof plan.neurologicalTriggers === "string"
    );
  }

  getHistoryAsString(): string {
    return this.chatHistory
      .map((h) => `${h.role}: ${h.parts[0].text}`)
      .join("\n");
  }

  clearHistory(): void {
    this.chatHistory = [];
  }

  // Método para adicionar mensagens ao histórico (usado ao carregar conversas)
  addToHistory(role: "user" | "model", text: string): void {
    this.chatHistory.push({ role, parts: [{ text }] });
  }

  // Método para obter o histórico atual
  getChatHistory(): { role: "user" | "model"; parts: { text: string }[] }[] {
    return [...this.chatHistory];
  }

  // Método para definir o histórico
  setChatHistory(history: { role: "user" | "model"; parts: { text: string }[] }[]): void {
    this.chatHistory = [...history];
  }
}

export const geminiService = new GeminiService();