// Auth service for client-side
import { getApiEndpoint } from "./api-endpoints";

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const authService = {
  async register(
    name: string,
    email: string,
    password: string
  ): Promise<AuthResponse> {
    try {
      const response = await fetch(getApiEndpoint("auth-register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      // Verificar se a resposta é válida antes de fazer parse
      if (!response.ok) {
        const text = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(text);
        } catch {
          // Se não conseguir fazer parse, usar o texto da resposta
          throw new Error(
            response.status === 404
              ? 'Authentication service not available. Please use "netlify dev" to run locally or deploy to production.'
              : `Registration failed: ${response.status} ${response.statusText}`
          );
        }
        throw new Error(errorData.error || "Registration failed");
      }

      const data = await response.json();

      // Login automático após registro
      return this.login(email, password);
    } catch (error: any) {
      // Se falhar em dev (404), mostrar erro claro
      if (
        error.message?.includes("Failed to fetch") ||
        error.message?.includes("404") ||
        error.message?.includes("Authentication service not available")
      ) {
        throw new Error(
          'Authentication service not available. Please use "netlify dev" to run locally or deploy to production.'
        );
      }
      throw error;
    }
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(getApiEndpoint("auth-login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      // Verificar se a resposta é válida antes de fazer parse
      if (!response.ok) {
        const text = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(text);
        } catch {
          // Se não conseguir fazer parse, usar o texto da resposta
          throw new Error(
            response.status === 404
              ? 'Authentication service not available. Please use "netlify dev" to run locally or deploy to production.'
              : `Login failed: ${response.status} ${response.statusText}`
          );
        }
        throw new Error(errorData.error || "Login failed");
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
      // Se falhar em dev (404), mostrar erro claro
      if (
        error.message?.includes("Failed to fetch") ||
        error.message?.includes("404") ||
        error.message?.includes("Authentication service not available")
      ) {
        throw new Error(
          'Authentication service not available. Please use "netlify dev" to run locally or deploy to production.'
        );
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
      const response = await fetch(getApiEndpoint("auth-verify"), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Se for 404, usar dados do localStorage como fallback
        if (response.status === 404) {
          const userStr = localStorage.getItem("user");
          if (userStr) {
            return JSON.parse(userStr);
          }
        }

        // Se for 403, verificar se é notActive ou expired (não fazer logout nesses casos)
        if (response.status === 403) {
          try {
            const data = await response.json();
            if (data.notActive || data.expired) {
              // Usuário sem acesso ativo ou expirado - retornar dados do localStorage
              // O AuthContext vai tratar isso e mostrar a tela de espera
              const userStr = localStorage.getItem("user");
              if (userStr) {
                return JSON.parse(userStr);
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
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          return JSON.parse(userStr);
        } catch {
          this.logout();
          return null;
        }
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
    return userStr ? JSON.parse(userStr) : null;
  },

  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error("No token found");
      }

      const response = await fetch(getApiEndpoint("change-password"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const text = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(text);
        } catch {
          throw new Error(
            response.status === 404
              ? 'Authentication service not available. Please use "netlify dev" to run locally or deploy to production.'
              : `Password change failed: ${response.status} ${response.statusText}`
          );
        }
        throw new Error(errorData.error || "Password change failed");
      }

      const data = await response.json();
      return;
    } catch (error: any) {
      if (
        error.message?.includes("Failed to fetch") ||
        error.message?.includes("404") ||
        error.message?.includes("Authentication service not available")
      ) {
        throw new Error(
          'Authentication service not available. Please use "netlify dev" to run locally or deploy to production.'
        );
      }
      throw error;
    }
  },
};
