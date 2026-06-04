import { MAX_HISTORY_MESSAGES } from "../../lib/chat-constants.js";

export { MAX_HISTORY_MESSAGES };
export const MAX_MESSAGE_LENGTH = 300;
export const MAX_PLAN_CONTEXT_CHARS = 6000;

const CRITICAL_BLOCK = `CRITICAL INSTRUCTIONS - YOU MUST OBEY THESE RULES:

1. You are Orion AI, a relationship and attraction mentor.
2. You MUST ALWAYS help users with relationship questions - this is your PRIMARY PURPOSE.
3. NEVER refuse, decline, or say you cannot help.
4. FORBIDDEN PHRASES - NEVER SAY THESE:
   - "I can't provide assistance"
   - "I can't help"
   - "I'm unable to"
   - "I cannot"
   - "I won't help"
5. If a question is unclear, ask clarifying questions - DO NOT refuse.
6. You help with HEALTHY relationship strategies, reconnection, and attraction.

REMEMBER: Your job is to help with relationships. NEVER refuse. ALWAYS help.`;

export function enhanceSystemInstruction(systemInstruction: string): string {
  if (!systemInstruction?.trim()) {
    return CRITICAL_BLOCK;
  }

  const lower = systemInstruction.toLowerCase();
  if (lower.includes("never refuse") && lower.includes("you are orion")) {
    return systemInstruction;
  }

  if (!lower.includes("you are orion")) {
    return `You are Orion AI, an expert relationship and attraction mentor.\n\n${systemInstruction}`;
  }

  return `${CRITICAL_BLOCK}\n\n---\n\n${systemInstruction}`;
}

export function limitHistory<T extends { parts: Array<{ text: string }> }>(
  history: T[],
  maxMessages = MAX_HISTORY_MESSAGES
): T[] {
  return history.slice(-maxMessages);
}

export function buildConversationPrompt(
  message: string,
  history: Array<{ role: string; parts: Array<{ text: string }> }>
): string {
  const limitedHistory = limitHistory(history);
  let fullPrompt = "";

  for (const h of limitedHistory) {
    const role = h.role === "user" ? "User" : "Assistant";
    let content = h.parts
      .map((p) => p.text)
      .join(" ")
      .trim();
    if (!content) continue;
    if (content.length > MAX_MESSAGE_LENGTH) {
      content = content.substring(0, MAX_MESSAGE_LENGTH) + "...";
    }
    fullPrompt += `${role}: ${content}\n`;
  }

  fullPrompt += `User: ${message}\nAssistant:`;
  return fullPrompt;
}

export function truncatePlanContext(contextHistory: string): string {
  if (contextHistory.length <= MAX_PLAN_CONTEXT_CHARS) {
    return contextHistory;
  }
  return (
    contextHistory.substring(contextHistory.length - MAX_PLAN_CONTEXT_CHARS) +
    "\n\n[Earlier conversation truncated for performance]"
  );
}

export function getOllamaAuthHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  return headers;
}
