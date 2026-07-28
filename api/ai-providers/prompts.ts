import { DEFAULT_LOCALE, type Locale } from "../../lib/locale.js";

/**
 * Chat system prompt: when OLLAMA_USE_MODELFILE=1, prompt lives in Ollama Modelfile only.
 *
 * The Modelfile prompt is English and baked into the model, so the answer
 * language never comes from here — it is injected per request by
 * `buildConversationPrompt`, which also keeps the Modelfile `SYSTEM` intact.
 */
export function useOllamaModelfile(): boolean {
  const v = process.env.OLLAMA_USE_MODELFILE;
  return v === "1" || v === "true" || v === "yes";
}

/** Empty = do not send `system` on /api/generate (use model template). */
export async function getSystemInstruction(
  locale: Locale = DEFAULT_LOCALE
): Promise<string> {
  if (useOllamaModelfile()) {
    return "";
  }

  const { getLegacySystemInstruction } = await import("./prompts-legacy.js");
  return getLegacySystemInstruction(locale);
}

export function clearPromptCache(): void {
  if (!useOllamaModelfile()) {
    import("./prompts-legacy.js").then((m) => m.clearLegacyPromptCache());
  }
}
