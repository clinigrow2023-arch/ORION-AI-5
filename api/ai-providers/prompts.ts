import { prisma } from "../_prisma.js";
import { enhanceSystemInstruction } from "./ollama-helpers.js";

let cachedPrompt: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

const EMERGENCY_PROMPT = `You are Orion AI, an expert relationship and attraction mentor.

CRITICAL INSTRUCTIONS:
- You MUST always help users with relationship and attraction questions.
- NEVER refuse, decline, or say you cannot help.
- Use short paragraphs. Write like a modern chat assistant.
- Ask diagnostic questions before giving strategy when context is missing.`;

export async function getSystemInstruction(): Promise<string> {
  const now = Date.now();
  if (cachedPrompt && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedPrompt;
  }

  try {
    const systemPrompt = await prisma.systemPrompt.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    if (systemPrompt?.prompt?.trim()) {
      cachedPrompt = enhanceSystemInstruction(systemPrompt.prompt.trim());
      cacheTimestamp = now;
      return cachedPrompt;
    }
  } catch {
    cachedPrompt = null;
    cacheTimestamp = 0;
  }

  cachedPrompt = enhanceSystemInstruction(EMERGENCY_PROMPT);
  cacheTimestamp = now;
  return cachedPrompt;
}

export function clearPromptCache(): void {
  cachedPrompt = null;
  cacheTimestamp = 0;
}
