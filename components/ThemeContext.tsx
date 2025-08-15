import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ColorScheme, useColorScheme } from '../hooks/useColorScheme';
import { useThemeColors } from '../hooks/useThemeColors';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextType {
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
  colorScheme: ColorScheme;
  themeColors: ReturnType<typeof useThemeColors>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const colorScheme = useColorScheme(themePreference);
  const themeColors = useThemeColors(colorScheme);

  // hydrate preference on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('themePreference');
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemePreferenceState(stored);
        }
  } catch {
        // ignore
      }
    })();
  }, []);

  const setThemePreference = async (pref: ThemePreference) => {
    setThemePreferenceState(pref);
    try {
      await AsyncStorage.setItem('themePreference', pref);
  } catch {
      // ignore
    }
  };

  return (
    <ThemeContext.Provider value={{ themePreference, setThemePreference, colorScheme, themeColors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
