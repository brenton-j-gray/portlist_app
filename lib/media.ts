import * as FileSystem from 'expo-file-system';
import type { Trip } from '../types';

export async function persistPhotoUris(photos: { uri: string; caption?: string }[]): Promise<{ uri: string; caption?: string }[]> {
  if (!photos?.length) return photos;
  // Native only: keep original URIs; no web persistence needed
  return photos;
}

function isLocalUri(uri: string): boolean {
  if (!uri) return false;
  const doc = FileSystem.documentDirectory ?? '';
  const cache = FileSystem.cacheDirectory ?? '';
  // Treat common native URIs as local: file://, content:// (Android), ph:// (iOS Photos assets)
  return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://') || uri.startsWith(doc) || uri.startsWith(cache);
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

// Save a newly captured local file to the user's Photos library and return the library URI.
// On failure or when not supported, return the original URI.
export async function saveCameraPhotoToLibrary(localUri: string): Promise<string> {
  try {
    const MediaLibrary = await import('expo-media-library');
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') return localUri;
    const asset = await MediaLibrary.createAssetAsync(localUri);
    return asset?.uri || localUri;
  } catch {
    return localUri;
  }
}
