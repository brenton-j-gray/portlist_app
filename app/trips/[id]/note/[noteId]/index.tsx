import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../../../components/ThemeContext';
import { getTripById } from '../../../../../lib/storage';
import { Note, Trip } from '../../../../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function parseLocalFromString(dateStr: string | undefined): Date | null {
	if (!dateStr) return null;
	const ymd = String(dateStr).slice(0, 10);
	if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
		const [y, m, d] = ymd.split('-').map(Number);
		return new Date(y, (m || 1) - 1, d || 1);
	}
	const d = new Date(dateStr);
	return isNaN(d.getTime()) ? null : d;
}
function formatWeekdayDDMonthYYYY(d: Date) {
	const weekday = d.toLocaleString(undefined, { weekday: 'long' });
	const day = String(d.getDate()).padStart(2, '0');
	const month = d.toLocaleString(undefined, { month: 'long' });
	const year = String(d.getFullYear());
	return `${weekday}, ${day} ${month} ${year}`;
}

export default function ViewNoteScreen() {
	const { id, noteId } = useLocalSearchParams<{ id: string; noteId: string }>();
	const { themeColors, colorScheme } = useTheme();
	const insets = useSafeAreaInsets();
	const [trip, setTrip] = useState<Trip | undefined>();
	const [log, setLog] = useState<Note | undefined>();

	useEffect(() => {
		(async () => {
			if (!id) return;
			const t = await getTripById(String(id));
			setTrip(t);
			const d = t?.days?.find((x) => x.id === noteId);
			setLog(d);
		})();
	}, [id, noteId]);

	const styles = useMemo(() => StyleSheet.create({
		container: { flex: 1, backgroundColor: themeColors.background },
		content: { padding: 16, paddingBottom: Math.max(24, (insets?.bottom || 0) + 24) },
		title: { fontSize: 24, fontWeight: '800', color: themeColors.text, marginBottom: 6 },
		date: { fontSize: 16, fontWeight: '700', color: themeColors.textSecondary, marginBottom: 12 },
		mediaWrap: { marginBottom: 16 },
		mediaImage: { width: SCREEN_WIDTH - 32, height: 240, borderRadius: 14 },
		pagerDots: { flexDirection: 'row', alignSelf: 'center', marginTop: 8, gap: 6 },
		dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: themeColors.menuBorder },
		dotActive: { backgroundColor: themeColors.primary },
		infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8, flexWrap: 'wrap' },
		infoText: { marginLeft: 0, color: themeColors.text, fontSize: 16 },
		section: { backgroundColor: themeColors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: themeColors.menuBorder, marginTop: 12 },
		sectionTitle: { fontSize: 14, fontWeight: '700', color: themeColors.textSecondary, marginBottom: 6 },
		sectionText: { fontSize: 16, color: themeColors.text, lineHeight: 22 },
		primaryBtn: { marginTop: 16, backgroundColor: themeColors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
		primaryText: { color: themeColors.addBtnText, fontWeight: '800' },
		empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
		emptyText: { color: themeColors.textSecondary },
	}), [themeColors, insets?.bottom]);
	const [page, setPage] = useState(0);

	if (!log || !trip) {
		return (
			<View style={[styles.container, styles.empty]}>
				<Text style={styles.emptyText}>Note not found.</Text>
			</View>
		);
	}

	const photos = log.photos && log.photos.length > 0
		? log.photos
		: (log.photoUri ? [{ uri: log.photoUri }] : []);

	return (
		<View style={styles.container}>
			<Stack.Screen options={{ title: 'View Note' }} />
			<ScrollView contentContainerStyle={styles.content}>
				{photos.length > 0 ? (
					<View style={styles.mediaWrap}>
						<FlatList
							horizontal
							pagingEnabled
							showsHorizontalScrollIndicator={false}
							data={photos}
							keyExtractor={(_, i) => String(i)}
							onMomentumScrollEnd={(ev) => {
								const idx = Math.round((ev.nativeEvent.contentOffset.x || 0) / (SCREEN_WIDTH - 32));
								setPage(idx);
							}}
							renderItem={({ item }) => (
								<View style={{ width: SCREEN_WIDTH - 32, marginRight: 8 }}>
									<Image source={{ uri: item.uri }} style={styles.mediaImage} resizeMode="cover" />
									{!!item.caption && <Text style={{ color: themeColors.textSecondary, marginTop: 6 }}>{item.caption}</Text>}
								</View>
							)}
						/>
						{photos.length > 1 && (
							<View style={styles.pagerDots}>
								{photos.map((_, i) => (
									<View key={i} style={[styles.dot, i === page && styles.dotActive]} />
								))}
							</View>
						)}
					</View>
				) : (
					<View style={[styles.mediaWrap, { alignItems: 'center', justifyContent: 'center' }]}>
						<View
							style={{
								width: SCREEN_WIDTH - 32,
								height: 200,
								borderRadius: 14,
								borderWidth: 1,
								borderColor: themeColors.menuBorder,
								backgroundColor: themeColors.card,
								alignItems: 'center',
								justifyContent: 'center',
							}}
							accessibilityLabel="No photos yet"
						>
							<Ionicons name="image-outline" size={48} color={themeColors.textSecondary} />
							<Text style={{ marginTop: 8, color: themeColors.textSecondary }}>No photos yet</Text>
						</View>
					</View>
				)}

				{!!log.title && <Text style={styles.title}>{log.title}</Text>}
				<Text style={styles.date}>{(() => { const d = parseLocalFromString(log.date); return d ? formatWeekdayDDMonthYYYY(d) : log.date; })()}</Text>

				{!!log.weather && (
					<View style={styles.infoRow}>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: themeColors.accent + '55', backgroundColor: themeColors.accent + '22' }}>
							<Ionicons name={(log.weather + '-outline') as any} size={16} color={themeColors.accent} />
							<Text style={{ fontSize: 14, fontWeight: '700', color: colorScheme === 'light' ? themeColors.text : themeColors.accent }}>{log.weather}</Text>
						</View>
					</View>
				)}

				{!!(log.locationName || log.location) && (
					<View style={styles.infoRow}>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: themeColors.highlight + '77', backgroundColor: themeColors.highlight + '22', maxWidth: '100%' }}>
							<Ionicons name="location-outline" size={16} color={themeColors.highlight} />
							<Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 14, fontWeight: '700', color: colorScheme === 'light' ? themeColors.text : themeColors.highlight }}>
								{(() => {
									const label = log.locationName || '';
									if (/.*,\s*[A-Z]{2}$/i.test(label)) return label;
									const parts = label.split(',').map(p => p.trim()).filter(Boolean);
									if (parts.length >= 2) return `${parts[0]}, ${parts[parts.length - 1]}`;
									return label || 'Location added';
								})()}
							</Text>
						</View>
					</View>
				)}

				{/* Description removed as redundant with Notes */}

				{!!log.notes && (
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>Notes</Text>
						<Text style={styles.sectionText}>{log.notes}</Text>
					</View>
				)}

				<TouchableOpacity
					style={styles.primaryBtn}
					onPress={() => router.push({ pathname: '/(tabs)/trips/[id]/note/[noteId]/edit' as any, params: { id: String(id), noteId: String(noteId) } } as any)}
					accessibilityLabel="Edit note"
				>
					<Text style={styles.primaryText}>Edit Note</Text>
				</TouchableOpacity>
			</ScrollView>
		</View>
	);
}
