import React from 'react';
import { Pill } from '../components/Pill';
// Canonical weather keys the app understands
export type WeatherKey = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog' | 'wind' | 'unknown';

export type CurrentWeather = {
  tempC?: number;
  tempF?: number;
  code?: number;
  key: WeatherKey;
  label: string;
};

// Map Open-Meteo WMO weather codes to simple keys used by our UI
/**
 * Function mapWeatherCodeToKey: TODO describe purpose and usage.
 * @param {any} code - TODO: describe
 * @returns {any} TODO: describe
 */
export function mapWeatherCodeToKey(code?: number): WeatherKey {
  if (code == null) return 'unknown';
  if ([0].includes(code)) return 'sunny'; // Clear sky
  if ([1, 2, 3].includes(code)) return 'cloudy'; // Mainly clear to overcast
  if ([45, 48].includes(code)) return 'fog'; // Fog
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain'; // Drizzle/Rain
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow'; // Snow
  if ([95, 96, 99].includes(code)) return 'storm'; // Thunderstorm
  return 'cloudy';
}

/**
 * Function keyToLabel: TODO describe purpose and usage.
 * @param {any} key - TODO: describe
 * @returns {any} TODO: describe
 */
export function keyToLabel(key: WeatherKey): string {
  switch (key) {
    case 'sunny': return 'Sunny';
    case 'cloudy': return 'Cloudy';
    case 'rain': return 'Rain';
    case 'snow': return 'Snow';
    case 'storm': return 'Storm';
    case 'fog': return 'Fog';
    case 'wind': return 'Windy';
    default: return 'Weather';
  }
}

// Central color palette for weather pills/icons
export const WEATHER_COLOR_MAP: Record<WeatherKey, string> = {
  sunny: '#fbbf24',      // amber
  cloudy: '#94a3b8',     // slate / gray
  rain: '#3b82f6',       // blue
  storm: '#6366f1',      // indigo
  snow: '#e0f2fe',       // light sky
  fog: '#a8b1c1',        // soft desaturated gray-blue
  wind: '#60a5fa',       // lighter blue
  unknown: '#94a3b8',
};

// Icon mapping (Ionicons outline set) for weather keys
export const WEATHER_ICON_MAP: Record<WeatherKey, string> = {
  sunny: 'sunny-outline',
  cloudy: 'cloud-outline',
  rain: 'rainy-outline',
  storm: 'thunderstorm-outline',
  snow: 'snow-outline',
  fog: 'cloud-outline', // no dedicated fog icon in Ionicons outline set
  wind: 'cloud-outline', // fallback
  unknown: 'cloud-outline',
};

export interface WeatherOptionDef {
  key: WeatherKey;
  label: string;
  icon: string; // Ionicons name
}

// Options the user can currently pick from when creating/editing a note
// (we omit fog/wind/unknown for now but they are supported in displays)
export const SELECTABLE_WEATHER_OPTIONS: WeatherOptionDef[] = (
  ['sunny','cloudy','rain','storm','snow','fog','wind'] as WeatherKey[]
).map(k => ({ key: k, label: keyToLabel(k), icon: WEATHER_ICON_MAP[k] }));

/**
 * Function getWeatherColor: TODO describe purpose and usage.
 * @param {any} key - TODO: describe
 * @param {any} fallback - TODO: describe
 * @returns {any} TODO: describe
 */
export function getWeatherColor(key?: string, fallback?: string) {
  if (!key) return fallback || WEATHER_COLOR_MAP.unknown;
  return WEATHER_COLOR_MAP[(key as WeatherKey)] || fallback || WEATHER_COLOR_MAP.unknown;
}

/**
 * Function getWeatherIconName: TODO describe purpose and usage.
 * @param {any} key - TODO: describe
 * @returns {any} TODO: describe
 */
export function getWeatherIconName(key?: string) {
  if (!key) return WEATHER_ICON_MAP.unknown;
  return WEATHER_ICON_MAP[(key as WeatherKey)] || WEATHER_ICON_MAP.unknown;
}

// Convenience WeatherPill component for consistent rendering
/**
 * React component WeatherPill: TODO describe purpose and where it’s used.
 * @param {any} { weather, size = 'md' as const, label, trailing } - TODO: describe
 * @returns {any} TODO: describe
 */
export function WeatherPill({ weather, size = 'md' as const, label, trailing }: { weather: string; size?: 'sm' | 'md'; label?: string; trailing?: string }) {
  const content = (label || weather) + (trailing ? ` ${trailing}` : '');
  return React.createElement(
    Pill,
    {
      variant: 'neutral',
      size,
      iconName: getWeatherIconName(weather) as any,
      iconColorOverride: getWeatherColor(weather),
    } as any,
    content
  );
}

/**
 * Function fetchCurrentWeather: TODO describe purpose and usage.
 * @param {any} lat - TODO: describe
 * @param {any} lon - TODO: describe
 * @returns {any} TODO: describe
 */
export async function fetchCurrentWeather(lat: number, lon: number): Promise<CurrentWeather> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('weather fetch failed');
    const data = await res.json();
    const current = data?.current || {};
    const tempF = typeof current.temperature_2m === 'number' ? current.temperature_2m : undefined;
    const code = typeof current.weather_code === 'number' ? current.weather_code : undefined;
    const key = mapWeatherCodeToKey(code);
    const tempC = typeof tempF === 'number' ? Math.round(((tempF - 32) * 5) / 9) : undefined;
    return { tempC, tempF, code, key, label: keyToLabel(key) };
  } catch {
    return { key: 'unknown', label: 'Weather' };
  }
}
