import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, LoginRequest, RegisterRequest, AuthResponse } from '@/types/auth.types';
import { API_URL } from '@/config/env';
import { ENV_IS_DEV } from '@/config/env';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('auth_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${storedToken}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setToken(storedToken);
        } else if (response.status === 401 || response.status === 403) {
          // Token is invalid
          localStorage.removeItem('auth_token');
          setToken(null);
          setUser(null);
        } else {
          // Keep token on transient server errors/offline so session can recover.
          setToken(storedToken);
        }
      } catch (error) {
        if (ENV_IS_DEV) {
          console.error('Auth check failed:', error);
        }
        // Keep token on network errors/offline mode.
        setToken(storedToken);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Retry user profile fetch while token exists (e.g. after temporary offline/server outage).
  useEffect(() => {
    if (!token || user || isLoading) return;

    const retry = async () => {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          return;
        }
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('auth_token');
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        if (ENV_IS_DEV) {
          console.error('Auth retry failed:', error);
        }
      }
    };

    void retry();
    const interval = window.setInterval(() => {
      void retry();
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [token, user, isLoading]);

  const login = async (credentials: LoginRequest) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const data: AuthResponse = await response.json();
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('auth_token', data.token);
  };

  const register = async (data: RegisterRequest) => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }

    const authData: AuthResponse = await response.json();
    setUser(authData.user);
    setToken(authData.token);
    localStorage.setItem('auth_token', authData.token);
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      } catch (error) {
        if (ENV_IS_DEV) {
          console.error('Logout error:', error);
        }
      }
    }

    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
  };

  const value = {
    user,
    token,
    isLoading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
