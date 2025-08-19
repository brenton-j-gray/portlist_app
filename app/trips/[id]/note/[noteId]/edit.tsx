import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import { useTheme } from '../../../../../components/ThemeContext';
import { shortLocationLabel } from '../../../../../lib/location';
import { persistPhotoUris, saveCameraPhotoToLibrary } from '../../../../../lib/media';
import { getTripById, upsertTrip } from '../../../../../lib/storage';
import { Note, Trip } from '../../../../../types';

export default function EditNoteScreen() {
	const { themeColors } = useTheme();
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
	const [locating, setLocating] = useState(false);
	const [showDatePicker, setShowDatePicker] = useState(false);

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

	async function useCurrentLocation() {
		setLocating(true);
		try {
			const { status } = await Location.requestForegroundPermissionsAsync();
			if (status !== 'granted') return;
			const loc = await Location.getCurrentPositionAsync({});
			const lat = loc.coords.latitude;
			const lng = loc.coords.longitude;
			setLocation({ lat, lng });
			try {
				const region = { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 };
				requestAnimationFrame(() => {
					if (MapRef.current?.animateToRegion) MapRef.current.animateToRegion(region, 350);
					else if (MapRef.current?.fitToCoordinates) MapRef.current.fitToCoordinates([{ latitude: lat, longitude: lng }], { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true });
				});
			} catch {}
		} catch {} finally {
			setLocating(false);
		}
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
		(weather && weather.trim()) ||
		(notes && notes.trim()) ||
		(photos && photos.length) ||
		location
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
		};
		const nextDays = trip.days.map(d => (d.id === log.id ? updatedLog : d));
		const updatedTrip: Trip = { ...trip, days: nextDays };
		await upsertTrip(updatedTrip);
		router.replace(`/trips/${trip.id}`);
	}

	const styles = useMemo(() => StyleSheet.create({
		container: { flex: 1, padding: 16, backgroundColor: themeColors.background },
		input: { borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, padding: 10, marginBottom: 10 },
		label: { fontSize: 14, fontWeight: '500', marginBottom: 4, marginLeft: 2, color: themeColors.textSecondary },
		btnRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
		btn: { backgroundColor: themeColors.primary, padding: 12, borderRadius: 10, alignItems: 'center', flex: 1 },
		btnText: { color: themeColors.badgeText, fontWeight: '700' },
		photoList: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 12 },
		photoWrap: { position: 'relative' },
		photoThumb: { width: 96, height: 96, borderRadius: 8, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.menuBorder },
		removeBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: themeColors.danger, borderRadius: 999, padding: 4 },
		saveBtn: { backgroundColor: themeColors.primary, padding: 12, borderRadius: 10, alignItems: 'center', opacity: canSave ? 1 : 0.6 },
		weatherRow: { flexDirection: 'row', gap: 10, marginBottom: 10, flexWrap: 'wrap' },
		weatherChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card },
		weatherChipActive: { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '22' },
		mapBox: { height: 220, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: themeColors.menuBorder, marginBottom: 10 },
	}), [themeColors, canSave]);

	if (!trip || !log) {
		return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: themeColors.background }}><Text style={{ color: themeColors.textSecondary }}>Loading note...</Text></View>;
	}

	return (
		<ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
			{/* Header provides the screen title */}
			<Text style={styles.label}>Title</Text>
			<TextInput style={styles.input} placeholder="Title (optional)" placeholderTextColor={themeColors.textSecondary} value={title} onChangeText={setTitle} />
			<Text style={styles.label}>Date</Text>
			<Pressable onPress={() => setShowDatePicker(true)} style={styles.input} accessibilityLabel="Choose date">
				<Text style={{ color: date ? themeColors.text : themeColors.textSecondary }}>{date ? `Date: ${date}` : 'Pick a date'}</Text>
			</Pressable>
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
			<Text style={styles.label}>Weather</Text>
			<View style={styles.weatherRow}>
				{weatherOptions.map(opt => (
					<Pressable key={opt.key} onPress={() => setWeather(opt.key)} style={[styles.weatherChip, weather === opt.key && styles.weatherChipActive]} accessibilityLabel={`Weather ${opt.label}`}>
						<Ionicons name={opt.icon as any} size={16} color={weather === opt.key ? themeColors.primaryDark : themeColors.textSecondary} />
						<Text style={{ color: weather === opt.key ? themeColors.primaryDark : themeColors.textSecondary }}>{opt.label}</Text>
					</Pressable>
				))}
			</View>
			<Text style={styles.label}>Location</Text>
			<Text style={{ color: themeColors.textSecondary, marginBottom: 6 }}>
				{location ? `Selected location: ${locationLabel}` : 'No location selected'}
			</Text>
			{locating && (
				<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
					<ActivityIndicator size="small" color={themeColors.textSecondary} />
					<Text style={{ color: themeColors.textSecondary, marginLeft: 8 }}>Finding your location…</Text>
				</View>
			)}
			{MapComponents ? (
				<>
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
					</View>

					<View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
						<Pressable onPress={() => setMapType('standard')} style={[{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card }, mapType === 'standard' && { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '22' }]} accessibilityLabel="Map view">
							<Text style={{ color: mapType === 'standard' ? themeColors.primaryDark : themeColors.textSecondary }}>Map</Text>
						</Pressable>
						<Pressable onPress={() => setMapType('hybrid')} style={[{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card }, mapType === 'hybrid' && { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '22' }]} accessibilityLabel="Satellite view with labels">
							<Text style={{ color: mapType === 'hybrid' ? themeColors.primaryDark : themeColors.textSecondary }}>Satellite</Text>
						</Pressable>
					</View>
				</>
			) : (
				<Text style={{ color: themeColors.textSecondary, marginBottom: 8 }}>Map preview is unavailable in this build. You can still tag with your current location.</Text>
			)}
			<View style={styles.btnRow}>
				<Pressable onPress={useCurrentLocation} disabled={locating} style={[styles.btn, { backgroundColor: themeColors.actionBtnBg, borderWidth: 1, borderColor: themeColors.primaryDark + '29' }, locating && { opacity: 0.7 }]} accessibilityLabel="Use current location">
					<Text style={[styles.btnText, { color: themeColors.text }]}>Use Current Location</Text>
				</Pressable>
				{location && (
					<Pressable onPress={() => setLocation(undefined)} style={[styles.btn, { backgroundColor: themeColors.danger }]} accessibilityLabel="Clear location">
						<Text style={styles.btnText}>Clear</Text>
					</Pressable>
				)}
			</View>
			<Text style={styles.label}>Notes</Text>
			<TextInput style={[styles.input, { height: 100 }]} multiline placeholder="Notes (optional)" placeholderTextColor={themeColors.textSecondary} value={notes} onChangeText={setNotes} />
			<View style={styles.btnRow}>
				<Pressable onPress={pickFromLibrary} style={styles.btn} accessibilityLabel="Add photos from library">
					<Text style={styles.btnText}>Add Photos</Text>
				</Pressable>
				<Pressable onPress={takePhoto} style={styles.btn} accessibilityLabel="Take a photo">
					<Text style={styles.btnText}>Take Photo</Text>
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

			<Pressable onPress={onSave} style={styles.saveBtn} disabled={!canSave}>
				<Text style={styles.btnText}>Save Changes</Text>
			</Pressable>
		</ScrollView>
	);
}
