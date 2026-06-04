import { ActionPlan } from "../types";
import { MAX_HISTORY_MESSAGES } from "../lib/chat-constants";

const API_ENDPOINT = "/api/chat";
const PLAN_ENDPOINT = "/api/plan";

export type ChatHistoryItem = {
  role: "user" | "model";
  parts: { text: string }[];
};

export class ChatService {
  private chatHistory: ChatHistoryItem[] = [];

  private getHistoryForApi(): ChatHistoryItem[] {
    return this.chatHistory.slice(-MAX_HISTORY_MESSAGES);
  }

  async sendMessageStream(
    message: string,
    onChunk: (text: string) => void
  ): Promise<string> {
    const token =
      typeof window !== "undefined" && localStorage.getItem("auth_token");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Stream": "true",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_ENDPOINT}?stream=true`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message,
        history: this.getHistoryForApi(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        (errorData as { error?: string }).error ||
          `HTTP error! status: ${response.status}`
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("text/event-stream")) {
      const data = await response.json();
      const fullText = data.response || "";
      if (!fullText.trim()) {
        throw new Error("AI returned an empty response. Please try again.");
      }
      onChunk(fullText);
      this.pushTurn(message, fullText);
      return fullText;
    }

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
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.substring(6));
          if (data.error) {
            const err = new Error(data.error) as Error & { code?: string };
            if (data.code) err.code = data.code;
            throw err;
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
        } catch {
          // ignore malformed SSE lines
        }
      }
    }

    if (fullResponse.trim()) {
      this.pushTurn(message, fullResponse);
      return fullResponse;
    }

    throw new Error("Streaming ended without a complete response");
  }

  async generateFormalPlan(options: {
    contextHistory?: string;
    conversationId?: string | null;
  }): Promise<ActionPlan> {
    const token =
      typeof window !== "undefined" && localStorage.getItem("auth_token");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(PLAN_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        contextHistory: options.contextHistory || "",
        conversationId: options.conversationId || undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        (errorData as { error?: string }).error ||
          `HTTP error! status: ${response.status}`
      );
    }

    const data = await response.json();
    const parsedPlan = (data.plan || data.response) as ActionPlan;

    if (!parsedPlan || !this.validatePlan(parsedPlan)) {
      throw new Error("Generated plan is missing required properties");
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
