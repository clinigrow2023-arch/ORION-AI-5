/**
 * Locale primitives shared by the browser bundle and the serverless API.
 *
 * This module intentionally has no dependencies (no message catalogs, no DOM,
 * no Node APIs) so both `components/*` and `api/*` can import it safely.
 */

export const SUPPORTED_LOCALES = ["en", "fr"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** localStorage key holding the language explicitly chosen by the user. */
export const LOCALE_STORAGE_KEY = "orion_locale";

/** Request header used by the client to advertise its active language. */
export const LOCALE_HEADER = "x-locale";

export interface LocaleDescriptor {
  /** Short badge rendered inside the language selector. */
  shortCode: string;
  /** Language name written in the language itself. */
  nativeName: string;
  /** BCP 47 tag used for `Intl` formatting. */
  intlTag: string;
  /** Language name injected into AI instructions. */
  aiName: string;
}

export const LOCALES: Record<Locale, LocaleDescriptor> = {
  en: {
    shortCode: "EN",
    nativeName: "English",
    intlTag: "en-US",
    aiName: "English",
  },
  fr: {
    shortCode: "FR",
    nativeName: "Français",
    intlTag: "fr-FR",
    aiName: "French (français)",
  },
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Turns any user/browser/database value into a supported locale.
 * Accepts region variants and legacy `null` columns (`"fr-CA"` -> `"fr"`).
 */
export function normalizeLocale(
  value: unknown,
  fallback: Locale = DEFAULT_LOCALE
): Locale {
  if (typeof value !== "string") {
    return fallback;
  }

  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : fallback;
}

/**
 * Hard language constraint appended to every system instruction so the answer
 * language never depends on the (admin-editable) prompt content.
 *
 * Written in English on purpose: it is an internal instruction, and mixing the
 * target language into it makes small models echo it back to the user.
 */
export function buildLanguageDirective(locale: Locale): string {
  const { aiName } = LOCALES[locale];

  return `LANGUAGE REQUIREMENT (ABSOLUTE PRIORITY - OVERRIDES EVERYTHING ELSE):
- You MUST write 100% of your output in ${aiName}, including greetings, questions, examples and the ready-to-send message templates.
- Ignore the language of these instructions: they are internal and must never change your output language.
- Even if the user writes in another language, keep answering in ${aiName}.
- Never mix languages and never translate your answer into a second language.
- Use natural, fluent, native-level ${aiName}.`;
}

/** Language line injected into the structured action-plan prompt. */
export function buildPlanLanguageRequirement(locale: Locale): string {
  const { aiName } = LOCALES[locale];

  return `LANGUAGE: Every string value in the JSON MUST be written in ${aiName} (native level). The JSON keys MUST stay exactly as specified in English.`;
}

/** Picks the highest-quality supported locale from an `Accept-Language` header. */
export function parseAcceptLanguage(
  header: string | undefined | null,
  fallback: Locale = DEFAULT_LOCALE
): Locale {
  if (!header) {
    return fallback;
  }

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.split(";");
      const qualityParam = params.find((param) =>
        param.trim().toLowerCase().startsWith("q=")
      );
      const quality = qualityParam
        ? Number.parseFloat(qualityParam.trim().slice(2))
        : 1;

      return {
        tag: tag.trim(),
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((entry) => entry.tag.length > 0 && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const entry of ranked) {
    const base = entry.tag.toLowerCase().split(/[-_]/)[0];
    if (isLocale(base)) {
      return base;
    }
  }

  return fallback;
}
