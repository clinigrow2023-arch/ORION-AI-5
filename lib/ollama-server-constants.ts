/** Server-only (Node). Do not import from client code — uses process.env. */

export const PLAN_TIMEOUT_MS =
  Number(process.env.OLLAMA_PLAN_TIMEOUT_MS) || 180_000;

export const CHAT_TIMEOUT_MS =
  Number(process.env.OLLAMA_CHAT_TIMEOUT_MS) || 120_000;

/** Max tokens for plan JSON — 1B models need more headroom to finish JSON */
export const PLAN_NUM_PREDICT =
  Number(process.env.OLLAMA_PLAN_NUM_PREDICT) || 750;
