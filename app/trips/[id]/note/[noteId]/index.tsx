import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pill } from '../../../../../components/Pill';
import { formatDateWithPrefs, formatTemperature, usePreferences } from '../../../../../components/PreferencesContext';
import { useTheme } from '../../../../../components/ThemeContext';
import { getTripById } from '../../../../../lib/storage';
import { WeatherPill } from '../../../../../lib/weather';
import { Note, Trip } from '../../../../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ViewNoteScreen() {
	const { id, noteId } = useLocalSearchParams<{ id: string; noteId: string }>();
	const { themeColors } = useTheme();
	const { prefs } = usePreferences();
	const insets = useSafeAreaInsets();
	const [trip, setTrip] = useState<Trip | undefined>();
	const [log, setLog] = useState<Note | undefined>();
	const [page, setPage] = useState(0);
	const flatListRef = React.useRef<FlatList<any>>(null);

	useEffect(() => {
		(async () => {
			if (!id) return;
			const t = await getTripById(String(id));
			setTrip(t);
			const d = t?.days?.find((x) => x.id === noteId);
			setLog(d);
		})();
	}, [id, noteId]);

	const styles = useMemo(() => {
		const THUMB_SIZE = 54;
		const THUMB_MARGIN = 6;
		return StyleSheet.create({
			container: { flex: 1, backgroundColor: themeColors.background, paddingBottom: Math.max(12, insets?.bottom || 0) },
			content: { padding: 16, paddingBottom: Math.max(24, (insets?.bottom || 0) + 24) },
			title: { fontSize: 24, fontWeight: '800', color: themeColors.text, marginBottom: 6 },
			date: { fontSize: 16, fontWeight: '700', color: themeColors.textSecondary, marginBottom: 12 },
			mediaWrap: { marginBottom: 16 },
			mediaImage: { width: SCREEN_WIDTH - 36, height: 236, borderRadius: 12 },
			mediaImageActive: { borderWidth: 2, borderColor: themeColors.primary, borderRadius: 12 },
			filmstrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 2 },
			thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 8, marginHorizontal: THUMB_MARGIN, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden', backgroundColor: themeColors.card },
			thumbActive: { borderColor: themeColors.primary },
			infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8, flexWrap: 'wrap' },
			section: { backgroundColor: themeColors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: themeColors.primary, marginTop: 12 },
			sectionTitle: { fontSize: 14, fontWeight: '700', color: themeColors.textSecondary, marginBottom: 6 },
			sectionText: { fontSize: 16, color: themeColors.text, lineHeight: 22 },
			empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
			emptyText: { color: themeColors.textSecondary },
		});
	}, [themeColors, insets?.bottom]);

	if (!log || !trip) {
		return (
			<View style={[styles.container, styles.empty]}>
				<Text style={styles.emptyText}>Note not found.</Text>
			</View>
		);
	}

	const photos = log.photos ?? ((log as any).photoUri ? [{ uri: (log as any).photoUri }] : []);

	return (
		<View style={styles.container}>
			<Stack.Screen options={{ title: 'View Note' }} />
			<ScrollView contentContainerStyle={styles.content}>
				{photos.length > 0 ? (
					<View style={styles.mediaWrap}>
						<FlatList
							ref={flatListRef}
							horizontal
							pagingEnabled
							showsHorizontalScrollIndicator={false}
							data={photos}
							keyExtractor={(_, i) => String(i)}
							onMomentumScrollEnd={(ev) => {
								const idx = Math.round((ev.nativeEvent.contentOffset.x || 0) / (SCREEN_WIDTH - 36));
								setPage(idx);
							}}
							renderItem={({ item, index }) => (
								<View style={{ width: SCREEN_WIDTH - 36, marginRight: 8, alignItems: 'center', justifyContent: 'center' }}>
									<Image source={{ uri: item.uri }} style={[styles.mediaImage, index === page && styles.mediaImageActive]} resizeMode="cover" />
									{!!item.caption && <Text style={{ color: themeColors.textSecondary, marginTop: 6 }}>{item.caption}</Text>}
								</View>
							)}
						/>
						{photos.length > 1 && (
							<View style={styles.filmstrip}>
								{photos.map((p: any, i: number) => (
									<TouchableOpacity
										key={i}
										onPress={() => { setPage(i); flatListRef.current?.scrollToIndex({ index: i, animated: true }); }}
										accessibilityLabel={`Show photo ${i + 1}`}
									>
										<Image source={{ uri: p.uri }} style={[styles.thumb, i === page && styles.thumbActive]} resizeMode="cover" />
									</TouchableOpacity>
								))}
							</View>
						)}
					</View>
				) : (
					<View style={[styles.mediaWrap, { alignItems: 'center', justifyContent: 'center' }]}>
						<View style={{ width: SCREEN_WIDTH - 36, height: 196, borderRadius: 12, borderWidth: 1, borderColor: themeColors.primary, backgroundColor: themeColors.card, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="No photos yet">
							<Ionicons name="image-outline" size={48} color={themeColors.textSecondary} />
							<Text style={{ marginTop: 8, color: themeColors.textSecondary }}>No photos yet</Text>
						</View>
					</View>
				)}

				{(log.title || log.emoji) && (
					<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
						<Text style={[styles.title, { flex: 1, marginRight: 12 }]} numberOfLines={2}>{log.emoji ? `${log.emoji} ${log.title || ''}` : log.title}</Text>
						<Pressable
							accessibilityLabel="Edit note"
							onPress={() => router.push({ pathname: '/(tabs)/trips/[id]/note/[noteId]/edit' as any, params: { id: String(id), noteId: String(noteId) } } as any)}
							style={{ padding: 8, borderRadius: 10, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.primary, alignItems: 'center', justifyContent: 'center' }}
						>
							<Ionicons name="create-outline" size={20} color={themeColors.primary} />
						</Pressable>
					</View>
				)}
				<Text style={styles.date}>{formatDateWithPrefs(log.date, prefs, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Text>

				{(log.weather || log.locationName || (log as any).location) && (
					<View style={styles.infoRow}>
						{!!log.weather && (
							<WeatherPill
								weather={log.weather}
								size="md"
								trailing={typeof (log as any).tempC === 'number' ? formatTemperature((log as any).tempC, prefs, { withUnit: true }) : undefined}
							/>
						)}
						{!!(log.locationName || (log as any).location) && (
							<Pill variant="success" size="md" iconName="location-outline">
								{(() => {
									const label = log.locationName || (log as any).location || '';
									if (/.*,\s*[A-Z]{2}$/i.test(label)) return label;
									const parts = label.split(',').map((p: string) => p.trim()).filter(Boolean);
									if (parts.length >= 2) return `${parts[0]}, ${parts[parts.length - 1]}`;
									return label || 'Location added';
								})()}
							</Pill>
						)}
					</View>
				)}

				{!!log.notes && (
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>Notes</Text>
						<Text style={styles.sectionText}>{log.notes}</Text>
					</View>
				)}
			</ScrollView>
		</View>
	);
}
