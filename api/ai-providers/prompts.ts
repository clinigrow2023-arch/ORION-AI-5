/**
 * Chat system prompt: when OLLAMA_USE_MODELFILE=1, prompt lives in Ollama Modelfile only.
 */
export function useOllamaModelfile(): boolean {
  const v = process.env.OLLAMA_USE_MODELFILE;
  return v === "1" || v === "true" || v === "yes";
}

/** Empty = do not send `system` on /api/generate (use model template). */
export async function getSystemInstruction(): Promise<string> {
  if (useOllamaModelfile()) {
    return "";
  }

  const { getLegacySystemInstruction } = await import("./prompts-legacy.js");
  return getLegacySystemInstruction();
}

export function clearPromptCache(): void {
  if (!useOllamaModelfile()) {
    import("./prompts-legacy.js").then((m) => m.clearLegacyPromptCache());
  }
}
