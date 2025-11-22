import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { authService, User } from '../lib/auth';

export interface ExtendedUser extends User {
  role?: string;
  isBlocked?: boolean;
  isActive?: boolean;
  accessExpiresAt?: string | null;
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
    throw new Error('useAuth must be used within AuthProvider');
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

  const refreshUser = async () => {
    try {
      const token = authService.getToken();
      if (!token) {
        setUser(null);
        return;
      }

      // Fazer apenas uma chamada direta para auth-verify
      const response = await fetch('/.netlify/functions/auth-verify', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const updatedUser = data.user;
        // IMPORTANTE: Atualizar localStorage com dados atualizados do servidor
        // Isso garante que os dados persistam entre recarregamentos
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        
        // Se usuário foi bloqueado, fazer logout imediatamente
        if (updatedUser.isBlocked) {
          authService.logout();
          setUser(null);
          window.location.reload();
        }
      } else if (response.status === 403) {
        // Verificar se é bloqueado ou sem acesso ativo
        const data = await response.json().catch(() => ({}));
        if (data.blocked) {
          // Usuário bloqueado - fazer logout
          authService.logout();
          setUser(null);
          window.location.reload();
        } else if (data.notActive || data.expired) {
          // Usuário sem acesso ativo ou expirado - manter logado mas atualizar status
          const userStr = localStorage.getItem('user');
          if (userStr) {
            const currentUser = JSON.parse(userStr);
            setUser({ ...currentUser, isActive: false, ...data });
          }
        }
      } else {
        // Outros erros - fazer logout
        authService.logout();
        setUser(null);
      }
    } catch (error) {
      console.error('Refresh user failed:', error);
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
        const response = await fetch('/.netlify/functions/auth-verify', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const userData = data.user;
          setUser(userData);
          
          // Se usuário foi bloqueado, fazer logout imediatamente
          if (userData.isBlocked) {
            authService.logout();
            setUser(null);
            window.location.reload();
          }
        } else if (response.status === 403) {
          // Verificar se é bloqueado ou sem acesso ativo
          const data = await response.json().catch(() => ({}));
          if (data.blocked) {
            // Usuário bloqueado - fazer logout
            authService.logout();
            setUser(null);
            window.location.reload();
          } else if (data.notActive || data.expired) {
            // Usuário sem acesso ativo ou expirado - manter logado mas mostrar tela de espera
            const userStr = localStorage.getItem('user');
            if (userStr) {
              const currentUser = JSON.parse(userStr);
              setUser({ ...currentUser, isActive: false, ...data });
            } else {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        } else {
          // Outros erros - fazer logout
          authService.logout();
          setUser(null);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // Em caso de erro, tentar usar dados do localStorage
        const userStr = localStorage.getItem('user');
        if (userStr) {
          try {
            setUser(JSON.parse(userStr));
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Verificar periodicamente se o usuário foi bloqueado (a cada 30 segundos)
    // APENAS se o usuário estiver ativo (não verificar se está aguardando ativação)
    const interval = setInterval(async () => {
      // Não verificar periodicamente se usuário não tem acesso ativo ou está undefined
      // A verificação será feita apenas quando clicar em "Verificar Ativação"
      if (user && !user.isBlocked && user.isActive === true) {
        const token = authService.getToken();
        if (token) {
          try {
            const response = await fetch('/.netlify/functions/auth-verify', {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            if (response.status === 403) {
              const data = await response.json().catch(() => ({}));
              if (data.blocked || data.error?.includes('blocked')) {
                // Usuário bloqueado - fazer logout
                authService.logout();
                setUser(null);
                alert('Sua conta foi bloqueada. Entre em contato com um administrador.');
                window.location.reload();
              }
            } else if (response.ok) {
              const data = await response.json();
              const updatedUser = data.user;
              // Se usuário foi bloqueado, fazer logout imediatamente
              if (updatedUser?.isBlocked) {
                authService.logout();
                setUser(null);
                alert('Sua conta foi bloqueada. Entre em contato com um administrador.');
                window.location.reload();
              } else {
                // Atualizar dados do usuário
                localStorage.setItem('user', JSON.stringify(updatedUser));
                setUser(prev => prev ? { ...prev, ...updatedUser } : null);
              }
            }
          } catch (error) {
            // Ignorar erros de rede na verificação periódica
          }
        }
      }
    }, 30000); // Verificar a cada 30 segundos

    return () => clearInterval(interval);
  }, [user?.isActive, user?.isBlocked]); // Apenas re-executar se isActive ou isBlocked mudar

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password);
    // Após login, atualizar localStorage e estado com dados completos do servidor
    // O login agora retorna isActive e accessExpiresAt, então não precisa fazer refreshUser
    if (response.user) {
      // Atualizar localStorage com dados completos do servidor
      localStorage.setItem('user', JSON.stringify(response.user));
      // Atualizar estado do contexto
      setUser(response.user);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    const response = await authService.register(name, email, password);
    // Após registro, usuário não tem acesso ativo, então não precisa fazer refreshUser
    // O useEffect já vai verificar e mostrar tela de espera
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const currentUser = JSON.parse(userStr);
      // Usuário recém-criado não tem acesso ativo
      setUser({ ...currentUser, isActive: false });
    }
  };

  const logout = () => {
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
        isAdmin: user?.role === 'admin',
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

