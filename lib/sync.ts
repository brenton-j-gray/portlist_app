import { getToken } from './api';
import { getTrips, saveTrips } from './storage';

const API_URL = (process.env.EXPO_PUBLIC_API_URL as string) || (global as any).__API_URL__ || 'http://localhost:4000';

async function authFetch(path: string, init?: RequestInit) {
  const token = await getToken();
  if (!token) throw new Error('not_authenticated');
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {})
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Pull cloud backup; if newer than local, replace local.
export async function pullTripsIfNewer(): Promise<boolean> {
  try {
  const cloud = await authFetch('/sync/trips', { method: 'GET' });
    const localUpdated = (global as any).__TRIPS_UPDATED_AT__ || 0;
    const cloudUpdated = cloud?.updatedAt || 0;
    if (cloudUpdated > localUpdated) {
      await saveTrips(cloud.trips || []);
      (global as any).__TRIPS_UPDATED_AT__ = cloudUpdated;
      return true;
    }
  } catch {
    // ignore offline or unauthorized
  }
  return false;
}

// Push local trips to cloud (last-write-wins)
export async function pushTrips(): Promise<boolean> {
  try {
    const trips = await getTrips();
    const res = await authFetch('/sync/trips', { method: 'PUT', body: JSON.stringify({ trips }) });
    (global as any).__TRIPS_UPDATED_AT__ = res?.updatedAt || Date.now();
    return true;
  } catch {
    return false;
  }
}

// Sync helper: try pull, then push. Use on app focus or after local saves.
export async function syncTripsBackground() {
  await pullTripsIfNewer();
  await pushTrips();
}
