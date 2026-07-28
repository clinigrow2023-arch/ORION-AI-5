// Auth service for client-side
import { apiFetch } from "./api-endpoints";
import { translateActive } from "./i18n";
import { normalizeLocale, type Locale } from "./locale";

export interface User {
  id: string;
  name: string;
  email: string;
  /** Preferred language stored on the server (absent on legacy accounts). */
  locale?: Locale;
}

export interface AuthResponse {
  token: string;
  user: User;
}

/**
 * Turns a failed response into a localized `Error`.
 *
 * The API already answers in the caller's language (see `lib/api-messages.ts`),
 * so we surface `error` as-is and only translate transport-level failures,
 * which never reach the handlers.
 */
async function toError(response: Response): Promise<Error> {
  const text = await response.text();

  try {
    const data = JSON.parse(text) as { error?: string };
    if (data.error) {
      return new Error(data.error);
    }
  } catch {
    // Non-JSON body: the request did not reach the API handler.
    if (response.status === 404) {
      return new Error(translateActive("authErrors.serviceUnavailable"));
    }
  }

  return new Error(
    translateActive("authErrors.requestFailed", { status: response.status })
  );
}

/** Network failures (offline, dev server down) share one clear message. */
function isTransportError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? "";
  return message.includes("Failed to fetch") || message.includes("NetworkError");
}

function serviceUnavailable(): Error {
  return new Error(translateActive("authErrors.serviceUnavailable"));
}

export const authService = {
  /**
   * @param locale Language chosen on the device, persisted with the account so
   * server-side e-mails use it.
   */
  async register(
    name: string,
    email: string,
    password: string,
    locale?: Locale
  ): Promise<AuthResponse> {
    try {
      const response = await apiFetch("auth-register", {
        method: "POST",
        auth: false,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, locale }),
      });

      if (!response.ok) {
        throw await toError(response);
      }

      // Login automático após registro
      return this.login(email, password, locale);
    } catch (error: any) {
      if (isTransportError(error)) {
        throw serviceUnavailable();
      }
      throw error;
    }
  },

  async login(
    email: string,
    password: string,
    locale?: Locale
  ): Promise<AuthResponse> {
    try {
      const response = await apiFetch("auth-login", {
        method: "POST",
        auth: false,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, locale }),
      });

      if (!response.ok) {
        throw await toError(response);
      }

      const data = await response.json();

      // Salvar token no localStorage
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      return {
        token: data.token,
        user: data.user,
      };
    } catch (error: any) {
      if (isTransportError(error)) {
        throw serviceUnavailable();
      }
      throw error;
    }
  },

  async verify(): Promise<User | null> {
    const token = localStorage.getItem("auth_token");

    if (!token) {
      return null;
    }

    try {
      const response = await apiFetch("auth-verify", { method: "GET" });

      if (!response.ok) {
        // Se for 404, usar dados do localStorage como fallback
        if (response.status === 404) {
          return this.getUser();
        }

        // Se for 403, verificar se é notActive ou expired (não fazer logout nesses casos)
        if (response.status === 403) {
          try {
            const data = await response.json();
            if (data.notActive || data.expired) {
              // Usuário sem acesso ativo ou expirado - retornar dados do localStorage
              // O AuthContext vai tratar isso e mostrar a tela de espera
              const stored = this.getUser();
              if (stored) {
                return stored;
              }
            }
          } catch {
            // Se não conseguir fazer parse, continuar com logout
          }
        }

        // Para outros erros (401, 500, etc), fazer logout
        this.logout();
        return null;
      }

      const data = await response.json();
      return data.user;
    } catch (error) {
      // Em dev, se a function não estiver disponível, usar dados do localStorage
      const stored = this.getUser();
      if (stored) {
        return stored;
      }
      this.logout();
      return null;
    }
  },

  logout(): void {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
  },

  getToken(): string | null {
    return localStorage.getItem("auth_token");
  },

  getUser(): User | null {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      return null;
    }

    try {
      return JSON.parse(userStr) as User;
    } catch {
      // Dados corrompidos: melhor descartar do que quebrar o carregamento.
      localStorage.removeItem("user");
      return null;
    }
  },

  /**
   * Persists the language chosen by a signed-in user, so transactional e-mails
   * and AI answers triggered by the server follow the same language.
   */
  async updateLocale(locale: Locale): Promise<Locale> {
    const response = await apiFetch("user-locale", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });

    if (!response.ok) {
      throw await toError(response);
    }

    const data = await response.json();
    return normalizeLocale(data.locale, locale);
  },

  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      const response = await apiFetch("change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        throw await toError(response);
      }
    } catch (error: any) {
      if (isTransportError(error)) {
        throw serviceUnavailable();
      }
      throw error;
    }
  },
};
