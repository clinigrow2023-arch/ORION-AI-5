import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { authService, User } from "../lib/auth";
import { chatService } from "../services/chatService";
import { apiFetch } from "../lib/api-endpoints";
import { translateActive } from "../lib/i18n";
import { normalizeLocale, type Locale } from "../lib/locale";
import { useI18n } from "./I18nContext";

export interface ExtendedUser extends User {
  role?: string;
  isBlocked?: boolean;
  isActive?: boolean;
  accessExpiresAt?: string | null;
  passwordResetRequired?: boolean;
}

interface AuthContextType {
  user: ExtendedUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

/** Hard block from the API — not the soft "account waiting for activation". */
function isHardBlockPayload(data: {
  blocked?: boolean;
  notActive?: boolean;
}): boolean {
  return Boolean(data.blocked) && !data.notActive;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { locale, hasExplicitLocale, adoptServerLocale } = useI18n();

  // Idioma já enviado ao servidor nesta sessão: evita repetir o PUT enquanto a
  // resposta não chega (o seletor pode ser clicado várias vezes seguidas).
  const syncingLocaleRef = useRef<Locale | null>(null);
  // Lido dentro de callbacks assíncronos: um valor capturado no render poderia
  // estar desatualizado se o usuário trocar de idioma durante a verificação.
  const hasExplicitLocaleRef = useRef(hasExplicitLocale);
  hasExplicitLocaleRef.current = hasExplicitLocale;

  const userRef = useRef<ExtendedUser | null>(user);
  userRef.current = user;

  /**
   * Aplica no cliente o idioma salvo na conta. Uma escolha explícita feita
   * neste dispositivo tem prioridade: nesse caso o efeito de sincronização
   * abaixo envia a escolha ao servidor em vez de sobrescrevê-la.
   */
  const applyServerUser = (serverUser: ExtendedUser | null) => {
    if (!serverUser?.locale) {
      return;
    }
    if (!hasExplicitLocaleRef.current) {
      adoptServerLocale(normalizeLocale(serverUser.locale));
    }
  };

  const persistUser = (next: ExtendedUser) => {
    localStorage.setItem("user", JSON.stringify(next));
    setUser(next);
    applyServerUser(next);
  };

  const clearSession = () => {
    authService.logout();
    setUser(null);
  };

  const restoreStoredUser = () => {
    const stored = authService.getUser() as ExtendedUser | null;
    if (stored) {
      setUser(stored);
      applyServerUser(stored);
    }
  };

  /**
   * Interpreta a resposta de auth-verify sem derrubar a sessão por erro
   * transitório (API reiniciando, 502 do proxy, 500).
   */
  const handleVerifyResponse = async (
    response: Response,
    options?: { alertOnHardBlock?: boolean }
  ): Promise<"ok" | "hard_block" | "soft_deny" | "unauthorized" | "transient"> => {
    if (response.ok) {
      const data = await response.json();
      const updatedUser = data.user as ExtendedUser;
      persistUser(updatedUser);

      if (updatedUser.isBlocked) {
        clearSession();
        if (options?.alertOnHardBlock) {
          alert(translateActive("authErrors.accountBlocked"));
        }
        window.location.reload();
        return "hard_block";
      }
      return "ok";
    }

    if (response.status === 401) {
      clearSession();
      return "unauthorized";
    }

    if (response.status === 403) {
      const data = (await response.json().catch(() => ({}))) as {
        blocked?: boolean;
        notActive?: boolean;
        expired?: boolean;
      };

      if (isHardBlockPayload(data)) {
        clearSession();
        if (options?.alertOnHardBlock) {
          alert(translateActive("authErrors.accountBlocked"));
        }
        window.location.reload();
        return "hard_block";
      }

      // Conta inativa / sem acesso: mantém o token e o usuário local.
      restoreStoredUser();
      return "soft_deny";
    }

    // 5xx, 502 do Vite proxy, etc. — não desloga.
    restoreStoredUser();
    return "transient";
  };

  const refreshUser = async () => {
    try {
      const token = authService.getToken();
      if (!token) {
        setUser(null);
        return;
      }

      const response = await apiFetch("auth-verify");
      await handleVerifyResponse(response);
    } catch (error) {
      console.error("Refresh user failed:", error);
      // Rede instável: mantém a sessão local.
      restoreStoredUser();
    }
  };

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const token = authService.getToken();
        if (!token) {
          if (!cancelled) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        const response = await apiFetch("auth-verify");
        if (cancelled) {
          return;
        }
        await handleVerifyResponse(response);
      } catch (error) {
        console.error("Auth check failed:", error);
        if (!cancelled) {
          restoreStoredUser();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void checkAuth();

    // Verificação periódica de bloqueio — usa ref para não depender de stale state.
    const interval = setInterval(async () => {
      const current = userRef.current;
      if (!current || current.isBlocked) {
        return;
      }
      const token = authService.getToken();
      if (!token) {
        return;
      }

      try {
        const response = await apiFetch("auth-verify");
        await handleVerifyResponse(response, { alertOnHardBlock: true });
      } catch {
        // Ignorar erros de rede na verificação periódica
      }
    }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // Montagem única: logout espontâneo vinha de reexecutar o efeito e de
    // tratar 502/conta inativa como hard logout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Propaga para o servidor a troca de idioma feita por um usuário logado, para
  // que e-mails e respostas da IA disparados pelo backend usem o mesmo idioma.
  useEffect(() => {
    if (!user || !hasExplicitLocale) {
      return;
    }
    if (user.locale === locale || syncingLocaleRef.current === locale) {
      return;
    }

    syncingLocaleRef.current = locale;
    let cancelled = false;

    authService
      .updateLocale(locale)
      .then((saved) => {
        if (cancelled) {
          return;
        }
        setUser((prev) => {
          if (!prev) {
            return prev;
          }
          const next = { ...prev, locale: saved };
          localStorage.setItem("user", JSON.stringify(next));
          return next;
        });
      })
      .catch(() => {
        // Falha de rede: permite nova tentativa na próxima troca de idioma.
        if (syncingLocaleRef.current === locale) {
          syncingLocaleRef.current = null;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.locale, locale, hasExplicitLocale]);

  const login = async (email: string, password: string) => {
    // Limpar histórico do chatService ao fazer login para evitar compartilhamento entre usuários
    chatService.clearHistory();
    const response = await authService.login(
      email,
      password,
      hasExplicitLocale ? locale : undefined
    );
    // Após login, atualizar localStorage e estado com dados completos do servidor
    // O login agora retorna isActive e accessExpiresAt, então não precisa fazer refreshUser
    if (response.user) {
      persistUser(response.user as ExtendedUser);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    const response = await authService.register(
      name,
      email,
      password,
      hasExplicitLocale ? locale : undefined
    );
    // Após registro, usuário já está ativo e pode usar a IA imediatamente
    if (response.user) {
      persistUser(response.user as ExtendedUser);
    }
  };

  const logout = () => {
    // Limpar histórico do chatService ao fazer logout para evitar compartilhamento entre usuários
    chatService.clearHistory();

    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
