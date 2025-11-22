// Auth service for client-side
const getApiBase = (): string => {
  if (typeof window !== 'undefined') {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // Em desenvolvimento, tentar Netlify Function primeiro, se falhar, retornar null para usar fallback
    return '/.netlify/functions';
  }
  return '/.netlify/functions';
};

const API_BASE = getApiBase();

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
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE}/auth-register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Login automático após registro
      return this.login(email, password);
    } catch (error: any) {
      // Se falhar em dev (404), mostrar erro claro
      if (error.message?.includes('Failed to fetch') || error.message?.includes('404')) {
        throw new Error('Authentication service not available. Please use Netlify dev or deploy to production.');
      }
      throw error;
    }
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE}/auth-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Salvar token no localStorage
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      return {
        token: data.token,
        user: data.user,
      };
    } catch (error: any) {
      // Se falhar em dev (404), mostrar erro claro
      if (error.message?.includes('Failed to fetch') || error.message?.includes('404')) {
        throw new Error('Authentication service not available. Please use Netlify dev or deploy to production.');
      }
      throw error;
    }
  },

  async verify(): Promise<User | null> {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE}/auth-verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        this.logout();
        return null;
      }

      return data.user;
    } catch (error) {
      // Em dev, se a function não estiver disponível, usar dados do localStorage
      const userStr = localStorage.getItem('user');
      if (userStr) {
        return JSON.parse(userStr);
      }
      this.logout();
      return null;
    }
  },

  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  },

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  },

  getUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  },
};

