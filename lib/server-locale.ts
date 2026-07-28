import {
  DEFAULT_LOCALE,
  LOCALE_HEADER,
  normalizeLocale,
  parseAcceptLanguage,
  type Locale,
} from "./locale.js";

type HeaderBag = Record<string, string | string[] | undefined>;

interface LocaleRequest {
  headers: HeaderBag;
  query?: Record<string, string | string[] | undefined>;
}

function firstHeaderValue(
  headers: HeaderBag,
  name: string
): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function readQuery(
  query: LocaleRequest["query"],
  key: string
): string | undefined {
  const value = query?.[key];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Language the *response* must be written in, in decreasing priority:
 * `X-Locale` header (sent by `apiFetch` on every call), `?locale=` for plain
 * links, then `Accept-Language`.
 *
 * The request body is deliberately ignored: a `locale` field in the payload is
 * data being saved (the new user's language, the language chosen by the caller)
 * and not the language of the current response.
 *
 * Use this for anything rendered right away by the caller — errors, labels,
 * confirmations — so the text matches the language the UI is displaying.
 */
export function resolveRequestLocale(
  req: LocaleRequest,
  fallback: Locale = DEFAULT_LOCALE
): Locale {
  const explicit =
    firstHeaderValue(req.headers, LOCALE_HEADER) ??
    readQuery(req.query, "locale");

  if (explicit) {
    return normalizeLocale(explicit, fallback);
  }

  return parseAcceptLanguage(
    firstHeaderValue(req.headers, "accept-language"),
    fallback
  );
}

/**
 * Language of *content produced for the account*: AI answers, generated plans
 * and e-mails. The stored preference wins because that content outlives the
 * request that created it — a legacy document without preference falls back to
 * the request headers.
 *
 * Not for response labels and errors: those follow `resolveRequestLocale`, so
 * they always match the language the caller's UI is showing.
 */
export function resolveUserLocale(
  storedLocale: string | null | undefined,
  req: LocaleRequest
): Locale {
  if (storedLocale) {
    return normalizeLocale(storedLocale);
  }
  return resolveRequestLocale(req);
}
