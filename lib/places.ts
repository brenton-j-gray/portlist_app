// Geocoding helper (no Google).
// Uses MapTiler Geocoding if EXPO_PUBLIC_MAPTILER_KEY is provided; otherwise falls back to OSM Nominatim.
// Both are public endpoints — please comply with each provider's usage policy.

export interface PlaceHit { lat: number; lng: number; label: string }

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY;

/**
 * isEnglishLike returns true for labels that look ASCII/English enough to render in the UI.
 * Used to prefer English results from geocoders and avoid unreadable suggestions.
 */
function isEnglishLike(label: string): boolean {
  if (!label) return false;
  // Exclude labels with non-ASCII chars (keeps things clearly English for now)
  if (/[^\x00-\x7F]/.test(label)) return false;
  // Require at least a couple of Latin letters
  return /[A-Za-z]{2,}/.test(label);
}

// Simple in-memory caches to reduce network chatter during a session
const predictionCache = new Map<string, PlaceHit[]>();
const detailsCache = new Map<string, { lat: number; lng: number; name?: string; address?: string }>();

/**
 * searchPlaces queries MapTiler (if configured) or OSM Nominatim for a place string.
 * Returns a small list of { lat, lng, label } candidates, filtered to be English-like.
 * @param query The free-text place query entered by the user.
 * @param limit Maximum number of candidates to return (default 8).
 */
export async function searchPlaces(query: string, limit = 8): Promise<PlaceHit[]> {
  try {
    const q = query.trim();
    if (!q) return [];
    if (predictionCache.has(q)) return predictionCache.get(q)!;

    let results: PlaceHit[] = [];
    if (MAPTILER_KEY) {
      // MapTiler Geocoding (Mapbox-compatible API)
      const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${MAPTILER_KEY}&limit=${limit}&language=en`;
      const res = await fetch(url);
      const data: any = await res.json();
      if (data && Array.isArray(data.features)) {
        const raw = data.features.map((f: any) => {
          const [lng, lat] = f.center || f.geometry?.coordinates || [undefined, undefined];
          const label = f.place_name || f.text || f.properties?.name || q;
          const lbl = String(label).slice(0, 120);
          return (isFinite(lat) && isFinite(lng) && isEnglishLike(lbl)) ? { lat, lng, label: lbl } : undefined;
        }).filter(Boolean) as PlaceHit[];
  results = raw; // assign collected features
  if (__DEV__) try { console.debug('[searchPlaces] MapTiler hits', q, results.length); } catch {}
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
          const label = (it.display_name || it.name || q);
          const lbl = String(label).slice(0, 120);
          return (isFinite(lat) && isFinite(lng) && isEnglishLike(lbl)) ? { lat, lng, label: lbl } : undefined;
        }).filter(Boolean) as PlaceHit[];
        if (__DEV__) try { console.debug('[searchPlaces] Nominatim hits', q, results.length); } catch {}
      }
    }

    // If filters removed everything, fallback to a very loose parse of first few raw items (English filter may be too strict)
    if (!results.length && MAPTILER_KEY) {
      // Re-run MapTiler without English filter to salvage something
      try {
        const url2 = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${MAPTILER_KEY}&limit=${limit}`;
        const res2 = await fetch(url2);
        const data2: any = await res2.json();
        if (data2 && Array.isArray(data2.features)) {
          const raw2 = data2.features.map((f: any) => {
            const [lng, lat] = f.center || f.geometry?.coordinates || [undefined, undefined];
            const label = (f.place_name || f.text || f.properties?.name || q || '').slice(0,120);
            return (isFinite(lat) && isFinite(lng)) ? { lat, lng, label } : undefined;
          }).filter(Boolean) as PlaceHit[];
          if (raw2.length) {
            results = raw2;
            if (__DEV__) try { console.debug('[searchPlaces] MapTiler fallback (no filter) hits', q, results.length); } catch {}
          }
        }
      } catch {}
    }

    predictionCache.set(q, results);
    return results.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * clearPlacesCaches clears the in-memory geocoding caches for the current app session.
 */
export function clearPlacesCaches() {
  predictionCache.clear();
  detailsCache.clear();
}
