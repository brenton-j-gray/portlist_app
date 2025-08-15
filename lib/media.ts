import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import type { Trip } from '../types';
import { uid } from './storage';

// Prefer documentDirectory on native, fall back to cacheDirectory (works on web)
const BASE_DIR = (FileSystem.documentDirectory ?? FileSystem.cacheDirectory) ?? undefined;
const IMAGES_DIR = BASE_DIR ? `${BASE_DIR}images/` : undefined;

async function ensureImagesDir() {
  if (!IMAGES_DIR) return;
  const info = await FileSystem.getInfoAsync(IMAGES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
  }
}

function guessExtension(mime: string | null): string {
  if (!mime) return '.jpg';
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  return '.jpg';
}

export async function persistPhotoUris(photos: { uri: string; caption?: string }[]): Promise<{ uri: string; caption?: string }[]> {
  if (!photos?.length) return photos;
  await ensureImagesDir();
  const results: { uri: string; caption?: string }[] = [];
  for (const p of photos) {
    const src = p.uri;
    try {
      if (Platform.OS === 'web') {
        // Convert blob/data URLs to a persisted file in IndexedDB via FileSystem
        const res = await fetch(src);
        const blob = await res.blob();
        const mime = blob.type || 'image/jpeg';
        const ext = guessExtension(mime);
        const base = IMAGES_DIR ?? (FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}images/` : 'fs://images/');
        const dest = `${base}${uid()}${ext}`;
        // Convert blob to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Failed to read blob'));
          reader.onload = () => {
            const dataUrl = String(reader.result || '');
            const idx = dataUrl.indexOf('base64,');
            resolve(idx >= 0 ? dataUrl.slice(idx + 7) : '');
          };
          reader.readAsDataURL(blob);
        });
        await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
        results.push({ uri: dest, caption: p.caption });
      } else {
        // Native: copy to app documentDirectory/images
        const extMatch = src.match(/\.[a-zA-Z0-9]+$/);
        const ext = extMatch ? extMatch[0] : '.jpg';
        const base = IMAGES_DIR ?? (FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? 'file://');
        const dest = `${base}${uid()}${ext}`;
        await FileSystem.copyAsync({ from: src, to: dest });
        results.push({ uri: dest, caption: p.caption });
      }
  } catch {
      // Fallback: keep original URI if persistence fails
      results.push({ uri: src, caption: p.caption });
    }
  }
  return results;
}

function isLocalUri(uri: string): boolean {
  if (!uri) return false;
  if (Platform.OS === 'web') {
    const doc = FileSystem.documentDirectory ?? '';
    const cache = FileSystem.cacheDirectory ?? '';
    return uri.startsWith(doc) || uri.startsWith(cache) || uri.startsWith('fs://');
  }
  const doc = FileSystem.documentDirectory ?? '';
  const cache = FileSystem.cacheDirectory ?? '';
  return uri.startsWith('file://') || uri.startsWith(doc) || uri.startsWith(cache);
}

export async function normalizeTripsMedia(trips: Trip[]): Promise<Trip[]> {
  const out: Trip[] = [];
  for (const t of trips) {
    const days = [] as Trip['days'];
    for (const d of t.days) {
      const photos = d.photos ?? (d.photoUri ? [{ uri: d.photoUri }] : []);
      const needsPersist = photos.some(p => p.uri.startsWith('data:') || p.uri.startsWith('blob:') || !isLocalUri(p.uri));
      let newPhotos = photos;
      if (needsPersist) {
        newPhotos = await persistPhotoUris(photos);
      }
      days.push({ ...d, photos: newPhotos, photoUri: undefined });
    }
    out.push({ ...t, days });
  }
  return out;
}
