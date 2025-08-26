import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type FeatureFlags = {
  weather: boolean;
};

type FeatureFlagsContextType = {
  flags: FeatureFlags;
  setFlag: <K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) => Promise<void>;
  refresh: () => Promise<void>;
};

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(undefined);

function parseBool(v: any, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
  return fallback;
}

const DEFAULT_FLAGS: FeatureFlags = {
  weather: true,
};

async function readOverrides(): Promise<Partial<FeatureFlags>> {
  try {
    const w = await AsyncStorage.getItem('ff_weather');
    const out: Partial<FeatureFlags> = {};
    if (w != null) out.weather = w === '1';
    return out;
  } catch {
    return {};
  }
}

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);

  const computeFromEnv = (): Partial<FeatureFlags> => {
    // Expo public env vars are available at build/runtime
    const envWeather = (process.env.EXPO_PUBLIC_ENABLE_WEATHER as any);
    const out: Partial<FeatureFlags> = {};
    if (envWeather != null) out.weather = parseBool(envWeather, DEFAULT_FLAGS.weather);
    return out;
  };

  const refresh = useCallback(async () => {
    const env = computeFromEnv();
    const overrides = await readOverrides();
    setFlags({ ...DEFAULT_FLAGS, ...env, ...overrides });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const setFlag: FeatureFlagsContextType['setFlag'] = async (key, value) => {
    setFlags((prev) => ({ ...prev, [key]: value }));
    try {
      if (key === 'weather') {
        await AsyncStorage.setItem('ff_weather', value ? '1' : '0');
      }
    } catch { /* ignore */ }
  };

  const ctx = useMemo<FeatureFlagsContextType>(() => ({ flags, setFlag, refresh }), [flags, refresh]);

  return (
    <FeatureFlagsContext.Provider value={ctx}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error('useFeatureFlags must be used within FeatureFlagsProvider');
  return ctx;
}
