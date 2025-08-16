import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiGetProfile, apiLogin, apiRegister, clearToken as clearStoredToken, getToken as getStoredToken, saveToken } from '../lib/api';
import { syncTripsBackground } from '../lib/sync';

type AuthContextType = {
  token: string | null;
  loading: boolean;
  userEmail: string | null;
  userName: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const t = await getStoredToken();
      setToken(t);
      setLoading(false);
      if (t) {
        // On app start with existing session, sync in background
        syncTripsBackground();
        // Try to hydrate profile name
        try {
          const res = await apiGetProfile();
          const p = (res as any)?.profile;
          if (p?.username) setUserName(p.username);
          else if (p?.fullName) setUserName(p.fullName);
        } catch {
          // ignore network/auth errors
        }
      }
    })();
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    token,
    loading,
    userEmail,
    userName,
    login: async (email, password) => {
      const res = await apiLogin(email, password);
      if ((res as any).token) {
        await saveToken((res as any).token);
        setToken((res as any).token);
        setUserEmail(email);
        // Fetch profile to populate display name
        try {
          const pr = await apiGetProfile();
          const p = (pr as any)?.profile;
          if (p?.username) setUserName(p.username);
          else if (p?.fullName) setUserName(p.fullName);
        } catch { /* noop */ }
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
        setUserEmail(email);
        // Try to fetch profile (might be empty until setup)
        try {
          const pr = await apiGetProfile();
          const p = (pr as any)?.profile;
          if (p?.username) setUserName(p.username);
          else if (p?.fullName) setUserName(p.fullName);
        } catch { /* noop */ }
  syncTripsBackground();
      } else {
        throw new Error((res as any).error || 'Register failed');
      }
    },
    logout: async () => {
      await clearStoredToken();
      setToken(null);
      setUserEmail(null);
      setUserName(null);
    },
  }), [token, loading, userEmail, userName]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
