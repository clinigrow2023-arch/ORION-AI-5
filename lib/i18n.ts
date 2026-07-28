import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_STORAGE_KEY,
  isLocale,
  type Locale,
} from "./locale";
import { messagesEn } from "./messages-en";
import { messagesFr } from "./messages-fr";

/** Structural shape every catalog must satisfy (leaves are plain strings). */
export type MessageCatalog = typeof messagesEn;

type DotPath<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : `${K}.${DotPath<T[K]>}`;
}[keyof T & string];

/** Union of every valid translation key, e.g. `"chat.header.title"`. */
export type MessageKey = DotPath<MessageCatalog>;

export type MessageVars = Record<string, string | number>;

const CATALOGS: Record<Locale, MessageCatalog> = {
  en: messagesEn,
  fr: messagesFr,
};

function resolvePath(catalog: MessageCatalog, key: string): string | undefined {
  let current: unknown = catalog;

  for (const segment of key.split(".")) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Resolves a translation key. Falls back to English and finally to the key
 * itself, so a missing entry degrades gracefully instead of rendering blank.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: MessageVars
): string {
  const template =
    resolvePath(CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE], key) ??
    resolvePath(CATALOGS[DEFAULT_LOCALE], key);

  return template === undefined ? key : interpolate(template, vars);
}

/* -------------------------------------------------------------------------- */
/* Active locale (readable outside React, e.g. by the API client)             */
/* -------------------------------------------------------------------------- */

let activeLocale: Locale = DEFAULT_LOCALE;

export function setActiveLocale(locale: Locale): void {
  activeLocale = locale;
}

export function getActiveLocale(): Locale {
  return activeLocale;
}

/**
 * Translates using the active locale, for code that runs outside React
 * (service layer, fetch wrappers). Components must use `useI18n().t` instead so
 * they re-render when the language changes.
 */
export function translateActive(key: MessageKey, vars?: MessageVars): string {
  return translate(activeLocale, key, vars);
}

/* -------------------------------------------------------------------------- */
/* Persistence & detection                                                    */
/* -------------------------------------------------------------------------- */

/** Language explicitly chosen by the user on this device, if any. */
export function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: Locale): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Private browsing / disabled storage: the in-memory locale still applies.
  }
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") {
    return DEFAULT_LOCALE;
  }

  const candidates = [
    ...(navigator.languages ?? []),
    navigator.language,
  ].filter((value): value is string => typeof value === "string");

  for (const candidate of candidates) {
    const base = candidate.trim().toLowerCase().split(/[-_]/)[0];
    if (isLocale(base)) {
      return base;
    }
  }

  return DEFAULT_LOCALE;
}

/** Locale to start the app with: explicit choice first, browser language next. */
export function resolveInitialLocale(): Locale {
  return readStoredLocale() ?? detectBrowserLocale();
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

function toDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: Date | string | number, locale: Locale): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString(LOCALES[locale].intlTag) : "";
}

export function formatTime(value: Date | string | number, locale: Locale): string {
  const date = toDate(value);
  return date ? date.toLocaleTimeString(LOCALES[locale].intlTag) : "";
}

/** Hour and minute only, used for chat message timestamps. */
export function formatShortTime(
  value: Date | string | number,
  locale: Locale
): string {
  const date = toDate(value);
  return date
    ? date.toLocaleTimeString(LOCALES[locale].intlTag, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
}

export function formatDateTime(
  value: Date | string | number,
  locale: Locale
): string {
  const date = toDate(value);
  return date ? date.toLocaleString(LOCALES[locale].intlTag) : "";
}
