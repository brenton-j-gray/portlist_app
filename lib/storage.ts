import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip } from '../types';
import { normalizeTripsMedia } from './media';
import { pushTrips } from './sync';

const TRIPS_KEY = 'cjp_trips_v1';

export async function getTrips(): Promise<Trip[]> {
  const raw = await AsyncStorage.getItem(TRIPS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Trip[];
  } catch {
    return [];
  }
}

export async function saveTrips(trips: Trip[]): Promise<void> {
  const normalized = await normalizeTripsMedia(trips);
  await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(normalized));
  // Fire-and-forget push to cloud if authenticated
  try { pushTrips(); } catch {}
}

export async function addTrip(trip: Trip): Promise<void> {
  const all = await getTrips();
  all.push(trip);
  await saveTrips(all);
}

export async function getTripById(id: string): Promise<Trip | undefined> {
  const all = await getTrips();
  return all.find(t => t.id === id);
}

export async function upsertTrip(updated: Trip): Promise<void> {
  const all = await getTrips();
  const idx = all.findIndex(t => t.id === updated.id);
  if (idx >= 0) {
    all[idx] = updated;
  } else {
    all.push(updated);
  }
  await saveTrips(all);
}

export async function deleteTrip(id: string): Promise<void> {
  const all = await getTrips();
  const next = all.filter(t => t.id !== id);
  if (next.length !== all.length) {
    await saveTrips(next);
  }
}

export function uid(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
