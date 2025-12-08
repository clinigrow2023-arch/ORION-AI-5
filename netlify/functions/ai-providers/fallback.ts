import { AIProvider, AIProviderError } from "./base";
import { GeminiProvider } from "./gemini";
import { GrokProvider } from "./grok";
import { GroqProvider } from "./groq";
import { OpenAIProvider } from "./openai";
import { DeepSeekProvider } from "./deepseek";
import { LaozangProvider } from "./laozang";

// System instruction for Orion
const getSystemInstruction = (): string => {
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
};

// Create providers based on available API keys
export function createProviders(): AIProvider[] {
  const providers: AIProvider[] = [];

  // 1. Gemini (primary)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      providers.push(new GeminiProvider(geminiKey));
    } catch (error) {
      console.warn("⚠️ Failed to initialize Gemini provider:", error);
    }
  }

  // 2. Grok (fallback)
  const grokKey = process.env.GROK_API_KEY;
  if (grokKey) {
    try {
      providers.push(new GrokProvider(grokKey));
    } catch (error) {
      console.warn("⚠️ Failed to initialize Grok provider:", error);
    }
  }

  // 3. Groq (fallback)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      providers.push(new GroqProvider(groqKey));
    } catch (error) {
      console.warn("⚠️ Failed to initialize Groq provider:", error);
    }
  }

  // 4. OpenAI (fallback)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      providers.push(new OpenAIProvider(openaiKey));
    } catch (error) {
      console.warn("⚠️ Failed to initialize OpenAI provider:", error);
    }
  }

  // 5. Deep Seek (fallback)
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    try {
      providers.push(new DeepSeekProvider(deepseekKey));
    } catch (error) {
      console.warn("⚠️ Failed to initialize Deep Seek provider:", error);
    }
  }

  // 6. Laozang (fallback)
  const laozangKey = process.env.LAOZANG_API_KEY;
  if (laozangKey) {
    try {
      providers.push(new LaozangProvider(laozangKey));
    } catch (error) {
      console.warn("⚠️ Failed to initialize Laozang provider:", error);
    }
  }
  // Example:
  // const openaiKey = process.env.OPENAI_API_KEY;
  // if (openaiKey) {
  //   providers.push(new OpenAIProvider(openaiKey));
  // }

  if (providers.length === 0) {
    throw new Error(
      "No AI providers available. Please configure at least one API key."
    );
  }

  return providers;
}

// Try providers in sequence until one succeeds
export async function tryProviders<T>(
  providers: AIProvider[],
  operation: (provider: AIProvider) => Promise<T>,
  operationName: string = "operation"
): Promise<{ result: T; provider: string }> {
  const errors: Array<{ provider: string; error: any }> = [];

  for (const provider of providers) {
    try {
      console.log(`🔄 Trying ${provider.name} for ${operationName}...`);
      const result = await operation(provider);
      console.log(`✅ ${provider.name} succeeded for ${operationName}`);
      return { result, provider: provider.name };
    } catch (error: any) {
      const providerError = error as AIProviderError;
      // Se o erro já tem a propriedade retryable definida, usar ela
      // Caso contrário, assumir que é retryable (para continuar o fallback)
      const isRetryable = providerError.retryable !== false;

      console.warn(
        `❌ ${provider.name} failed for ${operationName}:`,
        error.message || error
      );

      errors.push({ provider: provider.name, error });

      // If error is not retryable (e.g., invalid API key), don't try other providers
      // Mas só parar se for claramente um erro de autenticação
      if (!isRetryable) {
        const errorMessage = (error?.message || "").toLowerCase();
        const isAuthError = 
          errorMessage.includes("invalid api key") ||
          errorMessage.includes("unauthorized") ||
          errorMessage.includes("authentication failed") ||
          errorMessage.includes("invalid authentication");
        
        // Se não for erro de autenticação, continuar tentando outros providers
        if (!isAuthError) {
          console.warn(
            `⚠️ ${provider.name} error marked as not retryable but doesn't look like auth error, continuing fallback...`
          );
          continue;
        }
        
        console.error(
          `🚫 ${provider.name} error is not retryable (auth error), stopping fallback chain`
        );
        throw error;
      }

      // Continue to next provider
      continue;
    }
  }

  // All providers failed
  const errorMessages = errors
    .map((e) => `${e.provider}: ${e.error?.message || e.error || "Unknown error"}`)
    .join("; ");
  throw new Error(
    `All AI providers failed for ${operationName}. Errors: ${errorMessages}`
  );
}

// Send message with fallback
export async function sendMessageWithFallback(
  message: string,
  history: Array<{ role: string; parts: Array<{ text: string }> }>
): Promise<{ response: string; provider: string }> {
  const providers = createProviders();
  const systemInstruction = getSystemInstruction();

  return tryProviders(
    providers,
    async (provider) =>
      await provider.sendMessage(message, history, systemInstruction),
    "sendMessage"
  );
}

// Generate plan with fallback
export async function generatePlanWithFallback(
  contextHistory: string
): Promise<{ response: string; provider: string }> {
  const providers = createProviders();
  const systemInstruction = getSystemInstruction();

  return tryProviders(
    providers,
    async (provider) =>
      await provider.generatePlan(contextHistory, systemInstruction),
    "generatePlan"
  );
}
