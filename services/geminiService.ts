import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ActionPlan } from '../types';

// Safe access to process.env to prevent runtime crashes in pure browser environments
const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) ? process.env.API_KEY : '';

// Schema for the JSON response
const planSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    diagnosis: { type: Type.STRING, description: "A clear, analytical diagnosis of what caused the distance or breakup." },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          stepNumber: { type: Type.INTEGER },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          duration: { type: Type.STRING, description: "e.g., '2 weeks', 'Immediately'" }
        },
        required: ["stepNumber", "title", "description", "duration"]
      }
    },
    messageTemplates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          situation: { type: Type.STRING, description: "When to use this message" },
          text: { type: Type.STRING, description: "The exact text content" },
          timing: { type: Type.STRING, description: "When to send it" }
        },
        required: ["situation", "text", "timing"]
      }
    },
    dos: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of things the user MUST do."
    },
    donts: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of things the user MUST AVOID."
    },
    distancingStrategy: { type: Type.STRING, description: "Explanation of when and how to apply strategic distancing for this specific case." },
    neurologicalTriggers: { type: Type.STRING, description: "Specific techniques to activate emotional memory and connection (e.g., Nostalgia Spike). Explain HOW." }
  },
  required: ["diagnosis", "steps", "messageTemplates", "dos", "donts", "distancingStrategy", "neurologicalTriggers"]
};

export class GeminiService {
  private ai: GoogleGenAI;
  private modelName = 'gemini-2.5-flash';
  // History for the continuous chat
  private chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

  constructor() {
    this.ai = new GoogleGenAI({ apiKey });
  }

  private getSystemInstruction(): string {
    return `You are Orion AI, a world-class relationship reconciliation mentor. 
    Your persona is Analytical, Practical, Strategic, and Direct. 
    You are NOT a shoulder to cry on; you are a strategist helping the user achieve a specific goal: reconciliation or closure through high-value behavior.
    
    Your Core Philosophies:
    1. Strategic Distancing: Absence creates value.
    2. Neurological Triggers: Use nostalgia and high-value demonstrations to re-engage emotional centers.
    3. Emotional Control: Never act out of desperation.
    
    Your tasks:
    - Analyze the user's romantic situation deeply.
    - Ask clarifying questions if details are missing (history, breakup reason, current contact level) BEFORE giving advice.
    - Provide specific, copy-pasteable text responses for real situations (e.g., "If she texts X, you respond Y").
    - Explain the 'Why' behind every piece of advice based on psychology.
    - Guide the user on exactly when to apply strategic distancing.
    
    IMPORTANT: 
    - Detect the language of the user's input (e.g., Portuguese, English, Spanish).
    - You MUST respond in the same language as the user. 
    - If the user asks in Portuguese, the Plan and Chat must be in Portuguese.
    
    If asked for a Plan, synthesize all known information into a coherent strategy.
    `;
  }

  async sendMessageStream(message: string, onChunk: (text: string) => void): Promise<string> {
    try {
      const chat = this.ai.chats.create({
        model: this.modelName,
        config: {
          systemInstruction: this.getSystemInstruction(),
        },
        history: this.chatHistory
      });

      const result = await chat.sendMessageStream({ message });
      
      let fullText = '';
      for await (const chunk of result) {
        const text = chunk.text;
        if (text) {
          fullText += text;
          onChunk(text);
        }
      }

      // Update local history
      this.chatHistory.push({ role: 'user', parts: [{ text: message }] });
      this.chatHistory.push({ role: 'model', parts: [{ text: fullText }] });

      return fullText;
    } catch (error) {
      console.error("Gemini Chat Error:", error);
      throw error;
    }
  }

  async generateFormalPlan(contextHistory: string): Promise<ActionPlan> {
    try {
      const prompt = `Based on the following conversation history, generate a comprehensive Reconciliation Action Plan.
      
      CONVERSATION HISTORY:
      ${contextHistory}
      
      REQUIREMENTS:
      1. Output strictly valid JSON adhering to the schema provided.
      2. The content MUST be in the same language as the conversation history (e.g., if the user speaks Portuguese, output Portuguese).
      3. The plan MUST have exactly 3 distinct Steps in the 'steps' array.
      4. The plan MUST have exactly 3 specific Message Templates in the 'messageTemplates' array.
      5. Analyze deeply and be practical.`;

      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: planSchema,
          systemInstruction: this.getSystemInstruction(),
        }
      });

      const jsonText = response.text;
      if (!jsonText) throw new Error("No data received from plan generation.");
      
      return JSON.parse(jsonText) as ActionPlan;

    } catch (error) {
      console.error("Gemini Plan Generation Error:", error);
      throw error;
    }
  }
    
  getHistoryAsString(): string {
      return this.chatHistory.map(h => `${h.role}: ${h.parts[0].text}`).join('\n');
  }
}

export const geminiService = new GeminiService();