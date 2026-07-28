import { prisma } from "../_prisma.js";
import { enhanceSystemInstruction } from "./ollama-helpers.js";
import { DEFAULT_LOCALE, type Locale } from "../../lib/locale.js";

type CacheEntry = { prompt: string; timestamp: number };

const cache = new Map<Locale, CacheEntry>();
const CACHE_TTL_MS = 30_000;

const EMERGENCY_PROMPT = `You are Orion AI, an expert relationship and attraction mentor.

CRITICAL INSTRUCTIONS:
- You MUST always help users with relationship and attraction questions.
- NEVER refuse, decline, or say you cannot help.
- Use short paragraphs. Write like a modern chat assistant.
- Ask diagnostic questions before giving strategy when context is missing.`;

/**
 * Records saved before i18n have no `locale`, so an English lookup must also
 * accept `null` — otherwise an existing prompt would silently stop being used.
 */
function localeFilter(locale: Locale) {
  return locale === DEFAULT_LOCALE
    ? { OR: [{ locale: DEFAULT_LOCALE }, { locale: null }] }
    : { locale };
}

async function findStoredPrompt(locale: Locale): Promise<string | null> {
  const forLocale = await prisma.systemPrompt.findFirst({
    where: localeFilter(locale),
    orderBy: { updatedAt: "desc" },
  });

  if (forLocale?.prompt?.trim()) {
    return forLocale.prompt.trim();
  }

  if (locale === DEFAULT_LOCALE) {
    return null;
  }

  // Sem versão no idioma pedido, o prompt inglês vale: a diretiva de idioma
  // injetada no prompt do usuário garante a resposta no idioma certo.
  const fallback = await prisma.systemPrompt.findFirst({
    where: localeFilter(DEFAULT_LOCALE),
    orderBy: { updatedAt: "desc" },
  });

  return fallback?.prompt?.trim() || null;
}

export async function getLegacySystemInstruction(
  locale: Locale = DEFAULT_LOCALE
): Promise<string> {
  const now = Date.now();
  const cached = cache.get(locale);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.prompt;
  }

  let prompt: string;
  try {
    const stored = await findStoredPrompt(locale);
    prompt = enhanceSystemInstruction(stored || EMERGENCY_PROMPT);
  } catch {
    // Banco indisponível: responder com o prompt mínimo e não cachear, para a
    // próxima requisição tentar de novo.
    cache.delete(locale);
    return enhanceSystemInstruction(EMERGENCY_PROMPT);
  }

  cache.set(locale, { prompt, timestamp: now });
  return prompt;
}

export function clearLegacyPromptCache(): void {
  cache.clear();
}
