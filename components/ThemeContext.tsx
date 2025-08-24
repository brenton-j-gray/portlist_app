import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ColorScheme, useColorScheme } from '../hooks/useColorScheme';
import { useThemeColors } from '../hooks/useThemeColors';
import { THEME_PALETTE_KEYS, ThemePaletteKey, ThemePalettes } from './constants/ThemePalettes';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextType {
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
  colorScheme: ColorScheme;
  themeColors: ReturnType<typeof useThemeColors> & { paletteKey: ThemePaletteKey };
  themePalette: ThemePaletteKey;
  setThemePalette: (k: ThemePaletteKey) => void;
  availablePalettes: { key: ThemePaletteKey; label: string }[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [themePalette, setThemePaletteState] = useState<ThemePaletteKey>('ocean');
  const colorScheme = useColorScheme(themePreference);
  // Base colors still sourced via existing hook (ocean) but we overlay with palette selection.
  const baseColors = useThemeColors(colorScheme);
  const paletteDef = ThemePalettes[themePalette] || ThemePalettes.ocean;
  const paletteVariant = paletteDef[colorScheme === 'dark' ? 'dark' : 'light'];
  const themeColors = { ...(baseColors as any), ...(paletteVariant as any), paletteKey: themePalette } as typeof baseColors & { paletteKey: ThemePaletteKey };

  // hydrate preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('themePreference');
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemePreferenceState(stored);
        }
        const paletteStored = await AsyncStorage.getItem('themePalette');
        if (paletteStored && (THEME_PALETTE_KEYS as string[]).includes(paletteStored)) {
          setThemePaletteState(paletteStored as ThemePaletteKey);
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

  const setThemePalette = async (k: ThemePaletteKey) => {
    setThemePaletteState(k);
    try { await AsyncStorage.setItem('themePalette', k); } catch {}
  };

  return (
    <ThemeContext.Provider
      value={{
        themePreference,
        setThemePreference,
        colorScheme,
        themeColors,
        themePalette,
        setThemePalette,
        availablePalettes: THEME_PALETTE_KEYS.map(k => ({ key: k, label: ThemePalettes[k].label })),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
