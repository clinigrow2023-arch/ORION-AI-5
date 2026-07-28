/** Must match server-side Ollama history window (pairs of user+assistant turns). */
export const MAX_HISTORY_MESSAGES = 8;

/** Cap DB/cached system prompt size sent to Ollama (tokens) */
export const MAX_SYSTEM_PROMPT_CHARS = 2400;

/** Chat generation cap — lower = faster replies (~30s target on CPU 3B) */
export const CHAT_NUM_PREDICT = 300;

/** Action plan — smaller JSON, faster on CPU (override: OLLAMA_PLAN_NUM_PREDICT on server) */
export const PLAN_NUM_PREDICT = 400;
