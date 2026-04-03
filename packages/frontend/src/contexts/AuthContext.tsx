import { createContext, useContext, useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import type { User, LoginRequest, RegisterRequest, AuthResponse } from '@/types/auth.types';
import { ENV_IS_DEV } from '@/config/env';
import { fetchApi } from '@/services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_FAILURE_PATTERN = /nicht authentifiziert|unauthorized|invalid token|session expired|user not found|no token provided/i;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loggedOutRef = useRef(false);

  // Check authentication status on mount via httpOnly cookie
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await fetchApi<User>('/auth/me');
        setUser(userData);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (AUTH_FAILURE_PATTERN.test(message)) {
          setUser(null);
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

  // Retry user profile fetch while logged out is not requested (e.g. after temporary offline/server outage).
  useEffect(() => {
    if (user || isLoading || loggedOutRef.current) return;

    const retry = async () => {
      if (loggedOutRef.current) return;
      try {
        const userData = await fetchApi<User>('/auth/me');
        if (loggedOutRef.current) return;
        setUser(userData);
      } catch (error) {
        if (loggedOutRef.current) return;
        const message = error instanceof Error ? error.message : '';
        if (AUTH_FAILURE_PATTERN.test(message)) {
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
  }, [user, isLoading]);

  const login = async (credentials: LoginRequest) => {
    loggedOutRef.current = false;
    const data = await fetchApi<AuthResponse>('/auth/login', {
      method: 'POST',
      data: credentials,
    });
    setUser(data.user);
  };

  const register = async (data: RegisterRequest) => {
    loggedOutRef.current = false;
    const authData = await fetchApi<AuthResponse>('/auth/register', {
      method: 'POST',
      data,
    });
    setUser(authData.user);
  };

  const logout = async () => {
    loggedOutRef.current = true;
    try {
      await fetchApi('/auth/logout', {
        method: 'POST',
        responseType: 'void',
      });
    } catch (error) {
      if (ENV_IS_DEV) {
        console.error('Logout error:', error);
      }
    }

    setUser(null);
  };

  const value = useMemo(() => ({
    user,
    isLoading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  }), [user, isLoading, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
