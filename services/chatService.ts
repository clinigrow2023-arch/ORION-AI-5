import { ActionPlan } from "../types";
import { MAX_HISTORY_MESSAGES } from "../lib/chat-constants";
import { apiFetch } from "../lib/api-endpoints";
import { translateActive } from "../lib/i18n";

export type ChatHistoryItem = {
  role: "user" | "model";
  parts: { text: string }[];
};

/**
 * Stable failure codes.
 *
 * The UI maps codes to localized notices instead of matching the message text,
 * which is already localized by the API and would break such checks.
 */
export type ChatErrorCode =
  | "busy"
  | "access_denied"
  | "empty_response"
  | "provider_failed";

export class ChatServiceError extends Error {
  constructor(
    readonly code: ChatErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ChatServiceError";
  }
}

function errorFromResponse(status: number, serverMessage?: string): ChatServiceError {
  const message = serverMessage?.trim() || translateActive("chat.notices.genericError");
  if (status === 503) return new ChatServiceError("busy", message);
  if (status === 401 || status === 403) {
    return new ChatServiceError("access_denied", message);
  }
  return new ChatServiceError("provider_failed", message);
}

export class ChatService {
  private chatHistory: ChatHistoryItem[] = [];

  private getHistoryForApi(): ChatHistoryItem[] {
    return this.chatHistory.slice(-MAX_HISTORY_MESSAGES);
  }

  async sendMessageStream(
    message: string,
    onChunk: (text: string) => void
  ): Promise<string> {
    const response = await apiFetch("chat?stream=true", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Stream": "true",
      },
      body: JSON.stringify({
        message,
        history: this.getHistoryForApi(),
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw errorFromResponse(response.status, errorData.error);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("text/event-stream")) {
      const data = await response.json();
      const fullText = data.response || "";
      if (!fullText.trim()) {
        throw new ChatServiceError(
          "empty_response",
          translateActive("chat.notices.emptyResponse")
        );
      }
      onChunk(fullText);
      this.pushTurn(message, fullText);
      return fullText;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new ChatServiceError(
        "provider_failed",
        translateActive("chat.notices.genericError")
      );
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
        if (!line.startsWith("data: ")) continue;

        // O parse fica isolado: um `throw` dentro deste try seria engolido pelo
        // catch que existe para ignorar linhas SSE incompletas.
        let data: {
          error?: string;
          code?: string;
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
          throw new ChatServiceError(
            data.code === "BUSY" ? "busy" : "provider_failed",
            data.error
          );
        }
        if (data.chunk) {
          fullResponse += data.chunk;
          onChunk(data.chunk);
        }
        if (data.done && data.response) {
          fullResponse = data.response;
          this.pushTurn(message, fullResponse);
          return fullResponse;
        }
      }
    }

    if (fullResponse.trim()) {
      this.pushTurn(message, fullResponse);
      return fullResponse;
    }

    throw new ChatServiceError(
      "empty_response",
      translateActive("chat.notices.emptyResponse")
    );
  }

  async generateFormalPlan(options: {
    contextHistory?: string;
    conversationId?: string | null;
  }): Promise<ActionPlan> {
    const response = await apiFetch("plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contextHistory: options.contextHistory || "",
        conversationId: options.conversationId || undefined,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw errorFromResponse(response.status, errorData.error);
    }

    const data = await response.json();
    const parsedPlan = (data.plan || data.response) as ActionPlan;

    if (!parsedPlan || !this.validatePlan(parsedPlan)) {
      throw new ChatServiceError(
        "provider_failed",
        translateActive("plan.errors.incomplete")
      );
    }

    return parsedPlan;
  }

  private pushTurn(userMessage: string, modelResponse: string): void {
    this.chatHistory.push({ role: "user", parts: [{ text: userMessage }] });
    this.chatHistory.push({ role: "model", parts: [{ text: modelResponse }] });
  }

  private validatePlan(plan: unknown): plan is ActionPlan {
    if (!plan || typeof plan !== "object") return false;
    const p = plan as ActionPlan;
    return (
      typeof p.diagnosis === "string" &&
      p.diagnosis.length > 0 &&
      Array.isArray(p.steps) &&
      p.steps.length >= 3 &&
      Array.isArray(p.messageTemplates) &&
      p.messageTemplates.length >= 3 &&
      typeof p.distancingStrategy === "string" &&
      typeof p.neurologicalTriggers === "string"
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

  addToHistory(role: "user" | "model", text: string): void {
    this.chatHistory.push({ role, parts: [{ text }] });
  }

  getChatHistory(): ChatHistoryItem[] {
    return [...this.chatHistory];
  }

  setChatHistory(history: ChatHistoryItem[]): void {
    this.chatHistory = [...history];
  }
}

export const chatService = new ChatService();
