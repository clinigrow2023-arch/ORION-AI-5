import { GoogleGenAI } from "@google/genai";
import { AIProvider, createProviderError, isRetryableError } from "./base.js";

// Gemini Provider Implementation
export class GeminiProvider implements AIProvider {
  name = "Gemini";
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Gemini API key is required");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async sendMessage(
    message: string,
    history: Array<{ role: string; parts: Array<{ text: string }> }>,
    systemInstruction: string
  ): Promise<string> {
    try {
      const chat = this.ai.chats.create({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction,
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
        history: history,
      });

      const result = await chat.sendMessageStream({
        message,
        // Aplicar safety settings também na mensagem
        config: {
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

      let fullText = "";
      for await (const chunk of result) {
        const text = chunk.text;
        if (text) {
          fullText += text;
        }
      }

      // Validar se a resposta não está vazia
      if (!fullText || fullText.trim() === "") {
        throw createProviderError(
          this.name,
          "Empty response from Gemini API",
          undefined,
          true // Retryable - pode ser um problema temporário
        );
      }

      return fullText;
    } catch (error: any) {
      const isRetryable = isRetryableError(error);
      throw createProviderError(
        this.name,
        error.message || "Unknown error from Gemini API",
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
      const planSchema = {
        type: "object",
        properties: {
          diagnosis: {
            type: "string",
            description:
              "A clear, analytical diagnosis of what caused the distance or breakup in simple human terms.",
          },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                stepNumber: { type: "integer" },
                title: { type: "string" },
                description: {
                  type: "string",
                  description:
                    "Clear instructions with psychological justification.",
                },
                duration: {
                  type: "string",
                  description: "Specific timing (e.g., '3 days', '5-7 days')",
                },
              },
              required: ["stepNumber", "title", "description", "duration"],
            },
          },
          messageTemplates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                situation: {
                  type: "string",
                  description: "When to use this message",
                },
                text: {
                  type: "string",
                  description:
                    "The exact text content, personalized to the user.",
                },
                timing: { type: "string", description: "When to send it" },
              },
              required: ["situation", "text", "timing"],
            },
          },
          dos: {
            type: "array",
            items: { type: "string" },
            description:
              "List of things the user MUST do to build value and emotional safety.",
          },
          donts: {
            type: "array",
            items: { type: "string" },
            description:
              "List of behaviors to avoid (pressure, lowering value).",
          },
          distancingStrategy: {
            type: "string",
            description:
              "Explanation of the specific timing and strategy (e.g., 12-word phrase, The One Text Message) to use.",
          },
          neurologicalTriggers: {
            type: "string",
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

Output strictly valid JSON.`;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: planSchema,
          systemInstruction,
        },
      });

      const jsonText = response.text;
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
        error.message || "Unknown error from Gemini API",
        error.code || error.status,
        isRetryable
      );
    }
  }
}
