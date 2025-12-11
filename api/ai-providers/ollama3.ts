import { AIProvider, createProviderError, isRetryableError } from "./base.js";

// Ollama3 Provider Implementation
export class Ollama3Provider implements AIProvider {
  name = "Ollama3";
  private baseUrl: string;
  private model: string;
  private apiKey: string;

  constructor(
    baseUrl: string = process.env.OLLAMA_URL || "http://localhost:11434",
    model: string = "llama3:8b",
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
      // Log removido por segurança (não expor URL da VPS)

      // Otimização ULTRA EXTREMA: Limitar histórico às últimas 2 mensagens (1 turno)
      // Para velocidade máxima, apenas contexto imediato
      const MAX_HISTORY_MESSAGES = 2;
      const limitedHistory = history.slice(-MAX_HISTORY_MESSAGES);

      // Log removido por segurança

      // Construir prompt completo com histórico e system instruction
      let fullPrompt = "";

      // Adicionar system instruction (resumida se muito longa)
      if (systemInstruction) {
        // Limitar system instruction a 300 caracteres para velocidade ULTRA
        const systemInst =
          systemInstruction.length > 300
            ? systemInstruction.substring(0, 300) + "..."
            : systemInstruction;
        fullPrompt += `${systemInst}\n\n`;
      }

      // Converter histórico para formato conversacional (mais compacto)
      for (const h of limitedHistory) {
        const role = h.role === "user" ? "User" : "Assistant";
        const content = h.parts
          .map((p) => p.text)
          .join(" ")
          .trim();
        if (content) {
          // Limitar cada mensagem do histórico a 150 caracteres para velocidade ULTRA
          const truncatedContent =
            content.length > 150 ? content.substring(0, 150) + "..." : content;
          fullPrompt += `${role}: ${truncatedContent}\n`;
        }
      }

      // Adicionar mensagem atual
      fullPrompt += `User: ${message}\nAssistant:`;

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
        // Aumentar contexto para suportar respostas completas
        num_ctx: 4096, // Máximo de tokens no contexto (aumentado para respostas completas)
        options: {
          temperature: 0.7,
          // Aumentar tokens gerados para respostas completas (sem cortar)
          num_predict: 4096, // Máximo de tokens na resposta (aumentado para gerar respostas completas)
          top_p: 0.9, // Nucleus sampling (mais rápido que top_k)
          repeat_penalty: 1.1, // Reduz repetição
        },
      };

      // Logs removidos por segurança (não expor modelo, URL, ou detalhes de requisição)

      // Timeout aumentado: 180 segundos (respostas completas podem demorar mais)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      const startTime = Date.now();
      let response: Response;
      try {
        // Log removido por segurança
        response = await fetch(`${this.baseUrl}/api/generate`, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        // Log removido por segurança (não expor tempo de resposta)
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === "AbortError") {
          throw createProviderError(
            this.name,
            "Request timeout after 90 seconds",
            "TIMEOUT",
            true
          );
        }
        throw fetchError;
      }

      // Log removido por segurança

      if (!response.ok) {
        let errorData: any = {};
        try {
          const errorText = await response.text();
          // Log removido por segurança (não expor detalhes de erro)
          errorData = JSON.parse(errorText);
        } catch (e) {
          // Log removido por segurança
        }

        const isRetryable = isRetryableError({
          message: errorData.error || `HTTP ${response.status}`,
          status: response.status,
        });

        // Log removido por segurança (não expor detalhes de erro)

        throw createProviderError(
          this.name,
          errorData.error || `HTTP error! status: ${response.status}`,
          response.status,
          isRetryable
        );
      }

      const data = await response.json();
      // Log removido por segurança

      // Ollama pode retornar response diretamente ou em diferentes formatos
      let content = "";
      if (data.response) {
        content = data.response;
      } else if (typeof data === "string") {
        content = data;
      } else if (data.text) {
        content = data.text;
      } else {
        // Log removido por segurança
        throw createProviderError(
          this.name,
          `Invalid response format from Ollama API. Expected 'response' field, got: ${JSON.stringify(
            data
          ).substring(0, 100)}`,
          undefined,
          false
        );
      }

      // Validar se a resposta não está vazia
      if (!content || content.trim() === "") {
        // Log removido por segurança
        throw createProviderError(
          this.name,
          "Empty response from Ollama API",
          undefined,
          true // Retryable - pode ser um problema temporário
        );
      }

      // Log removido por segurança
      return content;
    } catch (error: any) {
      if (error.provider) {
        // Log removido por segurança
        throw error; // Already a provider error
      }

      // Log removido por segurança (não expor stack trace ou detalhes de erro)

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
      // Log removido por segurança (não expor URL da VPS)

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
        // Aumentar contexto para suportar planos completos
        num_ctx: 8192, // Máximo de tokens no contexto (aumentado para planos completos)
        options: {
          temperature: 0.7,
          // Aumentar tokens gerados para planos completos (sem cortar)
          num_predict: 8192, // Máximo de tokens na resposta (aumentado para gerar planos completos)
          top_p: 0.9,
          repeat_penalty: 1.1,
        },
      };

      // Log removido por segurança

      // Timeout aumentado: 180 segundos (planos completos podem demorar mais)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

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

      console.log(
        `[Ollama3] Plan response status: ${response.status} ${response.statusText}`
      );

      if (!response.ok) {
        let errorData: any = {};
        try {
          const errorText = await response.text();
          // Log removido por segurança (não expor detalhes de erro)
          errorData = JSON.parse(errorText);
        } catch (e) {
          // Log removido por segurança
        }

        const isRetryable = isRetryableError({
          message: errorData.error || `HTTP ${response.status}`,
          status: response.status,
        });

        // Log removido por segurança (não expor detalhes de erro)

        throw createProviderError(
          this.name,
          errorData.error || `HTTP error! status: ${response.status}`,
          response.status,
          isRetryable
        );
      }

      const data = await response.json();
      // Log removido por segurança

      // Ollama pode retornar response diretamente ou em diferentes formatos
      let jsonText = "";
      if (data.response) {
        jsonText = data.response;
      } else if (typeof data === "string") {
        jsonText = data;
      } else if (data.text) {
        jsonText = data.text;
      } else {
        // Log removido por segurança
        throw createProviderError(
          this.name,
          `Invalid response format from Ollama API. Expected 'response' field, got: ${JSON.stringify(
            data
          ).substring(0, 100)}`,
          undefined,
          false
        );
      }

      if (!jsonText || jsonText.trim() === "") {
        // Log removido por segurança
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
        // Log removido por segurança
      } catch (parseError) {
        // Log removido por segurança
      }

      return jsonText;
    } catch (error: any) {
      if (error.provider) {
        // Log removido por segurança
        throw error; // Already a provider error
      }

      // Log removido por segurança (não expor stack trace ou detalhes de erro)

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
