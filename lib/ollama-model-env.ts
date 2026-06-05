/** Resolve Ollama model names from env (server-only). */

export function resolveOllamaChatModel(): string {
  return process.env.OLLAMA_MODEL || "llama3.2:1b";
}

export function resolveOllamaPlanModel(): string {
  return (
    process.env.OLLAMA_PLAN_MODEL ||
    process.env.OLLAMA_MODEL ||
    process.env.OLLAMA_BASE_MODEL ||
    "llama3.2:1b"
  );
}

/** True if `installed` from GET /api/tags includes the configured model name. */
export function ollamaHasModel(
  installed: string[],
  configured: string
): boolean {
  const base = configured.split(":")[0];
  return installed.some(
    (name) =>
      name === configured ||
      name.startsWith(`${configured}:`) ||
      name.split(":")[0] === base
  );
}
