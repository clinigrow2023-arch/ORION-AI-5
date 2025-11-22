import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

  const refreshUser = async () => {
    try {
      const currentUser = await authService.verify();
      if (currentUser) {
        // Buscar dados completos do usuário incluindo role e créditos
        const token = authService.getToken();
        if (token) {
          const response = await fetch('/.netlify/functions/auth-verify', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (response.ok) {
            const data = await response.json();
            const updatedUser = { ...currentUser, ...data.user };
            setUser(updatedUser);
            
            // Se usuário foi bloqueado, fazer logout imediatamente
            if (updatedUser.isBlocked) {
              authService.logout();
              setUser(null);
              window.location.reload();
            }
            return;
          } else if (response.status === 403) {
            // Verificar se é bloqueado ou sem acesso ativo
            const data = await response.json().catch(() => ({}));
            if (data.blocked) {
              // Usuário bloqueado - fazer logout
              authService.logout();
              setUser(null);
              window.location.reload();
              return;
            } else if (data.notActive || data.expired) {
              // Usuário sem acesso ativo ou expirado - manter logado mas atualizar status
              const updatedUser = { ...currentUser, isActive: false, ...data };
              setUser(updatedUser);
              return;
            }
          }
        }
      }
      setUser(currentUser);
    } catch (error) {
      console.error('Refresh user failed:', error);
    }
  };

  useEffect(() => {
    // Verificar autenticação ao carregar
    const checkAuth = async () => {
      try {
        const currentUser = await authService.verify();
        if (currentUser) {
          // Buscar dados completos do usuário
          const token = authService.getToken();
          if (token) {
            try {
              const response = await fetch('/.netlify/functions/auth-verify', {
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });
              if (response.ok) {
                const data = await response.json();
                setUser({ ...currentUser, ...data.user });
              } else if (response.status === 403) {
                // Verificar se é bloqueado ou sem acesso ativo
                const data = await response.json().catch(() => ({}));
                if (data.blocked) {
                  // Usuário bloqueado - fazer logout
                  authService.logout();
                  setUser(null);
                } else if (data.notActive || data.expired) {
                  // Usuário sem acesso ativo ou expirado - manter logado mas mostrar tela de espera
                  setUser({ ...currentUser, isActive: false, ...data });
                } else {
                  setUser(currentUser);
                }
              } else {
                setUser(currentUser);
              }
            } catch {
              setUser(currentUser);
            }
          } else {
            setUser(currentUser);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Verificar periodicamente se o usuário foi bloqueado (a cada 10 segundos)
    const interval = setInterval(async () => {
      if (user && !user.isBlocked) {
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
                authService.logout();
                setUser(null);
                alert('Sua conta foi bloqueada. Entre em contato com um administrador.');
                // Recarregar página para mostrar tela de login
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
                setUser(prev => prev ? { ...prev, ...updatedUser } : null);
              }
            }
          } catch (error) {
            // Ignorar erros de rede na verificação periódica
          }
        }
      }
    }, 10000); // Verificar a cada 10 segundos para resposta mais rápida

    return () => clearInterval(interval);
  }, [user]);

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password);
    await refreshUser();
  };

  const register = async (name: string, email: string, password: string) => {
    const response = await authService.register(name, email, password);
    await refreshUser();
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

