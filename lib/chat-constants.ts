/** Must match server-side Ollama history window */
export const MAX_HISTORY_MESSAGES = 2;

/** Cap DB/cached system prompt size sent to Ollama (tokens) */
export const MAX_SYSTEM_PROMPT_CHARS = 2400;

/** Chat generation cap — lower = faster replies */
export const CHAT_NUM_PREDICT = 384;

/** Action plan — smaller JSON, faster on CPU */
export const PLAN_NUM_PREDICT = 480;

/** Plan uses base model (not orion-ai Modelfile) — set OLLAMA_PLAN_MODEL */
export const PLAN_TIMEOUT_MS = 120_000;

/** Chat stream / non-stream HTTP timeout to Ollama */
export const CHAT_TIMEOUT_MS = 120_000;
