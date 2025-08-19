export type WeatherKey = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog' | 'wind' | 'unknown';

export type CurrentWeather = {
  tempC?: number;
  tempF?: number;
  code?: number;
  key: WeatherKey;
  label: string;
};

// Map Open-Meteo WMO weather codes to simple keys used by our UI
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
