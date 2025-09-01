// Geocoding helper (no Google).
// Uses MapTiler Geocoding if EXPO_PUBLIC_MAPTILER_KEY is provided; otherwise falls back to OSM Nominatim.
// Both are public endpoints — please comply with each provider's usage policy.

export interface PlaceHit { lat: number; lng: number; label: string }

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY;

// Simple in-memory caches to reduce network chatter during a session
const predictionCache = new Map<string, PlaceHit[]>();
const detailsCache = new Map<string, { lat: number; lng: number; name?: string; address?: string }>();

function buildLabel(name?: string, address?: string): string {
  if (!name && !address) return '';
  if (name && address) {
    // Avoid repeating name if already at start of address
    const normalized = address.toLowerCase().startsWith(name.toLowerCase()) ? address : `${name}, ${address}`;
    // Trim long labels
    return normalized.length > 120 ? normalized.slice(0, 117) + '…' : normalized;
  }
  return (name || address || '').slice(0, 120);
}

export async function searchPlaces(query: string, limit = 8): Promise<PlaceHit[]> {
  try {
    const q = query.trim();
    if (!q) return [];
    if (predictionCache.has(q)) return predictionCache.get(q)!;

    let results: PlaceHit[] = [];
    if (MAPTILER_KEY) {
      // MapTiler Geocoding (Mapbox-compatible API)
      const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${MAPTILER_KEY}&limit=${limit}`;
      const res = await fetch(url);
      const data: any = await res.json();
      if (data && Array.isArray(data.features)) {
        results = data.features.map((f: any) => {
          const [lng, lat] = f.center || f.geometry?.coordinates || [undefined, undefined];
          const label = f.place_name || f.text || f.properties?.name || q;
          return (isFinite(lat) && isFinite(lng)) ? { lat, lng, label: String(label).slice(0, 120) } : undefined;
        }).filter(Boolean) as PlaceHit[];
      }
    }

    if (!results.length) {
      // OSM Nominatim fallback
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=${limit}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'PortlistApp/1.0 (contact: support@portlist.app)',
          'Accept-Language': 'en',
        },
      });
      const data: any = await res.json();
      if (Array.isArray(data)) {
        results = data.map((it: any) => {
          const lat = parseFloat(it.lat);
          const lng = parseFloat(it.lon);
          const label = it.display_name || it.name || q;
          return (isFinite(lat) && isFinite(lng)) ? { lat, lng, label: String(label).slice(0, 120) } : undefined;
        }).filter(Boolean) as PlaceHit[];
      }
    }

    predictionCache.set(q, results);
    return results.slice(0, limit);
  } catch {
    return [];
  }
}

export function clearPlacesCaches() {
  predictionCache.clear();
  detailsCache.clear();
}
