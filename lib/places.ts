// Google Places / Geocoding helper.
// Uses the Places Autocomplete + Place Details endpoints to build rich labels.
// Requires an environment variable EXPO_PUBLIC_GOOGLE_PLACES_KEY (public, restricted key).
// Falls back to empty result if key missing or quota exceeded.

export interface PlaceHit { lat: number; lng: number; label: string }

const KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;

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
    if (!KEY) return [];
    const q = query.trim();
    if (!q) return [];
    if (predictionCache.has(q)) return predictionCache.get(q)!;

    const autoUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=geocode&components=country&key=${KEY}`;
    const autoRes = await fetch(autoUrl);
    const autoJson: any = await autoRes.json();
    if (autoJson.status !== 'OK' || !autoJson.predictions?.length) {
      predictionCache.set(q, []);
      return [];
    }
    const predictions: any[] = autoJson.predictions.slice(0, limit);
    // Fetch details in parallel (cap at 5 to limit quota)
    const detailPromises = predictions.map(async (p, idx) => {
      try {
        const pid = p.place_id;
        if (detailsCache.has(pid)) return { prediction: p, details: detailsCache.get(pid)! };
        if (idx >= 5) return { prediction: p, details: null }; // defer details beyond first 5
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pid}&fields=geometry,name,formatted_address&key=${KEY}`;
        const res = await fetch(url);
        const json: any = await res.json();
        if (json.status !== 'OK') return { prediction: p, details: null };
        const det = json.result;
        const val = {
          lat: det.geometry?.location?.lat,
            lng: det.geometry?.location?.lng,
            name: det.name,
            address: det.formatted_address,
        };
        if (val.lat && val.lng) detailsCache.set(pid, val);
        return { prediction: p, details: val };
      } catch { return { prediction: p, details: null }; }
    });

    const withDetails = await Promise.all(detailPromises);
    const hits: PlaceHit[] = withDetails.map(({ prediction, details }) => {
      const lat = details?.lat;
      const lng = details?.lng;
      const label = buildLabel(details?.name, details?.address) || prediction.description || q;
      return lat && lng ? { lat, lng, label } : undefined;
    }).filter(Boolean) as PlaceHit[];

    predictionCache.set(q, hits);
    return hits;
  } catch {
    return [];
  }
}

export function clearPlacesCaches() {
  predictionCache.clear();
  detailsCache.clear();
}
