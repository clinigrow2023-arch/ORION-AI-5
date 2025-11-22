import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User } from '../lib/auth';

export interface ExtendedUser extends User {
  role?: string;
  isBlocked?: boolean;
  credits?: number;
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
            setUser({ ...currentUser, ...data.user });
            return;
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
  }, []);

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

