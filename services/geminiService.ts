import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ActionPlan } from '../types';

// Safe access to process.env to prevent runtime crashes in pure browser environments
const getApiKey = (): string => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.GEMINI_API_KEY || '';
  }
  return '';
};

const apiKey = getApiKey();

if (!apiKey || apiKey === 'your_api_key_here' || apiKey.trim() === '') {
  console.error('⚠️ GEMINI_API_KEY não encontrada ou inválida no arquivo .env');
  console.error('Por favor, adicione sua chave API do Gemini no arquivo .env:');
  console.error('GEMINI_API_KEY=sua_chave_aqui');
}

// Schema for the JSON response
const planSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    diagnosis: { type: Type.STRING, description: "A clear, analytical diagnosis of what caused the distance or breakup in simple human terms." },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          stepNumber: { type: Type.INTEGER },
          title: { type: Type.STRING },
          description: { type: Type.STRING, description: "Clear instructions with psychological justification." },
          duration: { type: Type.STRING, description: "Specific timing (e.g., '3 days', '5-7 days')" }
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
          text: { type: Type.STRING, description: "The exact text content, personalized to the user." },
          timing: { type: Type.STRING, description: "When to send it" }
        },
        required: ["situation", "text", "timing"]
      }
    },
    dos: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of things the user MUST do to build value and emotional safety."
    },
    donts: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of behaviors to avoid (pressure, lowering value)."
    },
    distancingStrategy: { type: Type.STRING, description: "Explanation of Strategic Distancing vs No Contact, including exact timeframe." },
    neurologicalTriggers: { type: Type.STRING, description: "How to use triggers like Nostalgia, Safety, Curiosity, etc." }
  },
  required: ["diagnosis", "steps", "messageTemplates", "dos", "donts", "distancingStrategy", "neurologicalTriggers"]
};

export class GeminiService {
  private ai: GoogleGenAI;
  private modelName = 'gemini-2.5-flash';
  // History for the continuous chat
  private chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

  constructor() {
    if (!apiKey || apiKey === 'your_api_key_here' || apiKey.trim() === '') {
      throw new Error('API key is missing. Please provide a valid GEMINI_API_KEY in your .env file.');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  private getSystemInstruction(): string {
    return `You are Orion AI, a specialized digital mentor for relationship reconciliation. 
    
    STRICT BEHAVIORAL PROTOCOL (Follow this order exactly):
    
    1. **PHASE 1: INVESTIGATION (The Interview)**
       - When the user first describes their situation, DO NOT offer a solution or plan immediately.
       - Instead, acknowledge their pain briefly and act as a diagnostician.
       - ASK 3-4 strategic, high-impact questions to understand the context. Examples: "Who ended it?", "How long ago?", "Have you been chasing or begging?", "What was the specific reason given?".
       - Wait for the user's answers.

    2. **PHASE 2 & 3: DIAGNOSIS AND STRATEGY (The Pivot)**
       - Once the user answers your questions, you MUST provide the Diagnosis AND the Action Plan in the SAME response.
       - **Step 1: The Diagnosis**: First, provide a clear, analytical diagnosis of *why* the breakup happened psychologically (e.g., "Loss of attraction due to predictability," "Erosion of emotional safety").
       - **Step 2: The Action Plan**: IMMEDIATELY after the diagnosis, provide the personalized strategy. DO NOT wait for the user to ask "What do I do?".
       - The Plan MUST include:
         - **3-Step Action Plan**: Clear steps with specific timing.
         - **3 Message Templates**: Personalized texts for their exact situation.
         - **Strategic Distancing**: Specific timeframe (e.g., "5-7 days") and logic.
         - **Neurological Triggers**: Which specific triggers to use (Nostalgia, Safety, etc.).
    
    KEY CONCEPTS TO TEACH:
    - **Strategic Distancing** (NOT "No Contact"): Explain it as a calibration tool to reset pressure and spark curiosity. Always specify exact days (e.g., "5 days", "10 days"). Contrast it with "No Contact" (which feels punitive).
    - **Neurological Triggers**: Mention concepts like "Nostalgia Spike", "Safety Validation", "Dopamine Reset", "Curiosity Loops".

    TONE & LANGUAGE:
    - **Language**: ALL OUTPUT MUST BE IN ENGLISH.
    - **Tone**: Warm, Rational, Analytical, Practical. Like a supportive expert friend.
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
    } catch (error: any) {
      console.error("Gemini Chat Error:", error);
      
      // Check for leaked API key error
      if (error?.code === 403 || error?.message?.includes('leaked') || error?.message?.includes('PERMISSION_DENIED')) {
        const leakedError = new Error(
          'Sua chave API foi reportada como vazada. Por favor, gere uma nova chave API no Google AI Studio (https://aistudio.google.com/apikey) e atualize o arquivo .env com a nova chave.'
        );
        console.error('🔒 Erro de segurança detectado:', leakedError.message);
        throw leakedError;
      }
      
      throw error;
    }
  }

  async generateFormalPlan(contextHistory: string): Promise<ActionPlan> {
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
      6. TRIGGERS: Explain how to apply neurological triggers (Nostalgia, Safety, etc.).
      
      Output strictly valid JSON.`;

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

    } catch (error: any) {
      console.error("Gemini Plan Generation Error:", error);
      
      // Check for leaked API key error
      if (error?.code === 403 || error?.message?.includes('leaked') || error?.message?.includes('PERMISSION_DENIED')) {
        const leakedError = new Error(
          'Sua chave API foi reportada como vazada. Por favor, gere uma nova chave API no Google AI Studio (https://aistudio.google.com/apikey) e atualize o arquivo .env com a nova chave.'
        );
        console.error('🔒 Erro de segurança detectado:', leakedError.message);
        throw leakedError;
      }
      
      throw error;
    }
  }
    
  getHistoryAsString(): string {
      return this.chatHistory.map(h => `${h.role}: ${h.parts[0].text}`).join('\n');
  }
}

export const geminiService = new GeminiService();