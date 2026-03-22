import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import type { User, LoginRequest, RegisterRequest, AuthResponse } from '@/types/auth.types';
import { ENV_IS_DEV } from '@/config/env';
import { fetchApi } from '@/services/api';

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
const AUTH_TOKEN_STORAGE_KEY = 'auth_token';
const AUTH_FAILURE_PATTERN = /nicht authentifiziert|unauthorized|invalid token|session expired|user not found|no token provided/i;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
  const [isLoading, setIsLoading] = useState(true);
  const loggedOutRef = useRef(false);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const userData = await fetchApi<User>('/auth/me', {
          token: storedToken,
        });
        setUser(userData);
        setToken(storedToken);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (AUTH_FAILURE_PATTERN.test(message)) {
          localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
          setToken(null);
          setUser(null);
        } else {
          setToken(storedToken);
        }
        if (ENV_IS_DEV) {
          console.error('Auth check failed:', error);
        }
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
      if (loggedOutRef.current) return;
      try {
        const userData = await fetchApi<User>('/auth/me', {
          token,
        });
        if (loggedOutRef.current) return;
        setUser(userData);
      } catch (error) {
        if (loggedOutRef.current) return;
        const message = error instanceof Error ? error.message : '';
        if (AUTH_FAILURE_PATTERN.test(message)) {
          localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
          setToken(null);
          setUser(null);
        }
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
    loggedOutRef.current = false;
    const data = await fetchApi<AuthResponse>('/auth/login', {
      method: 'POST',
      data: credentials,
    });
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, data.token);
  };

  const register = async (data: RegisterRequest) => {
    loggedOutRef.current = false;
    const authData = await fetchApi<AuthResponse>('/auth/register', {
      method: 'POST',
      data,
    });
    setUser(authData.user);
    setToken(authData.token);
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authData.token);
  };

  const logout = async () => {
    loggedOutRef.current = true;
    if (token) {
      try {
        await fetchApi('/auth/logout', {
          method: 'POST',
          token,
          responseType: 'void',
        });
      } catch (error) {
        if (ENV_IS_DEV) {
          console.error('Logout error:', error);
        }
      }
    }

    setUser(null);
    setToken(null);
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
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
