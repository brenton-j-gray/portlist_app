import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateWithPrefs, usePreferences } from '../../../components/PreferencesContext';
import { useTheme } from '../../../components/ThemeContext';
import { shortLocationLabel } from '../../../lib/location';
import { getTileConfig } from '../../../lib/tiles';
import { persistPhotoUris, saveCameraPhotoToLibrary } from '../../../lib/media';
import { searchPlaces } from '../../../lib/places';
import { getTripById, uid, upsertTrip } from '../../../lib/storage';
import { SELECTABLE_WEATHER_OPTIONS, getWeatherColor } from '../../../lib/weather';
import { Note, Trip } from '../../../types';

export default function NewNoteScreen() {
  const { themeColors } = useTheme();
  const { prefs } = usePreferences();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | undefined>();
  const [date, setDate] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [weather, setWeather] = useState<string>(''); // codes like 'sunny','cloudy','rain','snow','storm'
  const [photos, setPhotos] = useState<{ uri: string; caption?: string }[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [locationLabel, setLocationLabel] = useState<string>('');
  const [mapType, setMapType] = useState<'standard' | 'hybrid'>('standard');
  const [isSeaDay, setIsSeaDay] = useState(false);
  const MapRef = useRef<any>(null);
  const [MapComponents, setMapComponents] = useState<null | { MapView: any; Marker: any; UrlTile?: any }>(null);
  const [MapLibre, setMapLibre] = useState<any>(null);
  const cameraRef = useRef<any>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Added color & emoji state
  const [color, setColor] = useState<string | undefined>(undefined);
  const [emoji, setEmoji] = useState<string | undefined>(undefined);
  // Location search state
  const [locationQuery, setLocationQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ lat: number; lng: number; label: string }[]>([]);
  // Removed continuous follow logic in favor of one-shot recenter control
  const tile = useMemo(() => getTileConfig(), []);

  function toISODate(d: Date) {
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function parseISODate(s: string | undefined): Date {
    if (!s) return new Date();
    const [y, m, d] = s.split('-').map((p) => parseInt(p, 10));
    if (!y || !m || !d) return new Date();
    return new Date(y, m - 1, d);
  }

  function onChangeDate(_event: DateTimePickerEvent, picked?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (picked) setDate(toISODate(picked));
  }

  function formatDisplayDate(iso: string): string {
    if (!iso) return '';
    return formatDateWithPrefs(iso, prefs, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

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
      // Dynamically import map only in dev client or standalone (not Expo Go)
      try {
        const inGo = Constants.appOwnership === 'expo';
        if (!inGo) {
          if (Platform.OS === 'android') {
            try {
              const mod = await import('@maplibre/maplibre-react-native');
              setMapLibre((mod as any).default || (mod as any));
              setMapComponents(null);
            } catch { setMapLibre(null); }
          } else if (!!UIManager.getViewManagerConfig?.('AIRMap')) {
            const mod = await import('react-native-maps');
            setMapComponents({ MapView: mod.default, Marker: (mod as any).Marker, UrlTile: (mod as any).UrlTile });
            setMapLibre(null);
          } else {
            setMapComponents(null);
            setMapLibre(null);
          }
        }
      } catch {
        setMapComponents(null); setMapLibre(null);
      }
    })();
  }, [id]);

  // Resolve a short human-readable label for the current location
  useEffect(() => {
    (async () => {
      if (!location) { setLocationLabel(''); return; }
      try {
        const results = await Location.reverseGeocodeAsync({ latitude: location.lat, longitude: location.lng });
        if (results && results.length) {
          const r = results[0];
          const label = shortLocationLabel(r as any, location.lat, location.lng);
          setLocationLabel(label || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);
        } else {
          setLocationLabel(`${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);
        }
      } catch {
        setLocationLabel(`${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);
      }
    })();
  }, [location]);

  async function onSave() {
    if (!trip) return;
    // Validate date within trip range if trip has dates
    if (date) {
      const d = parseISODate(date).getTime();
      if (trip.startDate) {
        const s = parseISODate(trip.startDate).getTime();
        if (d < s) {
          Alert.alert('Invalid date', 'Note date cannot be before the trip start date.');
          return;
        }
      }
      if (trip.endDate) {
        const e = parseISODate(trip.endDate).getTime();
        if (d > e) {
          Alert.alert('Invalid date', 'Note date cannot be after the trip end date.');
          return;
        }
      }
    }
    const persisted = await persistPhotoUris(photos);
    const log: Note = {
      id: uid(),
      date: date || toISODate(new Date()),
      title: title || undefined,
      description: description || undefined,
      weather: isSeaDay ? undefined : (weather || undefined),
      photos: persisted,
      location: isSeaDay ? undefined : (location ? { lat: location.lat, lng: location.lng } : undefined),
      locationName: isSeaDay ? undefined : (location ? (locationLabel || undefined) : undefined),
      isSeaDay: isSeaDay || undefined,
      color: color || undefined,
      emoji: emoji || undefined,
    };
    const updated: Trip = { ...trip, days: [...trip.days, log] };
    await upsertTrip(updated);
    router.replace(`/trips/${trip.id}`);
  }

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
      mediaTypes: ['images'],
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
    try {
      const region = { latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 };
      requestAnimationFrame(() => {
        if (MapRef.current?.animateToRegion) MapRef.current.animateToRegion(region, 350);
        else if (MapRef.current?.fitToCoordinates) MapRef.current.fitToCoordinates([{ latitude, longitude }], { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true });
      });
    } catch {}
  }

  // removed explicit one-shot location fetch (replaced by follow toggle)

  const weatherOptions = SELECTABLE_WEATHER_OPTIONS;

  // Debounced search effect
  useEffect(() => {
    if (!locationQuery.trim()) { setSearchResults([]); return; }
    // Only auto-search when user has typed a few chars
    if (locationQuery.trim().length < 3) { setSearchResults([]); return; }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await geocodeToLabel(locationQuery);
        setSearchResults(results);
      } catch { setSearchResults([]); } finally { setSearching(false); }
    }, 500); // 500ms debounce
    return () => clearTimeout(handle);
  }, [locationQuery]);

  async function recenterOnUser() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const cur = await Location.getCurrentPositionAsync({});
      const lat = cur.coords.latitude; const lng = cur.coords.longitude;
      setLocation({ lat, lng });
      requestAnimationFrame(() => {
        const region = { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 } as any;
        if (MapRef.current?.animateToRegion) MapRef.current.animateToRegion(region, 400);
      });
    } catch {}
  }

  // When the native MapView becomes available, default the map to the user's current location
  useEffect(() => {
    (async () => {
      try {
        if (!MapComponents) return; // only when native map is present
        if (location) return; // don't override an explicit selection
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const cur = await Location.getCurrentPositionAsync({});
        const lat = cur.coords.latitude; const lng = cur.coords.longitude;
        setLocation({ lat, lng });
        requestAnimationFrame(() => {
          const region = { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 } as any;
          if (MapRef.current?.animateToRegion) MapRef.current.animateToRegion(region, 400);
          else if (MapRef.current?.fitToCoordinates) MapRef.current.fitToCoordinates([{ latitude: lat, longitude: lng }], { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true });
        });
      } catch {}
    })();
  }, [MapComponents, location]);

  async function doSearch() {
    if (!locationQuery.trim()) return;
    setSearching(true);
    try {
      const results = await geocodeToLabel(locationQuery);
      setSearchResults(results);
    } catch { setSearchResults([]); } finally { setSearching(false); }
  }

  function selectSearched(r: { lat: number; lng: number; label: string }) {
    setLocation({ lat: r.lat, lng: r.lng });
    setLocationLabel(r.label);
    setSearchResults([]);
    // Center map
    try {
      const region = { latitude: r.lat, longitude: r.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 } as any;
      requestAnimationFrame(() => {
        if (MapRef.current?.animateToRegion) MapRef.current.animateToRegion(region, 350);
      });
    } catch {}
    // Reverse lookup for refined label (async, non-blocking)
    (async () => {
      try {
        const results = await Location.reverseGeocodeAsync({ latitude: r.lat, longitude: r.lng });
        if (results && results.length) {
          const refined = shortLocationLabel(results[0] as any, r.lat, r.lng) || buildLabel(results[0]);
          if (refined) setLocationLabel(refined);
        }
      } catch {}
    })();
  }

  // Replace canSave definition to include color/emoji as valid content triggers
  const canSave = isSeaDay ? !!date : !!(
    (title && title.trim()) ||
    (description && description.trim()) ||
  (weather && weather.trim()) ||
    (photos && photos.length) ||
    location || color || emoji
  );

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 14, backgroundColor: themeColors.background },
    section: { borderWidth: 1, borderColor: themeColors.primary, borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: themeColors.card },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'space-between', gap: 12 },
  inlineInput: { flex: 1, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  dateBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card },
    dateText: { color: themeColors.text, fontSize: 13, fontWeight: '600' },
    label: { fontSize: 12, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 },
  textArea: { borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, padding: 10, minHeight: 110, textAlignVertical: 'top' },
    btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    btn: { backgroundColor: themeColors.primary, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', flex: 1 },
    btnText: { color: themeColors.badgeText, fontWeight: '700' },
    photoList: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 10 },
    photoThumb: { width: 90, height: 90, borderRadius: 8, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.menuBorder },
    saveBtn: { backgroundColor: themeColors.primary, paddingVertical: 18, borderRadius: 14, alignItems: 'center', opacity: canSave ? 1 : 0.55, marginTop: 4 },
    saveBtnText: { color: themeColors.badgeText, fontWeight: '700', fontSize: 16 },
    weatherRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  weatherChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card },
    mapBox: { height: 240, borderRadius: 12, overflow: 'hidden', marginTop: 8 },
    overlayBtn: { position: 'absolute', bottom: 10, right: 10, backgroundColor: themeColors.card, borderRadius: 26, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: themeColors.primary, flexDirection: 'row', alignItems: 'center', gap: 6 },
    overlayToggle: { position: 'absolute', bottom: 10, left: 10, backgroundColor: themeColors.card, borderRadius: 26, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: themeColors.primary },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    colorSwatch: { width: 38, height: 38, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card },
    emojiBtnActive: { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '22' },
    locationSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  locationSearchInput: { flex: 1, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
    locationSearchBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: themeColors.primary, alignItems: 'center', justifyContent: 'center' },
    locationResults: { marginTop: 8, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, borderRadius: 10, overflow: 'hidden', position: 'relative', zIndex: 50, elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
    locationResultItem: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.menuBorder },
    locationResultItemLast: { borderBottomWidth: 0 },
    dayTypeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  dayTypeChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card },
    dayTypeChipActive: { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '22' },
  }), [themeColors, canSave]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: Math.max(32, (insets?.bottom || 0) + 24) }}>
      {/* Section: Title & Date (inline) */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <TextInput style={styles.inlineInput} placeholder="Title" placeholderTextColor={themeColors.textSecondary} value={title} onChangeText={setTitle} />
          <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateBtn} accessibilityLabel="Choose date">
            <Text style={styles.dateText}>{date ? formatDisplayDate(date) : 'Pick a date'}</Text>
          </Pressable>
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={parseISODate(date)}
            mode="date"
            display={Platform.select({ android: 'calendar', ios: 'spinner', default: 'default' }) as any}
            onChange={onChangeDate}
          />
        )}
        <View style={styles.dayTypeRow}>
          <Pressable onPress={() => setIsSeaDay(false)} style={[styles.dayTypeChip, !isSeaDay && styles.dayTypeChipActive]} accessibilityLabel="Port or destination day">
            <Text style={{ color: !isSeaDay ? themeColors.primaryDark : themeColors.textSecondary, fontSize: 12 }}>Port / Destination</Text>
          </Pressable>
          <Pressable onPress={() => setIsSeaDay(true)} style={[styles.dayTypeChip, isSeaDay && styles.dayTypeChipActive]} accessibilityLabel="Sea day">
            <Text style={{ color: isSeaDay ? themeColors.primaryDark : themeColors.textSecondary, fontSize: 12 }}>Sea Day</Text>
          </Pressable>
        </View>
      </View>

      {/* Section: Notes (description merged as Notes textarea) */}
      <View style={styles.section}>
        <Text style={styles.label}>Notes</Text>
        <TextInput style={styles.textArea} multiline placeholder="Notes about the day" placeholderTextColor={themeColors.textSecondary} value={description} onChangeText={setDescription} />
      </View>

      {/* Section: Weather */}
      {!isSeaDay && (
        <View style={styles.section}>
          <Text style={styles.label}>Weather</Text>
          <View style={styles.weatherRow}>
            {weatherOptions.map(opt => {
              const tint = getWeatherColor(opt.key, themeColors.primaryDark);
              const active = weather === opt.key;
              return (
                <Pressable key={opt.key} onPress={() => setWeather(opt.key)} style={[styles.weatherChip, active && { borderColor: tint, backgroundColor: tint + '22' }]} accessibilityLabel={`Weather ${opt.label}`}>
                  <Ionicons name={opt.icon as any} size={14} color={tint} />
                  <Text style={{ color: active ? tint : themeColors.textSecondary, fontSize: 12 }}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Section: Photos */}
      <View style={styles.section}>
        <Text style={styles.label}>Photos</Text>
        <View style={styles.btnRow}>
          <Pressable onPress={pickFromLibrary} style={styles.btn} accessibilityLabel="Pick photos from library">
            <Text style={styles.btnText}>Add</Text>
          </Pressable>
          <Pressable onPress={takePhoto} style={styles.btn} accessibilityLabel="Take a photo">
            <Text style={styles.btnText}>Camera</Text>
          </Pressable>
        </View>
        {!!photos.length && (
          <View style={styles.photoList}>
            {photos.map((p, idx) => (
              <Image key={`${p.uri}-${idx}`} source={{ uri: p.uri }} style={styles.photoThumb} />
            ))}
          </View>
        )}
      </View>

      {/* Section: Location + Map */}
      {!isSeaDay && (
        <View style={styles.section}>
          <Text style={styles.label}>Location</Text>
          <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>
            {location ? locationLabel : 'No location selected'}
          </Text>
          <View style={styles.locationSearchRow}>
            <TextInput
              style={styles.locationSearchInput}
              placeholder="Search location"
              placeholderTextColor={themeColors.textSecondary}
              value={locationQuery}
              onChangeText={setLocationQuery}
              returnKeyType="search"
              onSubmitEditing={() => doSearch()}
            />
            <Pressable style={[styles.locationSearchBtn, (!locationQuery.trim() || searching) && { opacity: 0.6 }]} disabled={!locationQuery.trim() || searching} onPress={() => doSearch()} accessibilityLabel="Search for location">
              {searching ? <ActivityIndicator size="small" color={themeColors.badgeText} /> : <Ionicons name="search" size={18} color={themeColors.badgeText} />}
            </Pressable>
          </View>
          {!!searchResults.length && (
            <View style={styles.locationResults}>
              {searchResults.map((r, idx) => (
                <Pressable key={`${r.lat}_${r.lng}_${idx}`} onPress={() => selectSearched(r)} style={[styles.locationResultItem, idx === searchResults.length - 1 && styles.locationResultItemLast]} accessibilityLabel={`Select ${r.label}`}>
                  <Text style={{ color: themeColors.text }}>{r.label}</Text>
                  <Text style={{ color: themeColors.textSecondary, fontSize: 11 }}>{r.lat.toFixed(4)}, {r.lng.toFixed(4)}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {Platform.OS === 'android' && MapLibre ? (
            <View style={styles.mapBox}>
              <MapLibre.MapView style={{ flex: 1 }} styleURL={tile.styleURL || undefined}
                onLongPress={(e: any) => {
                  try {
                    const coords = e?.geometry?.coordinates || e?.coordinates;
                    if (coords && coords.length >= 2) {
                      onMapPress({ nativeEvent: { coordinate: { latitude: coords[1], longitude: coords[0] } } });
                    }
                  } catch {}
                }}
              >
                <MapLibre.Camera ref={cameraRef}
                  centerCoordinate={[ location?.lng || -122.4324, location?.lat || 37.78825 ]}
                  zoomLevel={12}
                />
                {location && (
                  <MapLibre.PointAnnotation id="picked_loc" coordinate={[location.lng, location.lat]}>
                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: themeColors.accent, borderWidth: 2, borderColor: '#fff' }} />
                  </MapLibre.PointAnnotation>
                )}
              </MapLibre.MapView>
              {/* Map type toggle removed on Android to avoid Google base map */}
              <Pressable onPress={recenterOnUser} style={styles.overlayBtn} accessibilityLabel="Recenter on me">
                <Ionicons name="locate" size={16} color={themeColors.primary} />
                <Text style={{ color: themeColors.primary, fontWeight: '600', fontSize: 12 }}>Recenter</Text>
              </Pressable>
              <View style={{ position: 'absolute', bottom: 6, left: 8 }} pointerEvents="none">
                <Text style={{ color: themeColors.textSecondary, fontSize: 10 }}>{tile.attribution}</Text>
              </View>
            </View>
          ) : (MapComponents ? (
            <View style={styles.mapBox}>
              <MapComponents.MapView style={{ flex: 1 }}
                initialRegion={{ latitude: location?.lat || 37.78825, longitude: location?.lng || -122.4324, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
                onPress={onMapPress}
                mapType={Platform.OS === 'android' ? ('none' as any) : mapType}
                ref={MapRef}
              >
                {MapComponents.UrlTile ? (
                  <MapComponents.UrlTile urlTemplate={tile.urlTemplate} maximumZ={19} flipY={false} />
                ) : null}
                {location && (
                  <MapComponents.Marker coordinate={{ latitude: location.lat, longitude: location.lng }} />
                )}
              </MapComponents.MapView>
              {/* Map type toggle removed on Android to avoid Google base map */}
              {Platform.OS !== 'android' && (
                <Pressable onPress={() => setMapType(m => m === 'standard' ? 'hybrid' : 'standard')} style={styles.overlayToggle} accessibilityLabel="Toggle map type">
                  <Text style={{ color: themeColors.primary, fontWeight: '600', fontSize: 12 }}>{mapType === 'standard' ? 'Satellite' : 'Map'}</Text>
                </Pressable>
              )}
              <Pressable onPress={recenterOnUser} style={styles.overlayBtn} accessibilityLabel="Recenter on me">
                <Ionicons name="locate" size={16} color={themeColors.primary} />
                <Text style={{ color: themeColors.primary, fontWeight: '600', fontSize: 12 }}>Recenter</Text>
              </Pressable>
              <View style={{ position: 'absolute', bottom: 6, left: 8 }} pointerEvents="none">
                <Text style={{ color: themeColors.textSecondary, fontSize: 10 }}>{tile.attribution}</Text>
              </View>
            </View>
          ) : (
            <Text style={{ color: themeColors.textSecondary, marginTop: 8, fontSize: 12 }}>Map preview unavailable.</Text>
          )}
        </View>
      )}

      {/* Section: Color */}
      <View style={styles.section}>
        <Text style={styles.label}>Note Color</Text>
        <View style={styles.colorRow}>
          {['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0891b2','#d97706','#475569'].map(c => {
            const active = color === c;
            return (
              <Pressable key={c} onPress={() => setColor(active ? undefined : c)} accessibilityLabel={`Select color ${c}`} style={[styles.colorSwatch, { backgroundColor: c + '26', borderColor: active ? c : 'transparent' }]}> 
                {active && <Ionicons name="checkmark" size={20} color={c} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Section: Emoji */}
      <View style={styles.section}>
        <Text style={styles.label}>Emoji</Text>
        <View style={styles.emojiRow}>
          {['😀','🛳️','📍','🌞','🌧️','📷','⭐','🎉','🍹','🗺️','🐬','⚓'].map(e => {
            const active = emoji === e;
            return (
              <Pressable key={e} onPress={() => setEmoji(active ? undefined : e)} accessibilityLabel={`Select emoji ${e}`} style={[styles.emojiBtn, active && styles.emojiBtnActive]}>
                <Text style={{ fontSize: 20 }}>{e}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Save */}
      <Pressable onPress={onSave} style={styles.saveBtn} disabled={!canSave} accessibilityLabel="Save note">
        <Text style={styles.saveBtnText}>Save Note</Text>
      </Pressable>
    </ScrollView>
  );
}

async function geocodeToLabel(query: string): Promise<{ lat: number; lng: number; label: string }[]> {
  try {
    if (!query.trim()) return [];
  // Prefer MapTiler Geocoding (if key provided), then OSM Nominatim
  const placeHits = await searchPlaces(query.trim());
  if (placeHits.length) return placeHits;
    const results = await Location.geocodeAsync(query.trim());
    const top = results.slice(0, 8);
    // Attempt reverse lookup to enrich labels when minimal info
    const enriched = await Promise.all(top.map(async (r, idx) => {
      let label = buildLabel(r);
      if (!label || /^[-0-9.,\s]+$/.test(label)) {
        try {
          if (idx < 5) { // limit reverse lookups
            const rev = await Location.reverseGeocodeAsync({ latitude: r.latitude, longitude: r.longitude });
            if (rev && rev.length) {
              const rr = rev[0] as any;
              const better = buildLabel(rr) || shortLocationLabel(rr, r.latitude, r.longitude);
              if (better) label = better;
            }
          }
        } catch {}
      }
      if (!label) label = `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`;
      return { lat: r.latitude, lng: r.longitude, label };
    }));
    return enriched;
  } catch { return []; }
}

function buildLabel(r: any): string {
  const parts = [r.name, r.street, r.city, r.region, r.country].filter(Boolean);
  const uniq: string[] = [];
  parts.forEach(p => { if (p && !uniq.includes(p)) uniq.push(p); });
  return uniq.slice(0, 3).join(', ');
}

// styles via useMemo above
