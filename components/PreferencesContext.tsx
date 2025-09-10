import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type UserPreferences = {
  timeZone: string;
  locale: string;
  tempUnit: 'C' | 'F';
  distanceUnit: 'km' | 'mi';
  windUnit: 'knots' | 'mph';
  defaultMapType: 'standard' | 'hybrid';
  defaultTripsSort: 'created' | 'title' | 'startDate';
  exportFormat?: 'pdf' | 'json' | 'txt' | 'docx';
};

const DEFAULT_PREFS: UserPreferences = {
  timeZone: '',
  locale: '',
  tempUnit: 'C',
  distanceUnit: 'km',
  windUnit: 'knots',
  defaultMapType: 'standard',
  defaultTripsSort: 'created',
  exportFormat: 'pdf',
};

interface PrefsContextValue {
  prefs: UserPreferences;
  loading: boolean;
  reload: () => Promise<void>;
  setPref: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => Promise<void>;
}

const PreferencesContext = createContext<PrefsContextValue | undefined>(undefined);

/**
 * loadAll reads persisted user preference keys from AsyncStorage and returns
 * a fully-populated UserPreferences object with sensible defaults for any missing values.
 */
async function loadAll(): Promise<UserPreferences> {
  try {
    const keys = await AsyncStorage.multiGet([
      'pref_time_zone_v1',
      'pref_locale_v1',
      'pref_unit_temp_v1',
      'pref_unit_distance_v1',
      'pref_unit_wind_v1',
      'pref_default_map_type_v1',
      'pref_trips_sort_v1',
  'pref_export_format_v1',
    ]);
    const map = Object.fromEntries(keys) as Record<string, string | null>;
    return {
      timeZone: map['pref_time_zone_v1'] || DEFAULT_PREFS.timeZone,
      locale: map['pref_locale_v1'] || DEFAULT_PREFS.locale,
      tempUnit: (map['pref_unit_temp_v1'] === 'F' ? 'F' : 'C'),
      distanceUnit: (map['pref_unit_distance_v1'] === 'mi' ? 'mi' : 'km'),
      windUnit: (map['pref_unit_wind_v1'] === 'mph' ? 'mph' : 'knots'),
      defaultMapType: (map['pref_default_map_type_v1'] === 'hybrid' ? 'hybrid' : 'standard'),
      defaultTripsSort: (map['pref_trips_sort_v1'] === 'title' || map['pref_trips_sort_v1'] === 'startDate') ? map['pref_trips_sort_v1'] as any : 'created',
  exportFormat: (map['pref_export_format_v1'] === 'json' || map['pref_export_format_v1'] === 'txt' || map['pref_export_format_v1'] === 'docx') ? map['pref_export_format_v1'] as any : 'pdf',
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * PreferencesProvider loads and stores user preferences, exposing them via React context.
 * Provides: `prefs`, `loading`, `reload()` to refresh from storage, and `setPref(key, value)` to persist changes.
 */
export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const loaded = await loadAll();
    setPrefs(loaded);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const setPref = useCallback(async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPrefs(p => ({ ...p, [key]: value }));
    try {
      const storageKeyMap: Record<keyof UserPreferences, string> = {
        timeZone: 'pref_time_zone_v1',
        locale: 'pref_locale_v1',
        tempUnit: 'pref_unit_temp_v1',
        distanceUnit: 'pref_unit_distance_v1',
        windUnit: 'pref_unit_wind_v1',
        defaultMapType: 'pref_default_map_type_v1',
        defaultTripsSort: 'pref_trips_sort_v1',
  exportFormat: 'pref_export_format_v1',
      };
      await AsyncStorage.setItem(storageKeyMap[key], String(value));
    } catch {}
  }, []);

  return (
    <PreferencesContext.Provider value={{ prefs, loading, reload, setPref }}>
      {children}
    </PreferencesContext.Provider>
  );
};

/**
 * usePreferences returns the PreferencesContext value with current `prefs`, loading state,
 * and helpers to reload or update individual preferences.
 */
export function usePreferences(): PrefsContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}

// Formatting helpers (lightweight – can expand later)
// Parse a YYYY-MM-DD string as a local date (no timezone shift) – mirrors existing screens' logic
/**
 * parseLocalYmd parses a YYYY-MM-DD string as a local Date (no timezone shift).
 * Returns null for invalid inputs.
 */
function parseLocalYmd(dateStr: string): Date | null {
  const ymd = String(dateStr).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * formatDateWithPrefs formats an ISO date string using the user's locale/timeZone preferences.
 * Provide `options` to override the default human-friendly pattern.
 */
export function formatDateWithPrefs(dateStr: string | undefined, prefs: UserPreferences, options?: Intl.DateTimeFormatOptions) {
  if (!dateStr) return '';
  const d = parseLocalYmd(dateStr);
  if (!d) return dateStr;
  try {
    const locale = prefs.locale || undefined;
    // If user supplied explicit options use them; else default human-friendly pattern
    const base: Intl.DateTimeFormatOptions = options || { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
    // Respect timeZone if provided (best-effort; some JS engines may ignore invalid values)
    if (prefs.timeZone) {
      (base as any).timeZone = prefs.timeZone;
    }
    return d.toLocaleDateString(locale, base);
  } catch {
    return dateStr;
  }
}

// Convenience helper to format a start/end date range honoring preferences
/**
 * formatDateRangeWithPrefs formats a start/end date range honoring the user's locale/timeZone preferences.
 * If only one side is present, formats the single date.
 */
export function formatDateRangeWithPrefs(start: string | undefined, end: string | undefined, prefs: UserPreferences, options?: Intl.DateTimeFormatOptions) {
  if (start && end) {
    if (start === end) return formatDateWithPrefs(start, prefs, options);
    return `${formatDateWithPrefs(start, prefs, options)} – ${formatDateWithPrefs(end, prefs, options)}`;
  }
  if (start) return formatDateWithPrefs(start, prefs, options);
  if (end) return formatDateWithPrefs(end, prefs, options);
  return '';
}

// Unit formatting helpers (lightweight conversions; can be expanded with localization later)
/**
 * formatTemperature formats a Celsius value using the user's unit preference (°C or °F).
 * Use `opts.withUnit` to append the unit symbol and `opts.decimals` to control precision.
 */
export function formatTemperature(valueC: number | undefined, prefs: UserPreferences, opts?: { withUnit?: boolean; decimals?: number }) {
  if (valueC == null || isNaN(valueC)) return '';
  const decimals = opts?.decimals ?? 0;
  if (prefs.tempUnit === 'F') {
    const f = (valueC * 9) / 5 + 32;
    return f.toFixed(decimals) + (opts?.withUnit ? '°F' : '');
  }
  return valueC.toFixed(decimals) + (opts?.withUnit ? '°C' : '');
}

/**
 * formatDistance formats a distance in kilometers using the user's preference (km or mi).
 * Use `opts.withUnit` to append the unit and `opts.decimals` to control precision.
 */
export function formatDistance(km: number | undefined, prefs: UserPreferences, opts?: { withUnit?: boolean; decimals?: number }) {
  if (km == null || isNaN(km)) return '';
  const decimals = opts?.decimals ?? 1;
  if (prefs.distanceUnit === 'mi') {
    const mi = km * 0.621371;
    return mi.toFixed(decimals) + (opts?.withUnit ? ' mi' : '');
  }
  return km.toFixed(decimals) + (opts?.withUnit ? ' km' : '');
}

/**
 * formatWind formats a wind speed in knots or mph based on the user's preference.
 * Use `opts.withUnit` to append the unit and `opts.decimals` for precision.
 */
export function formatWind(speedKnots: number | undefined, prefs: UserPreferences, opts?: { withUnit?: boolean; decimals?: number }) {
  if (speedKnots == null || isNaN(speedKnots)) return '';
  const decimals = opts?.decimals ?? 0;
  if (prefs.windUnit === 'mph') {
    const mph = speedKnots * 1.15078; // nautical mile -> statute mile
    return mph.toFixed(decimals) + (opts?.withUnit ? ' mph' : '');
  }
  return speedKnots.toFixed(decimals) + (opts?.withUnit ? ' kt' : '');
}
