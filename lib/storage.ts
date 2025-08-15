import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { Trip } from '../types';
import { normalizeTripsMedia } from './media';

const TRIPS_KEY = 'cjp_trips_v1';

export async function getTrips(): Promise<Trip[]> {
  const raw = await AsyncStorage.getItem(TRIPS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    // Support FS-backed pointer on web to bypass localStorage quota
    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed as any).__fsPath && typeof (parsed as any).__fsPath === 'string'
    ) {
      const fsPath = (parsed as any).__fsPath as string;
      try {
        const content = await FileSystem.readAsStringAsync(fsPath, { encoding: FileSystem.EncodingType.UTF8 });
        return JSON.parse(content) as Trip[];
      } catch {
        return [];
      }
    }
    return parsed as Trip[];
  } catch {
    return [];
  }
}

export async function saveTrips(trips: Trip[]): Promise<void> {
  const normalized = await normalizeTripsMedia(trips);
  const json = JSON.stringify(normalized);
  // If on web and payload is large, write to FileSystem and store a pointer in AsyncStorage
  if (Platform.OS === 'web') {
    const threshold = 4_000_000; // ~4MB to stay under localStorage limits
    if (json.length > threshold) {
      await writeTripsToFSAndPoint(normalized);
      return;
    }
    try {
      await AsyncStorage.setItem(TRIPS_KEY, json);
      return;
    } catch {
      // Fallback to FS pointer if setItem still fails
      await writeTripsToFSAndPoint(normalized);
      return;
    }
  }
  await AsyncStorage.setItem(TRIPS_KEY, json);
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

// --- Internal helpers: FS-backed storage for large payloads (mainly web) ---

async function ensureKVDir() {
  const base = (FileSystem.documentDirectory ?? FileSystem.cacheDirectory) ?? undefined;
  if (!base) return undefined;
  const dir = `${base}kv/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

async function writeTripsToFSAndPoint(trips: Trip[]) {
  const dir = await ensureKVDir();
  if (!dir) {
    // Last resort: try setItem anyway to avoid data loss
    await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
    return;
  }
  const filePath = `${dir}trips.json`;
  await FileSystem.writeAsStringAsync(filePath, JSON.stringify(trips), { encoding: FileSystem.EncodingType.UTF8 });
  const pointer = JSON.stringify({ __fsPath: filePath, v: 1 });
  await AsyncStorage.setItem(TRIPS_KEY, pointer);
}