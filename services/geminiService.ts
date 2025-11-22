import { ActionPlan } from '../types';

// Netlify Function endpoint
const getApiEndpoint = (): string => {
  if (typeof window !== 'undefined') {
    // Use Netlify Function endpoint
    return '/.netlify/functions/gemini';
  }
  return '/.netlify/functions/gemini';
};

const API_ENDPOINT = getApiEndpoint();

export class GeminiService {
  // History for the continuous chat
  private chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

  async sendMessageStream(message: string, onChunk: (text: string) => void): Promise<string> {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          history: this.chatHistory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const fullText = data.response || '';

      // Simulate streaming by calling onChunk with the full text
      // In a real streaming implementation, you'd use Server-Sent Events or similar
      if (fullText && onChunk) {
        // Split into chunks for streaming effect
        const words = fullText.split(' ');
        for (let i = 0; i < words.length; i++) {
          const chunk = (i === 0 ? '' : ' ') + words[i];
          onChunk(chunk);
          // Small delay for streaming effect
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Update local history
      if (data.history) {
        this.chatHistory = data.history;
      } else {
        this.chatHistory.push({ role: 'user', parts: [{ text: message }] });
        this.chatHistory.push({ role: 'model', parts: [{ text: fullText }] });
      }

      return fullText;
    } catch (error: any) {
      console.error("Gemini Chat Error:", error);
      
      // Check for leaked API key error
      if (error?.code === 403 || error?.message?.includes('leaked') || error?.message?.includes('PERMISSION_DENIED')) {
        const leakedError = new Error(
          'Sua chave API foi reportada como vazada. Por favor, gere uma nova chave API no Google AI Studio (https://aistudio.google.com/apikey) e atualize as variáveis de ambiente no Netlify.'
        );
        console.error('🔒 Erro de segurança detectado:', leakedError.message);
        throw leakedError;
      }
      
      throw error;
    }
  }

  async generateFormalPlan(contextHistory: string): Promise<ActionPlan> {
    try {
      // For now, we'll use the chat endpoint to generate the plan
      // In the future, you might want a separate endpoint for plan generation
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

      const response = await this.sendMessageStream(prompt, () => {});
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      return JSON.parse(jsonMatch[0]) as ActionPlan;
    } catch (error: any) {
      console.error("Gemini Plan Generation Error:", error);
      
      // Check for leaked API key error
      if (error?.code === 403 || error?.message?.includes('leaked') || error?.message?.includes('PERMISSION_DENIED')) {
        const leakedError = new Error(
          'Sua chave API foi reportada como vazada. Por favor, gere uma nova chave API no Google AI Studio (https://aistudio.google.com/apikey) e atualize as variáveis de ambiente no Netlify.'
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
