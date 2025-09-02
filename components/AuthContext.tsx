import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiGetProfile, apiLogin, apiRegister, clearToken as clearStoredToken, getToken as getStoredToken, saveToken } from '../lib/api';
import { syncTripsBackground } from '../lib/sync';

type AuthContextType = {
  token: string | null;
  loading: boolean;
  userEmail: string | null;
  userName: string | null;
  userAvatar: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setUserAvatar: (uri: string | null) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * React component AuthProvider: TODO describe purpose and where it’s used.
 * @param {any} { children } - TODO: describe
 * @returns {any} TODO: describe
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatar, setUserAvatarState] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const t = await getStoredToken();
      setToken(t);
      setLoading(false);
      // hydrate avatar
      try {
        const avatar = await AsyncStorage.getItem('cjp_avatar_uri');
        setUserAvatarState(avatar || null);
      } catch { /* noop */ }
    if (t) {
        // On app start with existing session, sync in background
        syncTripsBackground();
        // Try to hydrate profile name
        try {
          const res = await apiGetProfile();
          const p = (res as any)?.profile;
          const full = (p?.fullName?.trim?.() || '') as string;
          const first = full ? (full.split(/\s+/)[0] || '') : '';
          const name = (first || p?.username?.trim?.() || null) as string | null;
          setUserName(name);
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
    userAvatar,
    refreshProfile: async () => {
      if (!token) return;
      try {
  const pr = await apiGetProfile();
  const p = (pr as any)?.profile;
  const full = (p?.fullName?.trim?.() || '') as string;
  const first = full ? (full.split(/\s+/)[0] || '') : '';
  const name = (first || p?.username?.trim?.() || null) as string | null;
  setUserName(name);
      } catch { /* noop */ }
    },
    setUserAvatar: async (uri: string | null) => {
      setUserAvatarState(uri);
      try {
        if (uri) await AsyncStorage.setItem('cjp_avatar_uri', uri);
        else await AsyncStorage.removeItem('cjp_avatar_uri');
      } catch { /* noop */ }
    },
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
          const full = (p?.fullName?.trim?.() || '') as string;
          const first = full ? (full.split(/\s+/)[0] || '') : '';
          const name = (first || p?.username?.trim?.() || null) as string | null;
          setUserName(name);
        } catch { /* noop */ }
  syncTripsBackground();
      } else {
        throw new Error((res as any).error || 'Login failed');
      }
    },
    register: async (email, password, username) => {
      const res = await apiRegister(email, password, username);
      if ((res as any).token) {
        await saveToken((res as any).token);
        setToken((res as any).token);
        setUserEmail(email);
        // Try to fetch profile (might be empty until setup)
        try {
          const pr = await apiGetProfile();
          const p = (pr as any)?.profile;
          const full = (p?.fullName?.trim?.() || '') as string;
          const first = full ? (full.split(/\s+/)[0] || '') : '';
          const name = (first || p?.username?.trim?.() || null) as string | null;
          setUserName(name);
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
    setUserAvatarState(null);
    },
  }), [token, loading, userEmail, userName, userAvatar]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * React component useAuth: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
