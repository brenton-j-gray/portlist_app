import { Platform } from 'react-native';
import { Trip } from '../types';

/**
 * Export a Trip as a JSON file.
 * - Native (iOS/Android): writes to cache then opens share sheet.
 * - Web: triggers a browser download via Blob.
 * Dynamic imports avoid bundling unsupported native modules on web.
 */
export async function exportTripJSON(trip: Trip) {
  const fileName = `trip_${trip.id}.json`;
  try {
    if (Platform.OS === 'web') {
      const data = JSON.stringify(trip, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    // Native platforms: load modules only when needed
    const FileSystem = await import('expo-file-system');
    const Sharing = await import('expo-sharing');
    const fileUri = FileSystem.default.cacheDirectory + fileName;
    await FileSystem.default.writeAsStringAsync(
      fileUri,
      JSON.stringify(trip, null, 2),
      { encoding: FileSystem.default.EncodingType.UTF8 }
    );

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Export Trip Data' });
    } else {
      console.log('File saved at', fileUri);
    }
  } catch (e) {
    console.warn('Export failed', e);
  }
}
