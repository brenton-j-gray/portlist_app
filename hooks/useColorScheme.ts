import { useEffect, useState } from 'react';
import { useColorScheme as useNativeColorScheme } from 'react-native';

export type ColorScheme = 'light' | 'dark';

/**
 * Function useColorScheme: TODO describe purpose and usage.
 * @param {any} userPreference - TODO: describe
 * @returns {any} TODO: describe
 */
export function useColorScheme(userPreference: 'system' | 'light' | 'dark'): ColorScheme {
  const systemScheme = useNativeColorScheme() as ColorScheme;
  const [scheme, setScheme] = useState<ColorScheme>(systemScheme || 'light');

  useEffect(() => {
    if (userPreference === 'system') {
      setScheme(systemScheme || 'light');
    } else {
      setScheme(userPreference);
    }
  }, [userPreference, systemScheme]);

  return scheme;
}
