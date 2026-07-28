import { getActiveLocale } from "./i18n";
import { LOCALE_HEADER } from "./locale";

// Helper para detectar plataforma e retornar endpoint correto
export function getApiEndpoint(path: string): string {
  // Sempre usar /api/ (Vercel e desenvolvimento local)
  return `/api/${path}`;
}

export interface ApiFetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  /** Attach the stored bearer token (defaults to true). */
  auth?: boolean;
}

/**
 * Single entry point for API calls: always advertises the active language so
 * the backend can localize errors, AI answers and e-mails, and attaches the
 * bearer token when the caller needs an authenticated endpoint.
 */
export function apiFetch(
  path: string,
  { headers, auth = true, ...init }: ApiFetchOptions = {}
): Promise<Response> {
  const finalHeaders: Record<string, string> = {
    [LOCALE_HEADER]: getActiveLocale(),
    ...headers,
  };

  if (auth && typeof window !== "undefined") {
    const token = window.localStorage.getItem("auth_token");
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    }
  }

  return fetch(getApiEndpoint(path), { ...init, headers: finalHeaders });
}
