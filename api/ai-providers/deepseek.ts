import { AIProvider, createProviderError, isRetryableError } from "./base.js";

// Deep Seek Provider Implementation (OpenAI-compatible API)
export class DeepSeekProvider implements AIProvider {
  name = "Deep Seek";
  private apiKey: string;
  private baseUrl = "https://api.deepseek.com/v1";

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Deep Seek API key is required");
    }
    this.apiKey = apiKey;
  }

  async sendMessage(
    message: string,
    history: Array<{ role: string; parts: Array<{ text: string }> }>,
    systemInstruction: string
  ): Promise<string> {
    try {
      // Convert history format to Deep Seek format (OpenAI-compatible)
      const messages = this.convertHistoryToDeepSeekFormat(
        history,
        systemInstruction
      );

      // Add current user message
      messages.push({
        role: "user",
        content: message,
      });

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat", // Deep Seek's main model
          messages: messages,
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error?.message || `HTTP ${response.status}`;
        const isRetryable = isRetryableError({
          status: response.status,
          message: errorMessage,
        });

        throw createProviderError(
          this.name,
          `Deep Seek API error: ${errorMessage}`,
          response.status,
          isRetryable
        );
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw createProviderError(
          this.name,
          "Invalid response format from Deep Seek API",
          undefined,
          false
        );
      }

      const content = data.choices[0].message.content || "";
      
      // Validar se a resposta não está vazia
      if (!content || content.trim() === "") {
        throw createProviderError(
          this.name,
          "Empty response from Deep Seek API",
          undefined,
          true // Retryable - pode ser um problema temporário
        );
      }

      return content;
    } catch (error: any) {
      if (error.provider) {
        throw error; // Already a provider error
      }

      // Convert to provider error
      const isRetryable = isRetryableError(error);
      throw createProviderError(
        this.name,
        error.message || "Unknown error from Deep Seek API",
        error.code || error.status,
        isRetryable
      );
    }
  }

  async generatePlan(
    contextHistory: string,
    systemInstruction: string
  ): Promise<string> {
    try {
      const prompt = `Based on the conversation history below, generate a comprehensive Reconciliation Action Plan in JSON format.

HISTORY:
${contextHistory}

STRICT REQUIREMENTS:
1. LANGUAGE: Output MUST be strictly in English.
2. DIAGNOSIS: Synthesize the diagnosis based on the user's answers in the chat.
3. STEPS: Exactly 3 distinct, sequential steps with specific timing.
4. MESSAGES: Exactly 3 personalized message templates for specific scenarios.
5. DISTANCING: Explain "Strategic Distancing" (duration + logic).
6. TRIGGERS: Explain how to use specific Secret Signals (The Awakening Phrase, The Fascination Signal, etc.).

Output strictly valid JSON with the following structure:
{
  "diagnosis": "string",
  "steps": [{"stepNumber": 1, "title": "string", "description": "string", "duration": "string"}],
  "messageTemplates": [{"situation": "string", "text": "string", "timing": "string"}],
  "dos": ["string"],
  "donts": ["string"],
  "distancingStrategy": "string",
  "neurologicalTriggers": "string"
}`;

      const messages = [
        {
          role: "system",
          content: systemInstruction,
        },
        {
          role: "user",
          content: prompt,
        },
      ];

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: messages,
          temperature: 0.7,
          max_tokens: 4096,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error?.message || `HTTP ${response.status}`;
        const isRetryable = isRetryableError({
          status: response.status,
          message: errorMessage,
        });

        throw createProviderError(
          this.name,
          `Deep Seek API error: ${errorMessage}`,
          response.status,
          isRetryable
        );
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw createProviderError(
          this.name,
          "Invalid response format from Deep Seek API",
          undefined,
          false
        );
      }

      const content = data.choices[0].message.content || "";
      
      // Validar se a resposta não está vazia
      if (!content || content.trim() === "") {
        throw createProviderError(
          this.name,
          "Empty response from Deep Seek API",
          undefined,
          true // Retryable - pode ser um problema temporário
        );
      }

      return content;
    } catch (error: any) {
      if (error.provider) {
        throw error; // Already a provider error
      }

      const isRetryable = isRetryableError(error);
      throw createProviderError(
        this.name,
        error.message || "Unknown error from Deep Seek API",
        error.code || error.status,
        isRetryable
      );
    }
  }

  private convertHistoryToDeepSeekFormat(
    history: Array<{ role: string; parts: Array<{ text: string }> }>,
    systemInstruction: string
  ): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    // Add system instruction first
    if (systemInstruction) {
      messages.push({
        role: "system",
        content: systemInstruction,
      });
    }

    // Convert history
    for (const item of history) {
      const role = item.role === "model" ? "assistant" : item.role;
      const content = item.parts.map((p) => p.text).join("\n");

      if (content) {
        messages.push({ role, content });
      }
    }

    return messages;
  }
}
