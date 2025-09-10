import * as FileSystem from 'expo-file-system';
import type { Trip } from '../types';

const PHOTOS_DIR = (FileSystem.documentDirectory || '') + 'photos';

/**
 * Function ensurePhotosDir: TODO describe purpose and usage.
 * @returns {any} TODO: describe
 */
async function ensurePhotosDir() {
  try {
    if (!FileSystem.documentDirectory) return;
    const info = await FileSystem.getInfoAsync(PHOTOS_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
    }
  } catch { /* ignore */ }
}

/**
 * Function randomName: TODO describe purpose and usage.
 * @param {any} ext - TODO: describe
 * @returns {any} TODO: describe
 */
function randomName(ext: string) {
  const safe = ext.replace(/[^a-z0-9]/gi, '').slice(0, 6) || 'jpg';
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}.${safe}`;
}

/**
 * Function guessExtFromDataUri: TODO describe purpose and usage.
 * @param {any} data - TODO: describe
 * @returns {any} TODO: describe
 */
function guessExtFromDataUri(data: string) {
  const match = /^data:(image\/[^;]+);base64,/i.exec(data);
  if (match) {
    const mime = match[1];
    const sub = mime.split('/')[1];
    if (sub) return sub.toLowerCase();
  }
  return 'jpg';
}


/**
 * Function isEphemeralOrExternal: TODO describe purpose and usage.
 * @param {any} uri - TODO: describe
 * @returns {any} TODO: describe
 */
function isEphemeralOrExternal(uri: string): boolean {
  if (!uri) return false;
  const cache = FileSystem.cacheDirectory ?? '';
  if (uri.startsWith(cache)) return true; // cache can be cleared
  if (uri.startsWith('content://') || uri.startsWith('ph://')) return true;
  if (uri.startsWith('data:') || uri.startsWith('blob:')) return true;
  return false;
}

/**
 * Function persistPhotoUris: TODO describe purpose and usage.
 * @param {any} photos - TODO: describe
 * @returns {any} TODO: describe
 */
export async function persistPhotoUris(photos: { uri: string; caption?: string }[]): Promise<{ uri: string; caption?: string }[]> {
  if (!photos?.length) return photos;
  await ensurePhotosDir();
  const out: { uri: string; caption?: string }[] = [];
  for (const p of photos) {
    let { uri } = p;
    try {
      if (uri.startsWith('data:')) {
        const ext = guessExtFromDataUri(uri);
        const b64 = uri.split(',')[1];
        const fname = randomName(ext);
        const dest = `${PHOTOS_DIR}/${fname}`;
        await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 });
        uri = dest;
      } else if (uri.startsWith('blob:')) {
        // blob: not directly accessible; skip (leave as-is) or future fetch & write
      } else if (isEphemeralOrExternal(uri) && FileSystem.documentDirectory) {
        // Copy into persistent doc directory
        const extMatch = /\.([a-zA-Z0-9]{1,5})(?:\?|$)/.exec(uri);
        const ext = (extMatch?.[1] || 'jpg').toLowerCase();
        const dest = `${PHOTOS_DIR}/${randomName(ext)}`;
        try {
          await FileSystem.copyAsync({ from: uri, to: dest });
          uri = dest;
        } catch { /* ignore; keep original */ }
      }
    } catch { /* keep original uri */ }
    out.push({ ...p, uri });
  }
  return out;
}

/**
 * Function normalizeTripsMedia: TODO describe purpose and usage.
 * @param {any} trips - TODO: describe
 * @returns {any} TODO: describe
 */
export async function normalizeTripsMedia(trips: Trip[]): Promise<Trip[]> {
  const out: Trip[] = [];
  for (const t of trips) {
    const days = [] as Trip['days'];
    for (const d of t.days) {
  const photos = d.photos ?? (d.photoUri ? [{ uri: d.photoUri }] : []);
  const needsPersist = photos.some(p => isEphemeralOrExternal(p.uri));
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
/**
 * Function saveCameraPhotoToLibrary: TODO describe purpose and usage.
 * @param {any} localUri - TODO: describe
 * @returns {any} TODO: describe
 */
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
