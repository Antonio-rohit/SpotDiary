import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient, ApiError } from '../api/client';
import { SecureStorage } from '../utils/secureStorage';

export interface MobileUser {
  id: string;
  email: string;
  username: string;
  display_name: string;
  name?: string;
  avatar_url?: string;
  bio?: string;
}

interface AuthContextType {
  user: MobileUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  resetPassword: (token: string, password: string) => Promise<{ success: boolean; message?: string; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSavedSession();
  }, []);

  const loadSavedSession = async () => {
    try {
      const savedToken = await SecureStorage.getItem(TOKEN_KEY);
      const savedUserStr = await SecureStorage.getItem(USER_KEY);

      if (savedToken) {
        setToken(savedToken);
        if (savedUserStr) {
          try {
            setUser(JSON.parse(savedUserStr));
          } catch {}
        }

        // Verify session freshness with backend API
        try {
          const res = await apiClient.get<{ authenticated: boolean; user: MobileUser }>('/api/auth/me');
          if (res && res.authenticated && res.user) {
            setUser(res.user);
            await SecureStorage.setItem(USER_KEY, JSON.stringify(res.user));
          } else {
            // Session expired or revoked
            await clearSession();
          }
        } catch (apiErr: any) {
          if (apiErr.status === 401) {
            await clearSession();
          }
        }
      }
    } catch {
      // Inability to read storage gracefully falls back to logged out state
    } finally {
      setIsLoading(false);
    }
  };

  const clearSession = async () => {
    setUser(null);
    setToken(null);
    await SecureStorage.deleteItem(TOKEN_KEY);
    await SecureStorage.deleteItem(USER_KEY);
  };

  const login = async (email: string, password: string) => {
    try {
      const res = await apiClient.post<{ success: boolean; user: MobileUser; token: string }>('/api/auth/login', {
        email,
        password,
      });

      if (res && res.success && res.token) {
        setToken(res.token);
        setUser(res.user);
        await SecureStorage.setItem(TOKEN_KEY, res.token);
        await SecureStorage.setItem(USER_KEY, JSON.stringify(res.user));
        return { success: true };
      }
      return { success: false, error: 'Login failed. Invalid response from server.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed.' };
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const res = await apiClient.post<{ success: boolean; user: MobileUser; token: string }>('/api/auth/register', {
        email,
        password,
        name,
        displayName: name,
      });

      if (res && res.success && res.token) {
        setToken(res.token);
        setUser(res.user);
        await SecureStorage.setItem(TOKEN_KEY, res.token);
        await SecureStorage.setItem(USER_KEY, JSON.stringify(res.user));
        return { success: true };
      }
      return { success: false, error: 'Registration failed. Invalid response from server.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed.' };
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/api/auth/logout').catch(() => {});
    } finally {
      await clearSession();
    }
  };

  const refreshSession = async () => {
    if (!token) return;
    try {
      const res = await apiClient.get<{ authenticated: boolean; user: MobileUser }>('/api/auth/me');
      if (res && res.authenticated && res.user) {
        setUser(res.user);
        await SecureStorage.setItem(USER_KEY, JSON.stringify(res.user));
      } else {
        await clearSession();
      }
    } catch (err: any) {
      if (err.status === 401) {
        await clearSession();
      }
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const res = await apiClient.post<{ success: boolean; message: string }>('/api/auth/forgot-password', { email });
      return { success: true, message: res.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to request password reset link.' };
    }
  };

  const resetPassword = async (resetToken: string, password: string) => {
    try {
      const res = await apiClient.post<{ success: boolean; message: string }>('/api/auth/reset-password', {
        token: resetToken,
        password,
      });
      return { success: true, message: res.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to reset password.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        loading: isLoading,
        login,
        register,
        logout,
        refreshSession,
        forgotPassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
