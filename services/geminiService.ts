import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ActionPlan } from "../types";

// API endpoint (compatível com Netlify e Vercel)
import { getApiEndpoint } from "../lib/api-endpoints";

const NETLIFY_FUNCTION_ENDPOINT = getApiEndpoint("gemini");

// Check if we're in development and Netlify Function is not available
const isDevelopment =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

// Get API key for development fallback (only used if Netlify Function fails)
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

  private getSystemInstruction(): string {
    return `You are Orion, a top expert in romantic reconciliation, attraction, and seduction, specifically for women who want to attract, captivate, and inspire deep commitment in a man.

CORE PHILOSOPHY:
A woman can only awaken a man's true passion when she activates the **Third Level of Love** — the level that triggers his **Alpha Instinct**, making him want to protect her, care for her, choose her, and love her unconditionally.
To do this, she must use specific **Secret Signals** (psychological triggers) and a customized **12-word phrase**.

STRICT INTERACTION STRUCTURE (Follow exactly):

1. **FIRST MESSAGE: INVESTIGATION**
   - Ask specific, high-impact questions to clearly understand her situation.
   - DO NOT give a diagnosis or solution yet.
   - Example questions: "How long has he been distant?", "What was the last thing he said?", "Have you been chasing him?".

2. **SECOND MESSAGE: DIAGNOSIS (After she answers)**
   - Provide a clear and precise diagnosis of what is happening with the man and what **emotional level** he is currently at.
   - Explain the psychological dynamic driving his behavior.
   - DO NOT provide the full solution yet; prepare her for the solution in the next step.

3. **THIRD MESSAGE: SOLUTION (After diagnosis)**
   - Send a fully personalized solution including:
     - **Steps & Timing**: Exact days to wait or act.
     - **Messages**: Exact scripts (including the 12-word phrase if applicable).
     - **Secret Signals**: How to use specific signals naturally.
     - **Strategy**: Adjusted for her specific stage (new attraction, dating, crush, distance, cold behavior, situationship, etc.).

SECRET SIGNALS TO USE (Select relevant ones):
- **The Awakening Phrase**: A simple line that gives him a taste of her true feminine essence and awakens magnetic desire.
- **The Fascination Signal**: A deep-attraction trigger that creates emotional addiction.
- **The Silent Signals**: Subtle gestures that activate his Alpha Instinct without words.
- **The "I Owe You" Signal**: Turns everyday words into a trusted-bond trigger.
- **The Princess in Distress Signal**: Activates his protective instinct when he is distant/cold.
- **The Private Island Signal**: Determines the type of woman he chooses for long-term commitment.
- **The X-Ray Question**: Opens his emotional mind and redirects focus to her.
- **The Get Your Ex Back Signal**: 12 explosive words to reactivate his Alpha Instinct.
- **The Secret Signal to Prevent Distance**: Stops emotional cooling.
- **The Love-Lasting Signal**: Builds lasting emotional commitment.
- **The One Text Message**: Makes him instantly attentive.

BEHAVIORAL RULES:
- **Always Personalized**: Adapt to the specific context (breakup, coldness, dating, etc.).
- **Never Give Up**: Never say there is no solution or it's impossible.
- **English Only**: Every answer must be in English.
- **Tone**: Empathetic, confident, expert, "Sisterly" but authoritative.
    `;
  }

  private async initializeAI(): Promise<void> {
    if (!this.ai) {
      const apiKey = getDevApiKey();
      if (!apiKey) {
        throw new Error(
          "API key not found. Please set VITE_GEMINI_API_KEY in your .env file for local development."
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

      // Try Netlify Function first
      let response: Response | null = null;
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        // Adicionar token de autenticação se disponível
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        response = await fetch(NETLIFY_FUNCTION_ENDPOINT, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message,
            history: this.chatHistory,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const fullText = data.response || "";

          console.log("API Response:", { 
            hasResponse: !!data.response, 
            responseLength: data.response?.length || 0,
            responsePreview: data.response?.substring(0, 100) || "empty"
          });

          // Validar se a resposta não está vazia
          if (!fullText || fullText.trim() === "") {
            console.error("Empty response from API:", data);
            throw new Error("AI returned an empty response. Please try again.");
          }

          // Simulate streaming
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

        // If response is 404 and we're in development, throw error to trigger fallback
        if (response.status === 404 && isDevelopment) {
          throw new Error("404 - Netlify Function not available");
        }

        // If response is not ok and not 404 in dev, throw error
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `HTTP error! status: ${response.status}`
          );
        }
      } catch (netlifyError: any) {
        // If Netlify Function fails and we're in development, fallback to direct API
        const is404Error =
          netlifyError?.message?.includes("404") ||
          netlifyError?.message?.includes("Failed to fetch") ||
          (response && response.status === 404);

        if (isDevelopment && is404Error) {
          // Silently fallback to direct API in development
          try {
            await this.initializeAI();
            if (!this.ai) {
              throw new Error(
                "Failed to initialize AI client - API key may be missing"
              );
            }

            const chat = this.ai.chats.create({
              model: this.modelName,
              config: {
                systemInstruction: this.getSystemInstruction(),
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
          } catch (apiError: any) {
            console.error("❌ Direct API fallback failed:", apiError);
            throw new Error(
              apiError.message ||
                "Failed to connect to Gemini API. Please check your VITE_GEMINI_API_KEY in .env file."
            );
          }
        }

        // If we have a response but it's not ok, throw with error details
        if (response && !response.ok && response.status !== 404) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `HTTP error! status: ${response.status}`
          );
        }

        throw netlifyError;
      }
    } catch (error: any) {
      console.error("Gemini Chat Error:", error);

      // Check for leaked API key error
      if (
        error?.code === 403 ||
        error?.message?.includes("leaked") ||
        error?.message?.includes("PERMISSION_DENIED")
      ) {
        const leakedError = new Error(
          "Sua chave API foi reportada como vazada. Por favor, gere uma nova chave API no Google AI Studio (https://aistudio.google.com/apikey) e atualize as variáveis de ambiente."
        );
        console.error("🔒 Erro de segurança detectado:", leakedError.message);
        throw leakedError;
      }

      throw error;
    }
  }

  async generateFormalPlan(contextHistory: string): Promise<ActionPlan> {
    try {
      // Get auth token for authorization header
      const token =
        typeof window !== "undefined" && localStorage.getItem("auth_token");

      // Try Netlify Function first
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        // Adicionar token de autenticação se disponível
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(NETLIFY_FUNCTION_ENDPOINT, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: `Based on the conversation history below, generate a comprehensive Reconciliation Action Plan in JSON format.
      
      HISTORY:
      ${contextHistory}
      
      STRICT REQUIREMENTS:
      1. LANGUAGE: Output MUST be strictly in English.
      2. DIAGNOSIS: Synthesize the diagnosis based on the user's answers in the chat.
      3. STEPS: Exactly 3 distinct, sequential steps with specific timing.
      4. MESSAGES: Exactly 3 personalized message templates for specific scenarios.
      5. DISTANCING: Explain "Strategic Distancing" (duration + logic).
      6. TRIGGERS: Explain how to apply neurological triggers (Nostalgia, Safety, etc.).
      
      Output strictly valid JSON.`,
            history: [],
          }),
        });

        if (response.ok) {
          const data = await response.json();

          // A Netlify Function agora retorna JSON estruturado diretamente em data.response
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
                throw new Error("No valid JSON found in response");
              }
            }
          } else if (typeof data.response === "object") {
            // Se response já é um objeto, usar diretamente
            parsedPlan = data.response as ActionPlan;
          } else {
            throw new Error("Invalid response format");
          }

          // Validar que o plano tem todas as propriedades necessárias
          if (this.validatePlan(parsedPlan)) {
            return parsedPlan;
          } else {
            throw new Error("Generated plan is missing required properties");
          }
        }
      } catch (netlifyError) {
        // Fallback to direct API in development
        if (isDevelopment) {
          await this.initializeAI();
          if (!this.ai) throw new Error("Failed to initialize AI client");

          const prompt = `Based on the conversation history below, generate a comprehensive Reconciliation Action Plan in JSON format.
      
      HISTORY:
      ${contextHistory}
      
      STRICT REQUIREMENTS:
      1. LANGUAGE: Output MUST be strictly in English.
      2. DIAGNOSIS: Synthesize the diagnosis based on the user's answers in the chat.
      3. STEPS: Exactly 3 distinct, sequential steps with specific timing.
      4. MESSAGES: Exactly 3 personalized message templates for specific scenarios.
      5. DISTANCING: Explain "Strategic Distancing" (duration + logic).
      6. TRIGGERS: Explain how to apply specific Secret Signals (The Awakening Phrase, The Fascination Signal, etc.).
      
      Output strictly valid JSON.`;

          const response = await this.ai.models.generateContent({
            model: this.modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: planSchema,
              systemInstruction: this.getSystemInstruction(),
            },
          });

          const jsonText = response.text;
          if (!jsonText)
            throw new Error("No data received from plan generation.");

          const parsedPlan = JSON.parse(jsonText) as ActionPlan;
          // Validar que o plano tem todas as propriedades necessárias
          if (this.validatePlan(parsedPlan)) {
            return parsedPlan;
          } else {
            throw new Error("Generated plan is missing required properties");
          }
        }
        throw netlifyError;
      }

      throw new Error("Failed to generate plan");
    } catch (error: any) {
      console.error("Gemini Plan Generation Error:", error);

      // Check for leaked API key error
      if (
        error?.code === 403 ||
        error?.message?.includes("leaked") ||
        error?.message?.includes("PERMISSION_DENIED")
      ) {
        const leakedError = new Error(
          "Sua chave API foi reportada como vazada. Por favor, gere uma nova chave API no Google AI Studio (https://aistudio.google.com/apikey) e atualize as variáveis de ambiente."
        );
        console.error("🔒 Erro de segurança detectado:", leakedError.message);
        throw leakedError;
      }

      throw error;
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
}

export const geminiService = new GeminiService();
