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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const hasCheckedAuth = useRef(false);
  const { locale, hasExplicitLocale, adoptServerLocale, t } = useI18n();

  // Idioma já enviado ao servidor nesta sessão: evita repetir o PUT enquanto a
  // resposta não chega (o seletor pode ser clicado várias vezes seguidas).
  const syncingLocaleRef = useRef<Locale | null>(null);

  /**
   * Aplica no cliente o idioma salvo na conta. Uma escolha explícita feita
   * neste dispositivo tem prioridade: nesse caso o efeito de sincronização
   * abaixo envia a escolha ao servidor em vez de sobrescrevê-la.
   */
  const applyServerUser = (serverUser: ExtendedUser | null) => {
    if (!serverUser?.locale) {
      return;
    }
    if (!hasExplicitLocale) {
      adoptServerLocale(normalizeLocale(serverUser.locale));
    }
  };

  const refreshUser = async () => {
    try {
      const token = authService.getToken();
      if (!token) {
        setUser(null);
        return;
      }

      // Fazer apenas uma chamada direta para auth-verify
      const response = await apiFetch("auth-verify");

      if (response.ok) {
        const data = await response.json();
        const updatedUser = data.user;
        // IMPORTANTE: Atualizar localStorage com dados atualizados do servidor
        // Isso garante que os dados persistam entre recarregamentos
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setUser(updatedUser);
        applyServerUser(updatedUser);

        // Se usuário foi bloqueado, fazer logout imediatamente
        if (updatedUser.isBlocked) {
          authService.logout();
          setUser(null);
          window.location.reload();
        }
      } else if (response.status === 403) {
        // Verificar se é bloqueado
        const data = await response.json().catch(() => ({}));
        if (data.blocked) {
          // Usuário bloqueado - fazer logout
          authService.logout();
          setUser(null);
          window.location.reload();
        }
      } else {
        // Outros erros - fazer logout
        authService.logout();
        setUser(null);
      }
    } catch (error) {
      console.error("Refresh user failed:", error);
    }
  };

  useEffect(() => {
    // Verificar autenticação ao carregar - fazer apenas UMA vez
    if (hasCheckedAuth.current) return;

    const checkAuth = async () => {
      hasCheckedAuth.current = true;

      try {
        const token = authService.getToken();
        if (!token) {
          setUser(null);
          setLoading(false);
          return;
        }

        // Se já temos dados do usuário no localStorage, verificar se precisa fazer requisição
        // IMPORTANTE: Sempre fazer requisição para garantir que temos os dados mais recentes do servidor
        // Não confiar apenas no localStorage, pois pode estar desatualizado
        // A otimização de não fazer requisição quando isActive !== true só se aplica após a primeira verificação

        // Fazer apenas uma chamada direta para auth-verify
        const response = await apiFetch("auth-verify");

        if (response.ok) {
          const data = await response.json();
          const userData = data.user;
          localStorage.setItem("user", JSON.stringify(userData));
          // Limpar histórico do chatService ao carregar usuário para evitar compartilhamento
          chatService.clearHistory();
          setUser(userData);
          applyServerUser(userData);

          // Se usuário foi bloqueado, fazer logout imediatamente
          if (userData.isBlocked) {
            authService.logout();
            setUser(null);
            window.location.reload();
          }
        } else if (response.status === 403) {
          // Verificar se é bloqueado
          const data = await response.json().catch(() => ({}));
          if (data.blocked) {
            // Usuário bloqueado - fazer logout
            authService.logout();
            setUser(null);
            window.location.reload();
          } else {
            // Outros erros 403 - fazer logout
            setUser(null);
          }
        } else {
          // Outros erros - fazer logout
          authService.logout();
          setUser(null);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        // Em caso de erro, tentar usar dados do localStorage
        const stored = authService.getUser();
        setUser(stored);
        applyServerUser(stored);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Verificar periodicamente se o usuário foi bloqueado (a cada 30 segundos)
    const interval = setInterval(async () => {
      // Verificar se usuário existe e não está bloqueado
      if (user && !user.isBlocked) {
        const token = authService.getToken();
        if (token) {
          try {
            const response = await apiFetch("auth-verify");
            if (response.status === 403) {
              const data = await response.json().catch(() => ({}));
              if (data.blocked) {
                // Usuário bloqueado - fazer logout
                authService.logout();
                setUser(null);
                alert(t("authErrors.accountBlocked"));
                window.location.reload();
              }
            } else if (response.ok) {
              const data = await response.json();
              const updatedUser = data.user;
              // Se usuário foi bloqueado, fazer logout imediatamente
              if (updatedUser?.isBlocked) {
                authService.logout();
                setUser(null);
                alert(t("authErrors.accountBlocked"));
                window.location.reload();
              } else {
                // Atualizar dados do usuário
                localStorage.setItem("user", JSON.stringify(updatedUser));
                setUser((prev) => (prev ? { ...prev, ...updatedUser } : null));
              }
            }
          } catch (error) {
            // Ignorar erros de rede na verificação periódica
          }
        }
      }
    }, 30000); // Verificar a cada 30 segundos

    return () => clearInterval(interval);
  }, [user?.isBlocked]); // Re-executar se isBlocked mudar

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
      // Atualizar localStorage com dados completos do servidor
      localStorage.setItem("user", JSON.stringify(response.user));
      // Atualizar estado do contexto
      setUser(response.user);
      applyServerUser(response.user);
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
      localStorage.setItem("user", JSON.stringify(response.user));
      setUser(response.user);
      applyServerUser(response.user);
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
