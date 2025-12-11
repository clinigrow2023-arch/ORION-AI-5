import { AIProvider, createProviderError, isRetryableError } from "./base.js";

// Ollama3 Provider Implementation
export class Ollama3Provider implements AIProvider {
  name = "Ollama3";
  private baseUrl: string;
  private model: string;
  private apiKey: string;

  constructor(
    baseUrl: string = "http://31.97.93.86:11434",
    model: string = "llama3",
    apiKey?: string
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
    // Usar token secreto para proteger a VPS
    this.apiKey = apiKey || process.env.OLLAMA_API_KEY || "";
  }

  async sendMessage(
    message: string,
    history: Array<{ role: string; parts: Array<{ text: string }> }>,
    systemInstruction: string
  ): Promise<string> {
    try {
      console.log(`[Ollama3] Starting sendMessage request to ${this.baseUrl}`);
      
      // Construir prompt completo com histórico e system instruction
      let fullPrompt = "";

      // Adicionar system instruction
      if (systemInstruction) {
        fullPrompt += `${systemInstruction}\n\n`;
      }

      // Converter histórico para formato conversacional
      for (const h of history) {
        const role = h.role === "user" ? "User" : "Assistant";
        const content = h.parts.map((p) => p.text).join(" ");
        if (content.trim()) {
          fullPrompt += `${role}: ${content}\n\n`;
        }
      }

      // Adicionar mensagem atual
      fullPrompt += `User: ${message}\n\nAssistant:`;

      // Preparar headers com autenticação
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Adicionar token de autenticação se configurado
      if (this.apiKey) {
        headers["X-API-Key"] = this.apiKey;
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      const requestBody = {
        model: this.model,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: 0.7,
        },
      };

      console.log(`[Ollama3] Request body prepared, model: ${this.model}, prompt length: ${fullPrompt.length}`);

      // Adicionar timeout de 60 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/api/generate`, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === "AbortError") {
          throw createProviderError(
            this.name,
            "Request timeout after 60 seconds",
            "TIMEOUT",
            true
          );
        }
        throw fetchError;
      }

      console.log(`[Ollama3] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        let errorData: any = {};
        try {
          const errorText = await response.text();
          console.error(`[Ollama3] Error response body:`, errorText);
          errorData = JSON.parse(errorText);
        } catch (e) {
          console.error(`[Ollama3] Failed to parse error response`);
        }
        
        const isRetryable = isRetryableError({
          message: errorData.error || `HTTP ${response.status}`,
          status: response.status,
        });
        
        console.error(`[Ollama3] Request failed:`, {
          status: response.status,
          error: errorData.error || "Unknown error",
          retryable: isRetryable,
        });
        
        throw createProviderError(
          this.name,
          errorData.error || `HTTP error! status: ${response.status}`,
          response.status,
          isRetryable
        );
      }

      const data = await response.json();
      console.log(`[Ollama3] Response received, keys:`, Object.keys(data));

      // Ollama pode retornar response diretamente ou em diferentes formatos
      let content = "";
      if (data.response) {
        content = data.response;
      } else if (typeof data === "string") {
        content = data;
      } else if (data.text) {
        content = data.text;
      } else {
        console.error(`[Ollama3] Unexpected response format:`, JSON.stringify(data).substring(0, 500));
        throw createProviderError(
          this.name,
          `Invalid response format from Ollama API. Expected 'response' field, got: ${JSON.stringify(data).substring(0, 100)}`,
          undefined,
          false
        );
      }

      // Validar se a resposta não está vazia
      if (!content || content.trim() === "") {
        console.error(`[Ollama3] Empty response received`);
        throw createProviderError(
          this.name,
          "Empty response from Ollama API",
          undefined,
          true // Retryable - pode ser um problema temporário
        );
      }

      console.log(`[Ollama3] Success! Response length: ${content.length}`);
      return content;
    } catch (error: any) {
      if (error.provider) {
        console.error(`[Ollama3] Provider error:`, error.message);
        throw error; // Already a provider error
      }

      console.error(`[Ollama3] Unexpected error:`, {
        message: error.message,
        code: error.code,
        status: error.status,
        stack: error.stack?.substring(0, 200),
      });

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
      console.log(`[Ollama3] Starting generatePlan request to ${this.baseUrl}`);
      
      const prompt = `${systemInstruction}\n\nBased on the conversation history below, generate a comprehensive Reconciliation Action Plan in JSON format.

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

      // Preparar headers com autenticação
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Adicionar token de autenticação se configurado
      if (this.apiKey) {
        headers["X-API-Key"] = this.apiKey;
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      const requestBody = {
        model: this.model,
        prompt: prompt,
        stream: false,
        format: "json",
        options: {
          temperature: 0.7,
        },
      };

      console.log(`[Ollama3] Plan request prepared, prompt length: ${prompt.length}`);

      // Adicionar timeout de 90 segundos (plan generation pode demorar mais)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/api/generate`, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === "AbortError") {
          throw createProviderError(
            this.name,
            "Plan generation timeout after 90 seconds",
            "TIMEOUT",
            true
          );
        }
        throw fetchError;
      }

      console.log(`[Ollama3] Plan response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        let errorData: any = {};
        try {
          const errorText = await response.text();
          console.error(`[Ollama3] Plan error response body:`, errorText);
          errorData = JSON.parse(errorText);
        } catch (e) {
          console.error(`[Ollama3] Failed to parse plan error response`);
        }
        
        const isRetryable = isRetryableError({
          message: errorData.error || `HTTP ${response.status}`,
          status: response.status,
        });
        
        console.error(`[Ollama3] Plan generation failed:`, {
          status: response.status,
          error: errorData.error || "Unknown error",
          retryable: isRetryable,
        });
        
        throw createProviderError(
          this.name,
          errorData.error || `HTTP error! status: ${response.status}`,
          response.status,
          isRetryable
        );
      }

      const data = await response.json();
      console.log(`[Ollama3] Plan response received, keys:`, Object.keys(data));

      // Ollama pode retornar response diretamente ou em diferentes formatos
      let jsonText = "";
      if (data.response) {
        jsonText = data.response;
      } else if (typeof data === "string") {
        jsonText = data;
      } else if (data.text) {
        jsonText = data.text;
      } else {
        console.error(`[Ollama3] Unexpected plan response format:`, JSON.stringify(data).substring(0, 500));
        throw createProviderError(
          this.name,
          `Invalid response format from Ollama API. Expected 'response' field, got: ${JSON.stringify(data).substring(0, 100)}`,
          undefined,
          false
        );
      }

      if (!jsonText || jsonText.trim() === "") {
        console.error(`[Ollama3] Empty plan response received`);
        throw createProviderError(
          this.name,
          "No data received from plan generation",
          undefined,
          false
        );
      }

      // Tentar validar se é JSON válido
      try {
        JSON.parse(jsonText);
        console.log(`[Ollama3] Plan generation success! JSON is valid, length: ${jsonText.length}`);
      } catch (parseError) {
        console.warn(`[Ollama3] Plan response may not be valid JSON, but returning anyway:`, jsonText.substring(0, 200));
      }

      return jsonText;
    } catch (error: any) {
      if (error.provider) {
        console.error(`[Ollama3] Plan provider error:`, error.message);
        throw error; // Already a provider error
      }

      console.error(`[Ollama3] Plan unexpected error:`, {
        message: error.message,
        code: error.code,
        status: error.status,
        stack: error.stack?.substring(0, 200),
      });

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
