import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateWithPrefs, usePreferences } from '../../../../../components/PreferencesContext';
import { useTheme } from '../../../../../components/ThemeContext';
import { shortLocationLabel } from '../../../../../lib/location';
import { persistPhotoUris, saveCameraPhotoToLibrary } from '../../../../../lib/media';
import { searchPlaces } from '../../../../../lib/places';
import { getTripById, upsertTrip } from '../../../../../lib/storage';
import { SELECTABLE_WEATHER_OPTIONS, getWeatherColor } from '../../../../../lib/weather';
import { Note, Trip } from '../../../../../types';

export default function EditNoteScreen() {
	const { themeColors } = useTheme();
	const { prefs } = usePreferences();
	const insets = useSafeAreaInsets();
	const { id, noteId } = useLocalSearchParams<{ id: string; noteId: string }>();
	const [trip, setTrip] = useState<Trip | undefined>();
	const [log, setLog] = useState<Note | undefined>();
	const [date, setDate] = useState<string>('');
	const [title, setTitle] = useState<string>('');
	const [weather, setWeather] = useState<string>('');
	const [notes, setNotes] = useState<string>('');
	const [photos, setPhotos] = useState<{ uri: string; caption?: string }[]>([]);
	const [location, setLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
	const [locationLabel, setLocationLabel] = useState<string>('');
	const [mapType, setMapType] = useState<'standard' | 'hybrid'>('standard');
	const MapRef = useRef<any>(null);
	const [MapComponents, setMapComponents] = useState<null | { MapView: any; Marker: any }>(null);
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [color, setColor] = useState<string | undefined>(undefined);
	const [emoji, setEmoji] = useState<string | undefined>(undefined);
	// Location search state
	const [locationQuery, setLocationQuery] = useState('');
	const [searching, setSearching] = useState(false);
	const [searchResults, setSearchResults] = useState<{ lat: number; lng: number; label: string }[]>([]);
	// Removed continuous follow logic; using one-shot recenter button

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
			if (!id || !noteId) return;
			const t = await getTripById(id);
			if (!t) return;
			setTrip(t);
			const found = t.days.find(d => d.id === noteId);
			if (found) {
				setLog(found);
				// Default date to earliest selectable (trip start) and clamp within trip range
				let nextDate = found.date || '';
				if (t.startDate) {
					const min = parseISODate(t.startDate).getTime();
					const cur = nextDate ? parseISODate(nextDate).getTime() : NaN;
					if (!nextDate || isNaN(cur) || cur < min) nextDate = t.startDate;
				}
				if (t.endDate && nextDate) {
					const max = parseISODate(t.endDate).getTime();
					const cur = parseISODate(nextDate).getTime();
					if (cur > max) nextDate = t.endDate;
				}
				setDate(nextDate);
				setTitle(found.title || '');
				setWeather(found.weather || '');
				setNotes(found.notes || '');
				if (found.color) setColor(found.color);
				if (found.emoji) setEmoji(found.emoji);
				if (found.location) setLocation(found.location);
				if (found.photos?.length) setPhotos(found.photos);
				else if (found.photoUri) setPhotos([{ uri: found.photoUri }]);
			}
			// Request permissions for media and camera
			await ImagePicker.requestMediaLibraryPermissionsAsync();
			await ImagePicker.requestCameraPermissionsAsync();
			await Location.requestForegroundPermissionsAsync();
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
	}, [id, noteId]);

	// Compute selectable date bounds for the picker
	const minSelectableDate = useMemo(() => (trip?.startDate ? parseISODate(trip.startDate) : undefined), [trip?.startDate]);
	const maxSelectableDate = useMemo(() => (trip?.endDate ? parseISODate(trip.endDate) : undefined), [trip?.endDate]);

	// Resolve a short human-readable location label
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

	async function pickFromLibrary() {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ['images'],
			allowsMultipleSelection: true,
			selectionLimit: 10,
			quality: 0.8,
		});
		if (!result.canceled) {
			const newPhotos = result.assets.map(a => ({ uri: a.uri }));
			setPhotos(prev => [...prev, ...newPhotos]);
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

// removed legacy one-shot location helper (replaced by follow toggle)

	const weatherOptions = SELECTABLE_WEATHER_OPTIONS;

	// Debounced geocode search
	useEffect(() => {
		if (!locationQuery.trim()) { setSearchResults([]); return; }
		if (locationQuery.trim().length < 3) { setSearchResults([]); return; }
		const handle = setTimeout(async () => {
			setSearching(true);
			try {
				const results = await geocodeToLabel(locationQuery);
				setSearchResults(results);
			} catch { setSearchResults([]); } finally { setSearching(false); }
		}, 500);
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
				const region: any = { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 };
				if (MapRef.current?.animateToRegion) MapRef.current.animateToRegion(region, 400);
			});
		} catch {}
	}

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
		try {
			const region: any = { latitude: r.lat, longitude: r.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 };
			requestAnimationFrame(() => {
				if (MapRef.current?.animateToRegion) MapRef.current.animateToRegion(region, 350);
			});
		} catch {}
		// Reverse lookup refine
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

	const canSave = !!(
		(title && title.trim()) ||
		(weather && weather.trim()) ||
		(notes && notes.trim()) ||
		(photos && photos.length) ||
		location || color || emoji
	);

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

	function removePhotoAt(index: number) {
		setPhotos(prev => prev.filter((_, i) => i !== index));
	}

	async function onSave() {
		if (!trip || !log) return;
		// Validate date within trip range if available
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
		const updatedLog: Note = {
			...log,
			date: date || log.date,
			title: title || undefined,
			weather: weather || undefined,
			notes: notes || undefined,
			photos: persisted,
			location: location ? { lat: location.lat, lng: location.lng } : undefined,
			locationName: location ? (locationLabel || undefined) : undefined,
			photoUri: undefined,
			color: color || undefined,
			emoji: emoji || undefined,
		};
		const nextDays = trip.days.map(d => (d.id === log.id ? updatedLog : d));
		const updatedTrip: Trip = { ...trip, days: nextDays };
		await upsertTrip(updatedTrip);
		router.replace(`/trips/${trip.id}`);
	}

	async function onDelete() {
		if (!trip || !log) return;
		Alert.alert('Delete note', 'Are you sure you want to permanently delete this note?', [
			{ text: 'Cancel', style: 'cancel' },
			{ text: 'Delete', style: 'destructive', onPress: async () => {
				try {
					const nextDays = trip.days.filter(d => d.id !== log.id);
					const updatedTrip: Trip = { ...trip, days: nextDays };
					await upsertTrip(updatedTrip);
					router.replace(`/trips/${trip.id}`);
				} catch {}
			} }
		]);
	}

	const styles = useMemo(() => StyleSheet.create({
		container: { flex: 1, padding: 14, backgroundColor: themeColors.background },
		section: { borderWidth: 1, borderColor: themeColors.primary, borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: themeColors.card },
		sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
		inlineInput: { flex: 1, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
		dateBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card },
		dateText: { color: themeColors.text, fontSize: 13, fontWeight: '600' },
		label: { fontSize: 12, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 },
		textArea: { borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, padding: 10, minHeight: 110, textAlignVertical: 'top' },
		weatherRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
		weatherChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card },
		photoList: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 10 },
		photoWrap: { position: 'relative' },
		photoThumb: { width: 90, height: 90, borderRadius: 8, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.menuBorder },
		removeBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: themeColors.danger, borderRadius: 999, padding: 4 },
		btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
		btn: { backgroundColor: themeColors.primary, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', flex: 1 },
		btnText: { color: themeColors.badgeText, fontWeight: '700' },
		saveBtn: { backgroundColor: themeColors.primary, paddingVertical: 18, borderRadius: 14, alignItems: 'center', opacity: canSave ? 1 : 0.55, flex: 1 },
		deleteBtn: { backgroundColor: themeColors.danger, paddingVertical: 14, borderRadius: 14, alignItems: 'center', flex: 0.55 },
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
		mapBox: { height: 240, borderRadius: 12, overflow: 'hidden', marginTop: 10 },
		overlayToggle: { position: 'absolute', bottom: 10, left: 10, backgroundColor: themeColors.card, borderRadius: 26, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: themeColors.primary },
		overlayBtn: { position: 'absolute', bottom: 10, right: 10, backgroundColor: themeColors.card, borderRadius: 26, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: themeColors.primary, flexDirection: 'row', alignItems: 'center', gap: 6 },
	}), [themeColors, canSave]);

	if (!trip || !log) {
		return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: themeColors.background }}><Text style={{ color: themeColors.textSecondary }}>Loading note...</Text></View>;
	}

	return (
			<ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: Math.max(32, (insets?.bottom || 0) + 24) }}>
				{/* Section: Title & Date */}
				<View style={styles.section}>
					<View style={styles.sectionRow}>
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
							minimumDate={minSelectableDate as any}
							maximumDate={maxSelectableDate as any}
							onChange={onChangeDate}
						/>
					)}
				</View>

				{/* Section: Notes */}
				<View style={styles.section}>
					<Text style={styles.label}>Notes</Text>
					<TextInput style={styles.textArea} multiline placeholder="Notes (optional)" placeholderTextColor={themeColors.textSecondary} value={notes} onChangeText={setNotes} />
				</View>

				{/* Section: Weather */}
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

				{/* Section: Photos */}
				<View style={styles.section}>
					<Text style={styles.label}>Photos</Text>
					<View style={styles.btnRow}>
						<Pressable onPress={pickFromLibrary} style={styles.btn} accessibilityLabel="Add photos from library">
							<Text style={styles.btnText}>Add</Text>
						</Pressable>
						<Pressable onPress={takePhoto} style={styles.btn} accessibilityLabel="Take a photo">
							<Text style={styles.btnText}>Camera</Text>
						</Pressable>
					</View>
					{!!photos.length && (
						<View style={styles.photoList}>
							{photos.map((p, idx) => (
								<View style={styles.photoWrap} key={`${p.uri}-${idx}`}>
									<Image source={{ uri: p.uri }} style={styles.photoThumb} />
									<Pressable onPress={() => removePhotoAt(idx)} style={styles.removeBtn} accessibilityLabel="Remove photo">
										<Ionicons name="close" size={16} color={themeColors.badgeText} />
									</Pressable>
								</View>
							))}
						</View>
					)}
				</View>

				{/* Section: Location & Map */}
				<View style={styles.section}>
					<Text style={styles.label}>Location</Text>
					<Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>{location ? locationLabel : 'No location selected'}</Text>
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
					{MapComponents ? (
						<View style={styles.mapBox}>
							<MapComponents.MapView style={{ flex: 1 }}
								initialRegion={{ latitude: location?.lat || 37.78825, longitude: location?.lng || -122.4324, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
								onPress={onMapPress}
								mapType={mapType}
								ref={MapRef}
							>
								{location && (
									<MapComponents.Marker coordinate={{ latitude: location.lat, longitude: location.lng }} />
								)}
							</MapComponents.MapView>
							<Pressable onPress={() => setMapType(m => m === 'standard' ? 'hybrid' : 'standard')} style={styles.overlayToggle} accessibilityLabel="Toggle map type">
								<Text style={{ color: themeColors.primary, fontWeight: '600', fontSize: 12 }}>{mapType === 'standard' ? 'Satellite' : 'Map'}</Text>
							</Pressable>
							<Pressable onPress={recenterOnUser} style={styles.overlayBtn} accessibilityLabel="Recenter on me">
								<Ionicons name="locate" size={16} color={themeColors.primary} />
								<Text style={{ color: themeColors.primary, fontWeight: '600', fontSize: 12 }}>Recenter</Text>
							</Pressable>
						</View>
					) : (
						<Text style={{ color: themeColors.textSecondary, marginTop: 8, fontSize: 12 }}>Map preview unavailable.</Text>
					)}
				</View>

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

				{/* Save/Delete */}
				<View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
					<Pressable onPress={onSave} style={styles.saveBtn} disabled={!canSave} accessibilityLabel="Save note changes">
						<Text style={{ color: themeColors.badgeText, fontWeight: '700', fontSize: 16 }}>Save</Text>
					</Pressable>
					<Pressable onPress={onDelete} style={styles.deleteBtn} accessibilityLabel="Delete note">
						<Text style={{ color: themeColors.badgeText, fontWeight: '700', fontSize: 14 }}>Delete</Text>
					</Pressable>
				</View>
			</ScrollView>
		);
}

async function geocodeToLabel(query: string): Promise<{ lat: number; lng: number; label: string }[]> {
	try {
		if (!query.trim()) return [];
		// Prefer Google Places API if key available
		const placeHits = await searchPlaces(query.trim());
		if (placeHits.length) return placeHits;
		const results = await Location.geocodeAsync(query.trim());
		const top = results.slice(0, 8);
		const enriched = await Promise.all(top.map(async (r, idx) => {
			let label = buildLabel(r);
			if (!label || /^[-0-9.,\s]+$/.test(label)) {
				try {
					if (idx < 5) {
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

