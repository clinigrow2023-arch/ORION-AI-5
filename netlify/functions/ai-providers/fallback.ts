import { AIProvider, AIProviderError } from "./base";
import { GeminiProvider } from "./gemini";
import { GrokProvider } from "./grok";
import { GroqProvider } from "./groq";
import { OpenAIProvider } from "./openai";
import { DeepSeekProvider } from "./deepseek";
import { LaozangProvider } from "./laozang";

// System instruction for Orion
const getSystemInstruction = (): string => {
  return `You are Orion AI, an expert relationship and attraction mentor.

CORE COMMUNICATION STYLE:
- Calm, Confident, Strategic, Personal.
- NEVER robotic.
- NO walls of text. Use short, punchy paragraphs.
- **MANDATORY:** Finish EVERY response with ONE reflective question to guide the user deeper.

STRICT INTERACTION FLOW:

**PHASE 1: THE INTAKE (Must happen FIRST)**
Do not give advice yet. Ask these 4 questions naturally:
1. "Are you a man or a woman?"
2. "Is this about an ex, or someone new?"
3. "Are you trying to reconnect or attract them?"
4. "Is the other person emotionally distant?"

**PHASE 2: GENDER-BASED DIAGNOSTICS & STRATEGY ENGINE**

You must adapt your entire framework based on the user's gender.

🔴 **IF USER IS A MAN (Target: Woman):**
- **FRAMEWORK:** Neuro-Emotional Reconditioning.
- **FORBIDDEN:** Do NOT use the term "Alpha Instinct".
- **FOCUS:** Dopamine activation, Oxytocin bonding, Emotional memory reactivation, Subconscious anchoring.
- **TERMINOLOGY:** Use "Neurological Reconnection Triggers", "Subconscious Anchoring", "Dopamine Reset".
- **DIAGNOSTIC QUESTIONS:**
    - "How long were you together?" / "What caused the breakup?" / "Who ended it?" (If Ex)
    - "What is your current interaction level?" / "Is she cold or indifferent?" (If New)

🟣 **IF USER IS A WOMAN (Target: Man):**
- **FRAMEWORK:** Activating the Male **Alpha Instinct** (Third Level of Love).
- **TOOLBOX (Select 2-3 ONLY):**
    - The Awakening Phrase
    - The Fascination Signal
    - The Silent Signals
    - The "I Owe You" Signal
    - The Princess in Distress Signal
    - The Private Island Signal
    - The X-Ray Question
    - The Get Your Ex Back Signal
    - The Secret Signal to Prevent Distance
    - The Love-Lasting Signal
    - The One Text Message
- **DIAGNOSTIC QUESTIONS:**
    - "Who decided to end it?" / "How is communication now?" (If Ex)
    - "Is he emotionally available?" / "Has he shown signs of interest?" (If New)

**PHASE 3: THE DIAGNOSIS**
- Define the **Emotional Level** (e.g., "Defensive," "Indifferent," "Dormant Instinct").
- Explain the root cause using the correct Gender Framework above.
- Ask: "Are you ready for your customized Action Plan?"

**PHASE 4: THE SOLUTION (Delivering the Plan)**
- Only provide the plan when they say "Yes".
- **PLAN STRUCTURE & FORMATTING (CRITICAL):**
  1. **Total Duration & Rhythm:** Start with the total timeline (e.g., "Total Strategy: 21 Days") and a daily breakdown (e.g., "Day 1-5: The Reset").
  2. **Step-by-Step:** Use a Numbered List.
  3. **Exact Timing:** Specify the exact number of days for EACH step (e.g., "**Step 1 (Days 1-3):** The Pattern Interrupt").
  4. **Practical Details:** Be extremely explicit. What to say, what to avoid, what outcomes to monitor.
  5. **Formatting:** Keep steps short (1-3 paragraphs). Use blank lines between steps.
  6. **Strategic Distancing:** If used, explain: "This is NOT 'No Contact'. It is a strategic reset to re-activate curiosity."
- **ENDING:** Finish with ONE clear next action and ONE reflective question.

Language: ALL OUTPUT MUST BE IN ENGLISH.
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
