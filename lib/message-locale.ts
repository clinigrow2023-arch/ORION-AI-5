import { scoreSupportedLocales } from "./language-guard.js";
import {
  DEFAULT_LOCALE,
  normalizeLocale,
  type Locale,
} from "./locale.js";
import {
  resolveRequestLocale,
  type LocaleRequest,
} from "./server-locale.js";

export type ChatTurn = {
  role: string;
  parts: Array<{ text: string }>;
};

function textFromTurn(turn: ChatTurn): string {
  return turn.parts
    .map((part) => part.text)
    .join(" ")
    .trim();
}

function pickLocale(en: number, fr: number): Locale | null {
  if (en > fr) return "en";
  if (fr > en) return "fr";
  return null;
}

/**
 * Detects EN vs FR from the current message and recent user turns.
 * Falls back when the signal is ambiguous (e.g. "ok", "yes").
 */
export function detectMessageLocale(
  message: string,
  options?: {
    history?: ChatTurn[];
    fallback?: Locale;
  }
): Locale {
  const fallback = options?.fallback ?? DEFAULT_LOCALE;
  const current = scoreSupportedLocales(message);
  const direct = pickLocale(current.en, current.fr);
  if (direct) {
    return direct;
  }

  let en = current.en * 3;
  let fr = current.fr * 3;

  const recentUserTexts = (options?.history ?? [])
    .filter((turn) => turn.role === "user")
    .map(textFromTurn)
    .filter(Boolean)
    .reverse()
    .slice(0, 8);

  for (const text of recentUserTexts) {
    const score = scoreSupportedLocales(text);
    en += score.en;
    fr += score.fr;
  }

  return pickLocale(en, fr) ?? fallback;
}

/**
 * Chat replies follow the language the user is writing in, not the stored
 * account preference. UI locale is the tie-breaker for short/ambiguous text.
 */
export function resolveChatReplyLocale(
  message: string,
  history: ChatTurn[],
  req: LocaleRequest
): Locale {
  return detectMessageLocale(message, {
    history,
    fallback: resolveRequestLocale(req),
  });
}

/**
 * Plans and other long-form content follow the conversation language.
 */
export function resolveContentLocaleFromText(
  text: string,
  req: LocaleRequest,
  storedLocale?: string | null
): Locale {
  const uiLocale = resolveRequestLocale(req);
  const accountLocale = storedLocale
    ? normalizeLocale(storedLocale, uiLocale)
    : uiLocale;

  const trimmed = text.trim();
  if (!trimmed) {
    return accountLocale;
  }

  return detectMessageLocale(trimmed, {
    fallback: uiLocale,
  });
}
