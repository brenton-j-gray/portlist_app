import { Trip } from '../../../types';

/**
 * Export a Trip as a JSON file.
 * Native (iOS/Android): writes to cache then opens share sheet.
 */
export async function exportTripJSON(trip: Trip) {
  const fileName = `trip_${trip.id}.json`;
  try {
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


