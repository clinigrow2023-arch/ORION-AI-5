import { AIProvider, createProviderError, isRetryableError } from "./base.js";

// Ollama3 Provider Implementation
export class Ollama3Provider implements AIProvider {
  name = "Ollama3";
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = "http://31.97.93.86:11434", model: string = "llama3") {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async sendMessage(
    message: string,
    history: Array<{ role: string; parts: Array<{ text: string }> }>,
    systemInstruction: string
  ): Promise<string> {
    try {
      // Converter histórico para formato Ollama
      const messages = [];
      
      // Adicionar system instruction como primeira mensagem
      if (systemInstruction) {
        messages.push({
          role: "system",
          content: systemInstruction,
        });
      }

      // Converter histórico
      for (const h of history) {
        const role = h.role === "user" ? "user" : "assistant";
        const content = h.parts.map((p) => p.text).join(" ");
        if (content.trim()) {
          messages.push({ role, content });
        }
      }

      // Adicionar mensagem atual
      messages.push({
        role: "user",
        content: message,
      });

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          stream: false,
          options: {
            temperature: 0.7,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const isRetryable = isRetryableError({ 
          message: errorData.error || `HTTP ${response.status}`,
          status: response.status 
        });
        throw createProviderError(
          this.name,
          errorData.error || `HTTP error! status: ${response.status}`,
          response.status,
          isRetryable
        );
      }

      const data = await response.json();

      if (!data.message || !data.message.content) {
        throw createProviderError(
          this.name,
          "Invalid response format from Ollama API",
          undefined,
          false
        );
      }

      const content = data.message.content || "";

      // Validar se a resposta não está vazia
      if (!content || content.trim() === "") {
        throw createProviderError(
          this.name,
          "Empty response from Ollama API",
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
        error.message || "Unknown error from Ollama API",
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

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          stream: false,
          format: "json",
          options: {
            temperature: 0.7,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const isRetryable = isRetryableError({ 
          message: errorData.error || `HTTP ${response.status}`,
          status: response.status 
        });
        throw createProviderError(
          this.name,
          errorData.error || `HTTP error! status: ${response.status}`,
          response.status,
          isRetryable
        );
      }

      const data = await response.json();

      if (!data.message || !data.message.content) {
        throw createProviderError(
          this.name,
          "Invalid response format from Ollama API",
          undefined,
          false
        );
      }

      const jsonText = data.message.content || "";

      if (!jsonText) {
        throw createProviderError(
          this.name,
          "No data received from plan generation",
          undefined,
          false
        );
      }

      return jsonText;
    } catch (error: any) {
      if (error.provider) {
        throw error; // Already a provider error
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

