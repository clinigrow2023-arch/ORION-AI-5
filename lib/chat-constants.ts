/** Must match server-side Ollama history window */
export const MAX_HISTORY_MESSAGES = 2;

/** Cap DB/cached system prompt size sent to Ollama (tokens) */
export const MAX_SYSTEM_PROMPT_CHARS = 2400;

/** Chat generation cap — lower = faster replies */
export const CHAT_NUM_PREDICT = 384;

/** Action plan generation cap */
export const PLAN_NUM_PREDICT = 768;
