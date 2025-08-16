import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import { useTheme } from '../../../components/ThemeContext';
import { persistPhotoUris, saveCameraPhotoToLibrary } from '../../../lib/media';
import { getTripById, uid, upsertTrip } from '../../../lib/storage';
import { DayLog, Trip } from '../../../types';

export default function NewDayLogScreen() {
  const { themeColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | undefined>();
  const [date, setDate] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [weather, setWeather] = useState<string>(''); // codes like 'sunny','cloudy','rain','snow','storm'
  const [notes, setNotes] = useState<string>(''); // kept for backward compatibility
  const [photos, setPhotos] = useState<{ uri: string; caption?: string }[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const MapRef = useRef<any>(null);
  const [MapComponents, setMapComponents] = useState<null | { MapView: any; Marker: any }>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const t = await getTripById(id);
      setTrip(t);
      // Request media library & camera permission
      await ImagePicker.requestMediaLibraryPermissionsAsync();
      await ImagePicker.requestCameraPermissionsAsync();
      // Request location (optional)
      await Location.requestForegroundPermissionsAsync();
      // Dynamically import map only in dev client or standalone (not Expo Go),
      // and only if the native AIRMap view manager exists in this binary
      try {
        const inGo = Constants.appOwnership === 'expo';
        const hasAirMap = Platform.OS !== 'web' && !!UIManager.getViewManagerConfig?.('AIRMap');
        if (!inGo && hasAirMap) {
          const mod = await import('react-native-maps');
          setMapComponents({ MapView: mod.default, Marker: (mod as any).Marker });
        } else {
          setMapComponents(null);
        }
      } catch {
        setMapComponents(null);
      }
    })();
  }, [id]);

  async function onSave() {
    if (!trip) return;
    const persisted = await persistPhotoUris(photos);
    const log: DayLog = {
      id: uid(),
      date: date || new Date().toISOString().slice(0,10),
      title: title || undefined,
      description: description || undefined,
      weather: weather || undefined,
      notes: notes || undefined,
      photos: persisted,
      location: location ? { lat: location.lat, lng: location.lng } : undefined,
    };
    const updated: Trip = { ...trip, days: [...trip.days, log] };
    await upsertTrip(updated);
    router.replace(`/trips/${trip.id}`);
  }

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 6,
    });
    if (!result.canceled) {
      const newPhotos = result.assets.map(a => ({ uri: a.uri }));
      setPhotos(prev => [...prev, ...newPhotos]);
    }
  }

  async function takePhoto() {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      const mapped = await Promise.all(
        result.assets.map(async a => ({ uri: await saveCameraPhotoToLibrary(a.uri) }))
      );
      setPhotos(prev => [...prev, ...mapped]);
    }
  }

  function onMapPress(e: any) {
    if (!e?.nativeEvent?.coordinate) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLocation({ lat: latitude, lng: longitude });
  }

  async function useCurrentLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {}
  }

  const weatherOptions: { key: string; label: string; icon: any }[] = [
    { key: 'sunny', label: 'Sunny', icon: 'sunny-outline' },
    { key: 'cloudy', label: 'Cloudy', icon: 'cloud-outline' },
    { key: 'rain', label: 'Rain', icon: 'rainy-outline' },
    { key: 'storm', label: 'Storm', icon: 'thunderstorm-outline' },
    { key: 'snow', label: 'Snow', icon: 'snow-outline' },
  ];

  const canSave = !!(
    (title && title.trim()) ||
    (description && description.trim()) ||
    (weather && weather.trim()) ||
    (notes && notes.trim()) ||
    (photos && photos.length) ||
    location
  );

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: themeColors.background },
    title: { fontSize: 22, fontWeight: '600', marginBottom: 12, color: themeColors.text },
    input: { borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, padding: 10, marginBottom: 10 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 4, marginLeft: 2, color: themeColors.textSecondary },
  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  btn: { backgroundColor: themeColors.primary, padding: 12, borderRadius: 10, alignItems: 'center', flex: 1 },
    btnText: { color: themeColors.badgeText, fontWeight: '700' },
    photoList: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 12 },
    photoThumb: { width: 96, height: 96, borderRadius: 8, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.menuBorder },
  saveBtn: { backgroundColor: themeColors.primary, padding: 12, borderRadius: 10, alignItems: 'center', opacity: canSave ? 1 : 0.6 },
  weatherRow: { flexDirection: 'row', gap: 10, marginBottom: 10, flexWrap: 'wrap' },
  weatherChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card },
  weatherChipActive: { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '22' },
  mapBox: { height: 220, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: themeColors.menuBorder, marginBottom: 10 },
  }), [themeColors, canSave]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
  <Text style={styles.title}>New Log</Text>
      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} placeholder="Title (optional)" placeholderTextColor={themeColors.textSecondary} value={title} onChangeText={setTitle} />
  <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" placeholderTextColor={themeColors.textSecondary} value={date} onChangeText={setDate} />
      <Text style={styles.label}>Weather</Text>
      <View style={styles.weatherRow}>
        {weatherOptions.map(opt => (
          <Pressable key={opt.key} onPress={() => setWeather(opt.key)} style={[styles.weatherChip, weather === opt.key && styles.weatherChipActive]} accessibilityLabel={`Weather ${opt.label}`}>
            <Ionicons name={opt.icon as any} size={16} color={weather === opt.key ? themeColors.primaryDark : themeColors.textSecondary} />
            <Text style={{ color: weather === opt.key ? themeColors.primaryDark : themeColors.textSecondary }}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Description</Text>
      <TextInput style={[styles.input, { height: 120 }]} multiline placeholder="Description (optional)" placeholderTextColor={themeColors.textSecondary} value={description} onChangeText={setDescription} />
      <Text style={styles.label}>Notes</Text>
      <TextInput style={[styles.input, { height: 100 }]} multiline placeholder="Notes (optional)" placeholderTextColor={themeColors.textSecondary} value={notes} onChangeText={setNotes} />
      <Text style={styles.label}>Location</Text>
      {MapComponents ? (
        <View style={styles.mapBox}>
          <MapComponents.MapView style={{ flex: 1 }}
            initialRegion={{ latitude: location?.lat || 37.78825, longitude: location?.lng || -122.4324, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
            onPress={onMapPress}
            ref={MapRef}
          >
            {location && (
              <MapComponents.Marker coordinate={{ latitude: location.lat, longitude: location.lng }} />
            )}
          </MapComponents.MapView>
        </View>
      ) : (
        <Text style={{ color: themeColors.textSecondary, marginBottom: 8 }}>
          Map preview is unavailable in this build. You can still tag with your current location.
        </Text>
      )}
      <View style={styles.btnRow}>
        <Pressable onPress={useCurrentLocation} style={[styles.btn, { backgroundColor: themeColors.actionBtnBg, borderWidth: 1, borderColor: themeColors.primaryDark + '29' }]} accessibilityLabel="Use current location">
          <Text style={[styles.btnText, { color: themeColors.text }]}>Use Current Location</Text>
        </Pressable>
        {location && (
          <Pressable onPress={() => setLocation(undefined)} style={[styles.btn, { backgroundColor: themeColors.danger }]} accessibilityLabel="Clear location">
            <Text style={styles.btnText}>Clear</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.btnRow}>
        <Pressable onPress={pickFromLibrary} style={styles.btn} accessibilityLabel="Pick photos from library">
          <Text style={styles.btnText}>Add Photos</Text>
        </Pressable>
        <Pressable onPress={takePhoto} style={styles.btn} accessibilityLabel="Take a photo">
          <Text style={styles.btnText}>Take Photo</Text>
        </Pressable>
      </View>
      {!!photos.length && (
        <View style={styles.photoList}>
          {photos.map((p, idx) => (
            <Image key={`${p.uri}-${idx}`} source={{ uri: p.uri }} style={styles.photoThumb} />
          ))}
        </View>
      )}
  <Pressable onPress={onSave} style={styles.saveBtn} disabled={!canSave}>
        <Text style={styles.btnText}>Save Log</Text>
      </Pressable>
    </ScrollView>
  );
}
// styles via useMemo above
