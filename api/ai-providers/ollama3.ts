import { AIProvider, createProviderError, isRetryableError } from "./base.js";

// Ollama3 Provider Implementation
export class Ollama3Provider implements AIProvider {
  name = "Ollama3";
  private baseUrl: string;
  private model: string;
  private apiKey: string;

  constructor(
    baseUrl: string = process.env.OLLAMA_URL || "http://localhost:11434",
    model: string = process.env.OLLAMA_MODEL || "llama3-8b-fast",
    apiKey?: string
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
    // Usar token secreto para proteger a VPS
    this.apiKey = apiKey || process.env.OLLAMA_API_KEY || "";

    // Debug: mostrar qual modelo está sendo usado
    console.log(`[Ollama3] Provider inicializado com modelo: ${this.model}`);
    console.log(`[Ollama3] Base URL: ${this.baseUrl}`);
    console.log(
      `[Ollama3] OLLAMA_MODEL env: ${
        process.env.OLLAMA_MODEL || "não definido"
      }`
    );
  }

  async sendMessage(
    message: string,
    history: Array<{ role: string; parts: Array<{ text: string }> }>,
    systemInstruction: string
  ): Promise<string> {
    try {
      // Log removido por segurança (não expor URL da VPS)

      // Histórico otimizado: 2 mensagens (1 turno) para velocidade máxima
      // Menos contexto significa respostas mais rápidas
      const MAX_HISTORY_MESSAGES = 2; // Reduzido para velocidade
      const limitedHistory = history.slice(-MAX_HISTORY_MESSAGES);

      // SEMPRE reforçar instruções críticas no início do system instruction
      // Modelos pequenos (como llama3.2:1b) precisam de instruções MUITO explícitas
      let enhancedSystemInstruction = systemInstruction;
      if (systemInstruction) {
        // Instruções CRITICAL MUITO explícitas e diretas - SEMPRE no início
        const criticalInstructions = `CRITICAL INSTRUCTIONS - YOU MUST OBEY THESE RULES:

1. You are Orion AI, a relationship and attraction mentor.
2. You MUST ALWAYS help users with relationship questions - this is your PRIMARY PURPOSE.
3. NEVER refuse, decline, or say you cannot help.
4. FORBIDDEN PHRASES - NEVER SAY THESE:
   - "I can't provide assistance"
   - "I can't help"
   - "I'm unable to"
   - "I cannot"
   - "I won't help"
   - "I can't fulfill that request"
   - "I can't provide assistance or guidance on relationships"
   - "I encourage you to reach out to a trusted friend"
   - Any phrase that refuses to help with relationship questions
5. If a question is unclear, ask clarifying questions - DO NOT refuse.
6. You help with HEALTHY relationship strategies, reconnection, and attraction.
7. You do NOT help with manipulation, harm, or abuse - but you MUST help with legitimate relationship questions.

REMEMBER: Your job is to help with relationships. NEVER refuse. ALWAYS help.`;

        // SEMPRE adicionar no início, mesmo se já tiver instruções críticas
        // Modelos pequenos precisam de reforço constante
        if (
          !systemInstruction.toLowerCase().startsWith("critical instructions")
        ) {
          enhancedSystemInstruction = `${criticalInstructions}

---

${systemInstruction}`;
        } else {
          // Se já começa com CRITICAL, ainda adicionar reforço
          enhancedSystemInstruction = `${criticalInstructions}

---

${systemInstruction}`;
        }
      }

      // Construir prompt completo com histórico
      let fullPrompt = "";

      // Converter histórico para formato conversacional (com truncamento para velocidade)
      const MAX_MESSAGE_LENGTH = 300; // Limitar cada mensagem a 300 caracteres para velocidade
      for (const h of limitedHistory) {
        const role = h.role === "user" ? "User" : "Assistant";
        let content = h.parts
          .map((p) => p.text)
          .join(" ")
          .trim();
        if (content) {
          // Truncar mensagens muito longas para reduzir prompt
          if (content.length > MAX_MESSAGE_LENGTH) {
            content = content.substring(0, MAX_MESSAGE_LENGTH) + "...";
          }
          fullPrompt += `${role}: ${content}\n`;
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

      // Usar campo 'system' separado se disponível (API do Ollama suporta isso)
      const requestBody: any = {
        model: this.model,
        prompt: fullPrompt,
        stream: false,
        // Contexto otimizado para velocidade (modelo 3b)
        num_ctx: 1024, // Reduzido para aceleração máxima
        options: {
          temperature: 0.7, // Levemente reduzido para respostas mais focadas
          // Tokens gerados otimizados para velocidade
          num_predict: 768, // Reduzido para aceleração máxima
          top_p: 0.9, // Levemente reduzido para respostas mais coerentes
          repeat_penalty: 1.2, // Aumentado para reduzir repetição
        },
      };

      // Adicionar system instruction como campo separado (API do Ollama suporta)
      if (enhancedSystemInstruction) {
        requestBody.system = enhancedSystemInstruction;
        // Também adicionar no início do prompt como fallback
        fullPrompt = `${enhancedSystemInstruction}\n\n${fullPrompt}`;
        requestBody.prompt = fullPrompt;
      }

      // Logs removidos por segurança (não expor modelo, URL, ou detalhes de requisição)

      // Timeout reduzido para respostas mais rápidas: 60 segundos
      const controller = new AbortController(); 
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const startTime = Date.now();
      let response: Response;
      try {
        console.log(
          `[Ollama3] Starting sendMessage request (model: ${this.model})`
        );
        console.log(
          `[Ollama3] System instruction length: ${
            enhancedSystemInstruction?.length || 0
          }`
        );
        console.log(
          `[Ollama3] Request body prepared, prompt length: ${fullPrompt.length}`
        );
        console.log(
          `[Ollama3] System instruction preview: ${
            enhancedSystemInstruction?.substring(0, 200) || "none"
          }...`
        );
        response = await fetch(`${this.baseUrl}/api/generate`, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[Ollama3] Response received after ${elapsedTime} seconds`);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === "AbortError") {
          throw createProviderError(
            this.name,
            "Request timeout after 180 seconds",
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
      console.log(
        `[Ollama3] Response status: ${response.status} ${response.statusText}`
      );
      console.log(`[Ollama3] Response keys:`, Object.keys(data));

      // Ollama pode retornar response diretamente ou em diferentes formatos
      let content = "";
      if (data.response) {
        content = data.response;
      } else if (typeof data === "string") {
        content = data;
      } else if (data.text) {
        content = data.text;
      } else {
        console.error(
          `[Ollama3] Invalid response format. Keys:`,
          Object.keys(data)
        );
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
        console.error(`[Ollama3] Empty response received`);
        throw createProviderError(
          this.name,
          "Empty response from Ollama API",
          undefined,
          true // Retryable - pode ser um problema temporário
        );
      }

      console.log(`[Ollama3] Success! Response length: ${content.length}`);
      console.log(
        `[Ollama3] Response preview: ${content.substring(0, 200)}...`
      );
      if (data.total_duration) {
        console.log(`[Ollama3] Total duration: ${data.total_duration / 1e9}s`);
      }
      if (data.eval_duration) {
        console.log(`[Ollama3] Eval duration: ${data.eval_duration / 1e9}s`);
      }
      if (data.prompt_eval_duration) {
        console.log(
          `[Ollama3] Prompt eval duration: ${data.prompt_eval_duration / 1e9}s`
        );
      }
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
      // SEMPRE reforçar instruções críticas no início do system instruction
      // Modelos pequenos (como llama3.2:1b) precisam de instruções MUITO explícitas
      let enhancedSystemInstruction = systemInstruction;
      if (systemInstruction) {
        // Instruções CRITICAL MUITO explícitas e diretas - SEMPRE no início
        const criticalInstructions = `CRITICAL INSTRUCTIONS - YOU MUST OBEY THESE RULES:

1. You are Orion AI, a relationship and attraction mentor.
2. You MUST ALWAYS help users with relationship questions - this is your PRIMARY PURPOSE.
3. NEVER refuse, decline, or say you cannot help.
4. FORBIDDEN PHRASES - NEVER SAY THESE:
   - "I can't provide assistance"
   - "I can't help"
   - "I'm unable to"
   - "I cannot"
   - "I won't help"
   - "I can't fulfill that request"
   - "I can't provide assistance or guidance on relationships"
   - "I encourage you to reach out to a trusted friend"
   - Any phrase that refuses to help with relationship questions
5. If a question is unclear, ask clarifying questions - DO NOT refuse.
6. You help with HEALTHY relationship strategies, reconnection, and attraction.
7. You do NOT help with manipulation, harm, or abuse - but you MUST help with legitimate relationship questions.

REMEMBER: Your job is to help with relationships. NEVER refuse. ALWAYS help.`;

        // SEMPRE adicionar no início, mesmo se já tiver instruções críticas
        // Modelos pequenos precisam de reforço constante
        if (
          !systemInstruction.toLowerCase().startsWith("critical instructions")
        ) {
          enhancedSystemInstruction = `${criticalInstructions}

---

${systemInstruction}`;
        } else {
          // Se já começa com CRITICAL, ainda adicionar reforço
          enhancedSystemInstruction = `${criticalInstructions}

---

${systemInstruction}`;
        }
      }

      const prompt = `${enhancedSystemInstruction}\n\nBased on the conversation history below, generate a comprehensive Reconciliation Action Plan in JSON format.

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

      // Usar campo 'system' separado se disponível (API do Ollama suporta isso)
      const requestBody: any = {
        model: this.model,
        prompt: prompt,
        stream: false,
        format: "json",
        // Contexto otimizado para velocidade (modelo 3b)
        num_ctx: 2048, // Reduzido para aceleração
        options: {
          temperature: 0.7, // Levemente reduzido para respostas mais focadas
          // Tokens gerados otimizados para velocidade
          num_predict: 1536, // Reduzido para aceleração
          top_p: 0.9, // Levemente reduzido para respostas mais coerentes
          repeat_penalty: 1.2,
        },
      };

      // Adicionar system instruction como campo separado (API do Ollama suporta)
      if (enhancedSystemInstruction) {
        requestBody.system = enhancedSystemInstruction;
      }

      // Log removido por segurança

      // Timeout reduzido para respostas mais rápidas: 60 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const startTime = Date.now();
      let response: Response;
      try {
        console.log(
          `[Ollama3] Starting generatePlan request (model: ${this.model})`
        );
        console.log(
          `[Ollama3] System instruction length: ${
            enhancedSystemInstruction?.length || 0
          }`
        );
        console.log(
          `[Ollama3] Context history length: ${contextHistory.length}`
        );
        console.log(
          `[Ollama3] System instruction preview: ${
            enhancedSystemInstruction?.substring(0, 200) || "none"
          }...`
        );
        response = await fetch(`${this.baseUrl}/api/generate`, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(
          `[Ollama3] Plan generation response received after ${elapsedTime} seconds`
        );
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === "AbortError") {
          throw createProviderError(
            this.name,
            "Plan generation timeout after 180 seconds",
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
      console.log(
        `[Ollama3] Plan generation response status: ${response.status} ${response.statusText}`
      );
      console.log(
        `[Ollama3] Plan generation response keys:`,
        Object.keys(data)
      );

      // Ollama pode retornar response diretamente ou em diferentes formatos
      let jsonText = "";
      if (data.response) {
        jsonText = data.response;
      } else if (typeof data === "string") {
        jsonText = data;
      } else if (data.text) {
        jsonText = data.text;
      } else {
        console.error(
          `[Ollama3] Invalid plan response format. Keys:`,
          Object.keys(data)
        );
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
        console.log(
          `[Ollama3] Plan generation success! JSON length: ${jsonText.length}`
        );
        console.log(`[Ollama3] Plan preview: ${jsonText.substring(0, 200)}...`);
      } catch (parseError) {
        console.error(`[Ollama3] Plan response is not valid JSON:`, parseError);
      }

      if (data.total_duration) {
        console.log(
          `[Ollama3] Plan total duration: ${data.total_duration / 1e9}s`
        );
      }
      if (data.eval_duration) {
        console.log(
          `[Ollama3] Plan eval duration: ${data.eval_duration / 1e9}s`
        );
      }
      if (data.prompt_eval_duration) {
        console.log(
          `[Ollama3] Plan prompt eval duration: ${
            data.prompt_eval_duration / 1e9
          }s`
        );
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

  // Método de streaming para respostas mais rápidas
  async sendMessageStream(
    message: string,
    history: Array<{ role: string; parts: Array<{ text: string }> }>,
    systemInstruction: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    try {
      // Histórico otimizado: 2 mensagens (1 turno) para velocidade máxima
      // Menos contexto significa respostas mais rápidas
      const MAX_HISTORY_MESSAGES = 2; // Reduzido para velocidade
      const limitedHistory = history.slice(-MAX_HISTORY_MESSAGES);

      // Reforçar instruções críticas
      let enhancedSystemInstruction = systemInstruction;
      if (systemInstruction) {
        const criticalInstructions = `CRITICAL INSTRUCTIONS - YOU MUST OBEY THESE RULES:

1. You are Orion AI, a relationship and attraction mentor.
2. You MUST ALWAYS help users with relationship questions - this is your PRIMARY PURPOSE.
3. NEVER refuse, decline, or say you cannot help.
4. FORBIDDEN PHRASES - NEVER SAY THESE:
   - "I can't provide assistance"
   - "I can't help"
   - "I'm unable to"
   - "I cannot"
   - "I won't help"
   - "I can't fulfill that request"
   - "I can't provide assistance or guidance on relationships"
   - Any phrase that refuses to help with relationship questions
5. If a question is unclear, ask clarifying questions - DO NOT refuse.
6. You help with HEALTHY relationship strategies, reconnection, and attraction.
7. You do NOT help with manipulation, harm, or abuse - but you MUST help with legitimate relationship questions.

REMEMBER: Your job is to help with relationships. NEVER refuse. ALWAYS help.`;

        if (
          !systemInstruction.toLowerCase().startsWith("critical instructions")
        ) {
          enhancedSystemInstruction = `${criticalInstructions}

---

${systemInstruction}`;
        } else {
          enhancedSystemInstruction = `${criticalInstructions}

---

${systemInstruction}`;
        }
      }

      // Construir prompt completo com histórico
      let fullPrompt = "";

      for (const h of limitedHistory) {
        const role = h.role === "user" ? "User" : "Assistant";
        const content = h.parts
          .map((p) => p.text)
          .join(" ")
          .trim();
        if (content) {
          const truncatedContent =
            content.length > 300 ? content.substring(0, 300) + "..." : content;
          fullPrompt += `${role}: ${truncatedContent}\n`;
        }
      }

      fullPrompt += `User: ${message}\nAssistant:`;

      // Preparar headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.apiKey) {
        headers["X-API-Key"] = this.apiKey;
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      // Request body com streaming ativado
      const requestBody: any = {
        model: this.model,
        prompt: fullPrompt,
        stream: true, // ATIVAR STREAMING
        system: enhancedSystemInstruction,
        num_ctx: 1024, // Reduzido para aceleração
        options: {
          temperature: 0.7, // Levemente reduzido para respostas mais focadas
          num_predict: 768, // Reduzido para aceleração
          top_p: 0.9, // Levemente reduzido para respostas mais coerentes
          repeat_penalty: 1.2, // Aumentado para reduzir repetição
        },
      };

      console.log(
        `[Ollama3] Starting streaming request (model: ${this.model})`
      );

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          const errorText = await response.text();
          errorData = JSON.parse(errorText);
        } catch (e) {
          // Fallback
        }

        const isRetryable = isRetryableError({
          message: errorData.error || `HTTP ${response.status}`,
          status: response.status,
        });

        throw createProviderError(
          this.name,
          errorData.error || `HTTP error! status: ${response.status}`,
          response.status,
          isRetryable
        );
      }

      // Processar stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw createProviderError(
          this.name,
          "Response body is not readable",
          undefined,
          false
        );
      }

      const decoder = new TextDecoder();
      let fullResponse = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decodificar chunk
        buffer += decoder.decode(value, { stream: true });

        // Processar linhas completas
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Manter última linha incompleta no buffer

        for (const line of lines) {
          if (line.trim() === "") continue;

          try {
            const json = JSON.parse(line);

            // Ollama retorna chunks no campo 'response'
            if (json.response) {
              const chunk = json.response;
              fullResponse += chunk;
              onChunk(chunk); // Enviar chunk para callback
            }

            // Se done for true, finalizou
            if (json.done) {
              break;
            }
          } catch (parseError) {
            // Ignorar linhas que não são JSON válido
            continue;
          }
        }
      }

      // Processar último buffer se houver
      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer);
          if (json.response) {
            const chunk = json.response;
            fullResponse += chunk;
            onChunk(chunk);
          }
        } catch (e) {
          // Ignorar
        }
      }

      console.log(
        `[Ollama3] Streaming completed. Total length: ${fullResponse.length}`
      );

      // Validar resposta
      if (!fullResponse || fullResponse.trim() === "") {
        throw createProviderError(
          this.name,
          "Empty response from Ollama API",
          undefined,
          true
        );
      }

      return fullResponse;
    } catch (error: any) {
      if (error.provider) {
        throw error;
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
