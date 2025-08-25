import { NativeModules, Platform } from 'react-native';
import { Trip } from '../types';

const Native = (NativeModules as any).CountdownWidget as undefined | {
  setTrip(id: string, title: string, startDate?: string): Promise<void>;
  clearTrip(): Promise<void>;
};

export async function setCountdownTrip(trip: Trip) {
  if (Platform.OS !== 'android') return; // iOS widget requires separate implementation (WidgetKit)
  if (!Native) return;
  await Native.setTrip(trip.id, trip.title, trip.startDate);
}

export async function clearCountdownTrip() {
  if (Platform.OS !== 'android') return;
  if (!Native) return;
  await Native.clearTrip();
}
