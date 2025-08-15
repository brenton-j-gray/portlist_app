import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiLogin, apiRegister, clearToken as clearStoredToken, getToken as getStoredToken, saveToken } from '../lib/api';
import { syncTripsBackground } from '../lib/sync';

type AuthContextType = {
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await getStoredToken();
      setToken(t);
      setLoading(false);
      if (t) {
        // On app start with existing session, sync in background
        syncTripsBackground();
      }
    })();
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    token,
    loading,
    login: async (email, password) => {
      const res = await apiLogin(email, password);
      if ((res as any).token) {
        await saveToken((res as any).token);
        setToken((res as any).token);
  syncTripsBackground();
      } else {
        throw new Error((res as any).error || 'Login failed');
      }
    },
    register: async (email, password) => {
      const res = await apiRegister(email, password);
      if ((res as any).token) {
        await saveToken((res as any).token);
        setToken((res as any).token);
  syncTripsBackground();
      } else {
        throw new Error((res as any).error || 'Register failed');
      }
    },
    logout: async () => {
      await clearStoredToken();
      setToken(null);
    },
  }), [token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
