// Trips tab root screen lives here under the folder-based route to enable nested screens.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, ImageBackground, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../components/ThemeContext';
import { exportAllTripsJSON } from '../../../lib/exportTrip';
import { getTrips } from '../../../lib/storage';
import { Trip } from '../../../types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
function parseLocalYmd(s: string): Date {
	const [y, m, d] = s.split('-').map(Number);
	return new Date(y, (m || 1) - 1, d || 1);
}
function startOfToday(): Date {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
function getDaysLabel(item: Trip): { text: string; kind: 'future' | 'past' | 'today' | 'current' } | undefined {
	const today = startOfToday().getTime();
	const hasStart = !!item.startDate;
	const hasEnd = !!item.endDate;
	const startTs = hasStart ? parseLocalYmd(item.startDate as string).getTime() : undefined;
	const endTs = hasEnd ? parseLocalYmd(item.endDate as string).getTime() : undefined;

	// Future: count down to start date
	if (typeof startTs === 'number' && today < startTs) {
		const diff = Math.ceil((startTs - today) / MS_PER_DAY);
		return { text: `${diff} day${diff === 1 ? '' : 's'} until start`, kind: 'future' };
	}

	// Current (in progress): between start and end (inclusive)
	if (typeof startTs === 'number' && typeof endTs === 'number' && today >= startTs && today <= endTs) {
		return { text: 'In progress', kind: 'current' };
	}

	// Past: prefer days since end if end date exists, else days since start if only start exists
	if (typeof endTs === 'number' && today > endTs) {
		const diff = Math.floor((today - endTs) / MS_PER_DAY);
		const days = Math.max(0, diff);
		return { text: `${days} day${days === 1 ? '' : 's'} since end`, kind: 'past' };
	}
	if (typeof startTs === 'number' && !hasEnd && today > startTs) {
		const diff = Math.floor((today - startTs) / MS_PER_DAY);
		const days = Math.max(0, diff);
		return { text: `${days} day${days === 1 ? '' : 's'} since start`, kind: 'past' };
	}

	// Today edge-cases
	if (typeof startTs === 'number' && today === startTs) {
		return { text: 'Starts today', kind: 'today' };
	}

	// Fallback: days since created if no dates present
	if (!hasStart && !hasEnd && typeof item.createdAt === 'number') {
		const createdDay = new Date(item.createdAt);
		const createdMid = new Date(createdDay.getFullYear(), createdDay.getMonth(), createdDay.getDate()).getTime();
		const diff = Math.floor((today - createdMid) / MS_PER_DAY);
		const days = Math.max(0, diff);
		return { text: `${days} day${days === 1 ? '' : 's'} since created`, kind: days === 0 ? 'today' : 'past' };
	}

	return undefined;
}
function parseLocalFromString(dateStr: string | undefined): Date | null {
	if (!dateStr) return null;
	const ymd = String(dateStr).slice(0, 10); // supports 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:mm...'
	if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
		const [y, m, d] = ymd.split('-').map(Number);
		return new Date(y, (m || 1) - 1, d || 1);
	}
	const d = new Date(dateStr);
	return isNaN(d.getTime()) ? null : d;
}
function formatDate(dateStr: string) {
	const d = parseLocalFromString(dateStr);
	if (!d) return dateStr || '';
	return d.toLocaleDateString(undefined, {
		weekday: 'short',
		day: '2-digit',
		month: 'short',
		year: 'numeric',
	});
}

function computeDurationDays(start?: string, end?: string): number | null {
	if (!start || !end) return null;
	const s = parseLocalFromString(start);
	const e = parseLocalFromString(end);
	if (!s || !e) return null;
	const diff = Math.floor((e.getTime() - s.getTime()) / MS_PER_DAY) + 1; // inclusive
	return diff > 0 ? diff : null;
}

const CARD_SHADOW: any = {
	borderRadius: 18,
	marginVertical: 8,
	marginHorizontal: 0,
	shadowColor: '#000',
	shadowOffset: { width: 0, height: 2 },
	shadowOpacity: 0.12,
	shadowRadius: 8,
	elevation: 4,
	overflow: 'hidden',
	position: 'relative',
};

export default function TripsScreen() {
	const { themeColors } = useTheme();
	const insets = useSafeAreaInsets();
	const [trips, setTrips] = useState<Trip[]>([]);
	const [sortBy, setSortBy] = useState<'created' | 'title' | 'startDate'>('created');
	const [tab, setTab] = useState<'inprogress' | 'upcoming' | 'completed'>('upcoming');
	const [query, setQuery] = useState('');
	const [showSortMenu, setShowSortMenu] = useState(false);
	const [showStatusMenu, setShowStatusMenu] = useState(false);
	const [fabMenuModalVisible, setFabMenuModalVisible] = useState(false); // controls Modal mount for exit animation
	const menuOpacity = useRef(new Animated.Value(0)).current;
	const menuTranslate = useRef(new Animated.Value(8)).current;
	const FAB_SIZE = 56;

	const refresh = useCallback(async () => {
		const all = await getTrips();
		setTrips(all);
	}, []);

	useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

		// Sort trips based on sortBy; when viewing completed, prefer endDate for date sorting
			const sortedTrips = [...trips].sort((a, b) => {
		if (sortBy === 'title') {
			return a.title.localeCompare(b.title);
		} else if (sortBy === 'startDate') {
					const aDate = (tab === 'completed' ? a.endDate : a.startDate);
					const bDate = (tab === 'completed' ? b.endDate : b.startDate);
					const aParsed = parseLocalFromString(aDate);
					const bParsed = parseLocalFromString(bDate);
					const aTs = aParsed ? aParsed.getTime() : Number.POSITIVE_INFINITY;
					const bTs = bParsed ? bParsed.getTime() : Number.POSITIVE_INFINITY;
				return aTs - bTs;
		} else {
			// Default: created
			return b.createdAt - a.createdAt;
		}
	});

		// Completed if marked completed OR it has an endDate strictly before today
		function isTripCompleted(t: Trip) {
			if (t.completed) return true;
			if (!t.endDate) return false;
			const endTs = parseLocalYmd(t.endDate).getTime();
			return endTs < startOfToday().getTime();
		}
		// In progress if start is on/before today and (no end or end is on/after today), and not explicitly completed
		function isTripInProgress(t: Trip) {
			if (t.completed) return false;
			if (!t.startDate) return false;
			const today = startOfToday().getTime();
			const startTs = parseLocalYmd(t.startDate).getTime();
			const hasEnd = !!t.endDate;
			const endTs = hasEnd ? parseLocalYmd(t.endDate as string).getTime() : undefined;
			if (today < startTs) return false; // future, not started yet
			if (typeof endTs === 'number' && today > endTs) return false; // already ended
			return true;
		}

		let filteredTrips = sortedTrips.filter(t => {
			if (tab === 'completed') return isTripCompleted(t);
			if (tab === 'inprogress') return isTripInProgress(t);
			// upcoming: not completed, not in progress
			return !isTripCompleted(t) && !isTripInProgress(t);
		});
		if (query.trim()) {
			const q = query.trim().toLowerCase();
			filteredTrips = filteredTrips.filter(t => {
				const inTitle = t.title.toLowerCase().includes(q);
				const inShip = (t.ship || '').toLowerCase().includes(q);
				const inPorts = (t.ports || []).some(p => (p || '').toLowerCase().includes(q));
				return inTitle || inShip || inPorts;
			});
		}

	const styles = useMemo(() => StyleSheet.create({
			tabsRow: {
				flexDirection: 'row',
				alignItems: 'center',
				gap: 8,
				marginBottom: 10,
			},
			tabBtn: {
				flex: 1,
				paddingVertical: 8,
				borderRadius: 10,
				backgroundColor: themeColors.card,
				borderWidth: 1,
				borderColor: themeColors.menuBorder,
				alignItems: 'center',
				justifyContent: 'center',
			},
			tabBtnActive: {
				backgroundColor: themeColors.primary + '14',
				borderColor: themeColors.primary,
			},
			tabText: {
				fontSize: 15,
				fontWeight: '700',
				color: themeColors.text,
				letterSpacing: 0.2,
			},
			searchRow: {
				flexDirection: 'row',
				alignItems: 'center',
				marginBottom: 8,
			},
			sortRow: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			marginBottom: 8,
			gap: 8,
		},
			sortControls: {
				flexDirection: 'row',
				alignItems: 'center',
				flexWrap: 'wrap',
				gap: 6,
				flexShrink: 1,
			},
			sortMenuBtn: {
				flexDirection: 'row',
				alignItems: 'center',
				gap: 8,
				paddingVertical: 6,
				paddingHorizontal: 10,
				borderRadius: 8,
				borderWidth: 1,
				borderColor: themeColors.primary + '22',
				backgroundColor: themeColors.card,
			},
			sortMenuBtnText: {
				fontSize: 14,
				color: themeColors.primaryDark,
				fontWeight: '700',
			},
		searchInput: { flex: 1, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
			secondaryBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card },
			iconBtn: { padding: 10, borderRadius: 999, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card },
		secondaryBtnText: { color: themeColors.text, fontWeight: '600' },
		sortLabel: {
			fontSize: 15,
			color: themeColors.textSecondary,
			marginRight: 6,
			fontWeight: '500',
		},
		sortBtn: {
			paddingVertical: 4,
			paddingHorizontal: 10,
			borderRadius: 6,
			backgroundColor: themeColors.card,
			borderWidth: 1,
			borderColor: themeColors.primary + '22',
			marginRight: 2,
		},
		sortBtnActive: {
			backgroundColor: themeColors.primary + '18',
			borderColor: themeColors.primary,
		},
    
		sortBtnText: {
			fontSize: 14,
			color: themeColors.primaryDark,
			fontWeight: '600',
		},
		cardActionsRow: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'flex-end',
			marginTop: 16,
			gap: 16,
			paddingBottom: 2,
		},
		actionBtn: {
			marginRight: 0,
			backgroundColor: themeColors.actionBtnBg,
			padding: 0,
			borderWidth: 1,
			borderColor: themeColors.primaryDark + '29',
			borderRadius: 8,
			minWidth: 50,
			minHeight: 50,
			alignItems: 'center',
			justifyContent: 'center',
			marginLeft: 0,
			flexDirection: 'column',
		},
		actionLabel: {
			fontSize: 12,
			color: themeColors.textSecondary,
			marginTop: 2,
			fontWeight: '500',
			textAlign: 'center',
			letterSpacing: 0.1,
		},
	container: { flex: 1, padding: 16, backgroundColor: themeColors.background },
	header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 },
	title: { fontSize: 30, fontWeight: '600', color: themeColors.text },
		addBtn: { backgroundColor: themeColors.addBtnBg, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 28 },
		addText: { color: themeColors.addBtnText, fontWeight: '600' },
		listContent: { paddingBottom: 30 },
	card: {
			marginBottom: 16,
			borderRadius: 18,
			backgroundColor: themeColors.card,
			overflow: 'hidden',
			position: 'relative',
			minHeight: 90,
		} as any,
		cardBg: {
			position: 'absolute',
			left: 0,
			top: 0,
			right: 0,
			bottom: 0,
		} as any,
		cardOverlay: {
			position: 'absolute',
			left: 0,
			top: 0,
			right: 0,
			bottom: 0,
			zIndex: 1,
		} as any,
		cardAccent: {
			position: 'absolute',
			left: 0,
			top: 0,
			bottom: 0,
	width: 7,
	backgroundColor: 'transparent',
			opacity: 0.85,
			zIndex: 2,
		} as any,
		cardContent: {
			padding: 20,
			paddingLeft: 24,
			zIndex: 3,
			position: 'relative',
		},
			cardContentBackdrop: {
			position: 'absolute',
			left: 12,
			right: 12,
			top: 12,
				bottom: 12,
			borderRadius: 14,
			backgroundColor: 'rgba(0,0,0,0.58)',
			zIndex: 0,
		},
	cardPressed: {
			opacity: 0.92,
			transform: [{ scale: 0.98 }],
		},
		cardHeaderRow: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			marginBottom: 6,
		},
		cardTitle: {
			fontSize: 22,
			fontWeight: '700',
			flex: 1,
			marginRight: 8,
			color: themeColors.text,
			letterSpacing: 0.1,
		},
		completedChip: {
			marginLeft: 8,
			paddingHorizontal: 8,
			paddingVertical: 4,
			borderRadius: 999,
			backgroundColor: themeColors.highlight + '26',
			borderWidth: 1,
			borderColor: themeColors.highlight,
			flexDirection: 'row',
			alignItems: 'center',
			gap: 6,
		},
		completedChipText: {
			color: themeColors.highlight,
			fontSize: 12,
			fontWeight: '700',
			letterSpacing: 0.2,
		},
		metaText: {
			fontSize: 14,
			color: themeColors.textSecondary,
			marginBottom: 2,
			fontWeight: '500',
			letterSpacing: 0.05,
		},
		countdownText: {
			fontSize: 13,
			marginTop: 2,
			fontWeight: '700',
			letterSpacing: 0.2,
		},
	badge: {
			paddingHorizontal: 10,
			paddingVertical: 3,
			borderRadius: 999,
			minWidth: 28,
			alignItems: 'center',
			justifyContent: 'center',
			overflow: 'hidden',
		} as any,
		badgeText: {
			color: themeColors.badgeText,
			fontSize: 13,
			fontWeight: '700',
			letterSpacing: 0.2,
		},
			modalBackdrop: {
				position: 'absolute',
				left: 0,
				right: 0,
				top: 0,
				bottom: 0,
				backgroundColor: 'rgba(0,0,0,0.3)',
			},
			modalCenterWrap: {
				position: 'absolute',
				left: 0,
				right: 0,
				top: 0,
				bottom: 0,
				alignItems: 'center',
				justifyContent: 'center',
				padding: 24,
			},
			modalCard: {
				minWidth: 240,
				borderRadius: 12,
				backgroundColor: themeColors.card,
				borderWidth: 1,
				borderColor: themeColors.menuBorder,
				padding: 14,
				shadowColor: '#000',
				shadowOpacity: 0.2,
				shadowRadius: 10,
				elevation: 6,
			},
			modalTitle: {
				fontSize: 16,
				fontWeight: '700',
				color: themeColors.text,
				marginBottom: 8,
			},
			modalOption: {
				paddingVertical: 10,
				paddingHorizontal: 10,
				borderRadius: 8,
				marginVertical: 2,
			},
			modalOptionActive: {
				backgroundColor: themeColors.primary + '14',
			},
			modalOptionText: {
				fontSize: 15,
				color: themeColors.text,
				fontWeight: '600',
			},
			modalOptionTextActive: {
				color: themeColors.primaryDark,
			},
			// FAB action menu specific styles
			fabMenuCard: {
				minWidth: 200,
				borderRadius: 12,
				backgroundColor: 'transparent',
				borderWidth: 0,
				padding: 8,
				shadowOpacity: 0,
				elevation: 0,
			},
			pillOption: {
				flexDirection: 'row',
				alignItems: 'center',
				gap: 10,
				paddingVertical: 12,
				paddingHorizontal: 14,
				borderRadius: 999,
				marginVertical: 6,
				backgroundColor: themeColors.addBtnBg,
				borderWidth: 1,
				borderColor: themeColors.primaryDark + '29',
			},
			pillText: {
				fontSize: 15,
				fontWeight: '700',
				color: themeColors.addBtnText,
			},
	}), [themeColors]);

	// Sit the FAB closer to the bottom edge while respecting safe area
	const fabBottom = Math.max(12, (insets?.bottom || 0) + 20);

	const openFabMenu = useCallback(() => {
		setFabMenuModalVisible(true);
		menuOpacity.setValue(0);
		menuTranslate.setValue(8);
		Animated.parallel([
			Animated.timing(menuOpacity, { toValue: 1, duration: 140, useNativeDriver: true }),
			Animated.spring(menuTranslate, {
				toValue: 0,
				useNativeDriver: true,
				damping: 14,
				stiffness: 180,
				mass: 0.9,
				velocity: 0.8,
				overshootClamping: false,
			}),
		]).start();
	}, [menuOpacity, menuTranslate]);

	const closeFabMenu = useCallback(() => {
		Animated.parallel([
			Animated.timing(menuOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
			Animated.spring(menuTranslate, {
				toValue: 8,
				useNativeDriver: true,
				damping: 18,
				stiffness: 220,
				mass: 1.0,
				velocity: 0.6,
				overshootClamping: true,
			}),
		]).start(({ finished }) => {
			if (finished) setFabMenuModalVisible(false);
		});
	}, [menuOpacity, menuTranslate]);

	return (
		<View style={styles.container}>
			{/* Filters: Search (row 1) + Status/Sort and Export (row 2) */}
			<View style={styles.searchRow}>
				<TextInput
					style={styles.searchInput}
					placeholder="Search trips (title, ship, port)"
					placeholderTextColor={themeColors.textSecondary}
					value={query}
					onChangeText={setQuery}
					accessibilityLabel="Search trips"
				/>
			</View>
			<View style={styles.sortRow}>
				<View style={styles.sortControls}>
					<Text style={styles.sortLabel}>Status</Text>
					<TouchableOpacity
						style={styles.sortMenuBtn}
						onPress={() => setShowStatusMenu(true)}
						accessibilityLabel={`Open status menu (current: ${tab === 'inprogress' ? 'In Progress' : tab === 'upcoming' ? 'Upcoming' : 'Completed'})`}
					>
						<Ionicons name="filter-outline" size={18} color={themeColors.primaryDark} />
						<Text style={styles.sortMenuBtnText}>
							{tab === 'inprogress' ? 'In Progress' : tab === 'upcoming' ? 'Upcoming' : 'Completed'}
						</Text>
					</TouchableOpacity>
				</View>
				{/* Old Sort and Export removed; both live under the menu now */}
			</View>

			{/* Sort menu modal */}
			<Modal visible={showSortMenu} transparent animationType="fade" onRequestClose={() => setShowSortMenu(false)}>
				<Pressable style={styles.modalBackdrop} onPress={() => setShowSortMenu(false)}>
					{/* spacer to capture outside clicks */}
				</Pressable>
				<View style={styles.modalCenterWrap} pointerEvents="box-none">
					<View style={styles.modalCard}>
						<Text style={styles.modalTitle}>Sort by</Text>
						<TouchableOpacity
							style={[styles.modalOption, sortBy === 'created' && styles.modalOptionActive]}
							onPress={() => { setSortBy('created'); setShowSortMenu(false); }}
							accessibilityLabel="Sort by Recent"
						>
							<Text style={[styles.modalOptionText, sortBy === 'created' && styles.modalOptionTextActive]}>Recent</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.modalOption, sortBy === 'title' && styles.modalOptionActive]}
							onPress={() => { setSortBy('title'); setShowSortMenu(false); }}
							accessibilityLabel="Sort by A-Z"
						>
							<Text style={[styles.modalOptionText, sortBy === 'title' && styles.modalOptionTextActive]}>A-Z</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.modalOption, sortBy === 'startDate' && styles.modalOptionActive]}
							onPress={() => { setSortBy('startDate'); setShowSortMenu(false); }}
							accessibilityLabel="Sort by Start Date"
						>
							<Text style={[styles.modalOptionText, sortBy === 'startDate' && styles.modalOptionTextActive]}>Start Date</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>

			{/* Status menu modal */}
			<Modal visible={showStatusMenu} transparent animationType="fade" onRequestClose={() => setShowStatusMenu(false)}>
				<Pressable style={styles.modalBackdrop} onPress={() => setShowStatusMenu(false)}>
					{/* spacer to capture outside clicks */}
				</Pressable>
				<View style={styles.modalCenterWrap} pointerEvents="box-none">
					<View style={styles.modalCard}>
						<Text style={styles.modalTitle}>Show trips</Text>
						<TouchableOpacity
							style={[styles.modalOption, tab === 'inprogress' && styles.modalOptionActive]}
							onPress={() => { setTab('inprogress'); setShowStatusMenu(false); }}
							accessibilityLabel="Show In Progress trips"
						>
							<Text style={[styles.modalOptionText, tab === 'inprogress' && styles.modalOptionTextActive]}>In Progress</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.modalOption, tab === 'upcoming' && styles.modalOptionActive]}
							onPress={() => { setTab('upcoming'); setShowStatusMenu(false); }}
							accessibilityLabel="Show Upcoming trips"
						>
							<Text style={[styles.modalOptionText, tab === 'upcoming' && styles.modalOptionTextActive]}>Upcoming</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.modalOption, tab === 'completed' && styles.modalOptionActive]}
							onPress={() => { setTab('completed'); setShowStatusMenu(false); }}
							accessibilityLabel="Show Completed trips"
						>
							<Text style={[styles.modalOptionText, tab === 'completed' && styles.modalOptionTextActive]}>Completed</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>

			{filteredTrips.length === 0 ? (
				<Text style={{ color: themeColors.textSecondary }}>
					{tab === 'completed'
						? 'No completed trips yet.'
						: tab === 'inprogress'
						? 'No in-progress trips right now.'
						: 'No upcoming trips yet. Tap the menu to begin.'}
				</Text>
			) : (
				<FlatList
					data={filteredTrips}
					keyExtractor={(item) => item.id}
					contentContainerStyle={styles.listContent}
					renderItem={({ item }) => {
						const withPhotos = [...item.days].filter(d => (d.photos && d.photos.length > 0) || d.photoUri);
						withPhotos.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
						const bgUri = withPhotos.length > 0 ? (withPhotos[0].photos?.[0]?.uri || withPhotos[0].photoUri) : undefined;
						return (
							<View style={{ position: 'relative' }}>
								<Pressable
									style={({ pressed }) => [
										styles.card,
										CARD_SHADOW,
										pressed && styles.cardPressed
									]}
									onPress={() => router.push({ pathname: '/(tabs)/trips/[id]' as any, params: { id: item.id } } as any)}
									accessibilityLabel={`Trip card for ${item.title}`}
									hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
								>
										{bgUri ? (
											<ImageBackground source={{ uri: bgUri }} style={styles.cardBg} resizeMode="cover" />
										) : null}
										{bgUri ? (
											<LinearGradient
												colors={["rgba(0,0,0,0.25)", "rgba(0,0,0,0.5)"]}
												start={{ x: 0, y: 0 }}
												end={{ x: 0, y: 1 }}
												style={styles.cardOverlay}
											/>
										) : null}
										<LinearGradient
											colors={themeColors.cardAccentGradientVertical as any}
											start={{ x: 0, y: 0 }}
											end={{ x: 0, y: 1 }}
											style={styles.cardAccent}
										/>
									<View style={styles.cardContent}>
										{bgUri ? <View style={styles.cardContentBackdrop} /> : null}
										<View style={styles.cardHeaderRow}>
											<Text style={[styles.cardTitle, bgUri ? { color: '#fff' } : null]} numberOfLines={1}>{item.title}</Text>
											{item.completed ? (
												<View style={[styles.completedChip, bgUri ? { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: '#fff' } : null]}>
													<Ionicons name="checkmark-done-outline" size={14} color={bgUri ? '#fff' : themeColors.primaryDark} />
													<Text style={[styles.completedChipText, bgUri ? { color: '#fff' } : null]}>Completed</Text>
												</View>
											) : null}
											<LinearGradient
												colors={themeColors.cardAccentGradient as any}
												start={{ x: 0, y: 0 }}
												end={{ x: 1, y: 0 }}
												style={styles.badge}
											>
												<Text style={styles.badgeText}>{item.days.length}</Text>
											</LinearGradient>
										</View>
										<Text style={[styles.metaText, bgUri ? { color: '#efefef' } : null]}>
											{item.startDate ? formatDate(item.startDate) : 'Start ?'} → {item.endDate ? formatDate(item.endDate) : 'End ?'}
										</Text>
										{(() => {
											const days = computeDurationDays(item.startDate, item.endDate);
											if (!days) return null;
											return (
												<Text style={[styles.metaText, bgUri ? { color: '#efefef' } : null]}>Duration: {days} day{days === 1 ? '' : 's'}</Text>
											);
										})()}
										{(() => {
											const info = getDaysLabel(item);
											if (!info) return null;
											const accentKinds = new Set(['today', 'current']);
											const color = bgUri
												? (info.kind === 'future' ? '#a8c7ff' : accentKinds.has(info.kind) ? '#a3e635' : '#ffffffb3')
												: (info.kind === 'future'
													? themeColors.primary
													: accentKinds.has(info.kind)
													? themeColors.accent
													: themeColors.textSecondary);
											const fontStyle = info.kind === 'current' ? 'italic' : 'normal';
											return <Text style={[styles.countdownText, { color, fontStyle }]}>{info.text}</Text>;
										})()}
										{!!item.ship && <Text style={[styles.metaText, bgUri ? { color: '#efefef' } : null]}>Ship: {item.ship}</Text>}
										{!!item.ports?.length && <Text style={[styles.metaText, bgUri ? { color: '#efefef' } : null]}>Ports: {item.ports.length}</Text>}
										{/* Removed in-card Add Log button */}
									</View>
								</Pressable>
							</View>
						);
					}}
				/>
			)}
			{/* Floating bottom-left menu button */}
			<Pressable
				onPress={openFabMenu}
				accessibilityLabel="Open actions menu"
				style={{
					position: 'absolute',
					left: 20,
					bottom: fabBottom,
					width: 56,
					height: 56,
					borderRadius: 28,
					backgroundColor: themeColors.addBtnBg,
					alignItems: 'center',
					justifyContent: 'center',
					shadowColor: '#000',
					shadowOpacity: 0.25,
					shadowRadius: 8,
					shadowOffset: { width: 0, height: 2 },
					elevation: 6,
					zIndex: 100,
				}}
			>
				<Ionicons name="menu" size={28} color={themeColors.addBtnText} />
			</Pressable>

			{/* FAB Action Menu */}
			<Modal
				visible={fabMenuModalVisible}
				transparent
				animationType="fade"
				onRequestClose={closeFabMenu}
			>
				<Pressable style={styles.modalBackdrop} onPress={closeFabMenu} />
				<Animated.View
					style={{
						position: 'absolute',
						left: 20,
						bottom: fabBottom + FAB_SIZE + 50,
						opacity: menuOpacity,
						transform: [{ translateY: menuTranslate }],
					}}
				>
					<View style={styles.fabMenuCard}>
						
						<TouchableOpacity
							style={styles.pillOption}
							onPress={() => { closeFabMenu(); router.push('/(tabs)/trips/new' as any); }}
							accessibilityLabel="Add trip"
						>
							<Ionicons name="add-circle-outline" size={20} color={themeColors.addBtnText} />
							<Text style={styles.pillText}>Add trip</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.pillOption}
							onPress={() => { closeFabMenu(); exportAllTripsJSON(); }}
							accessibilityLabel="Export trips"
						>
							<Ionicons name="download-outline" size={20} color={themeColors.addBtnText} />
							<Text style={styles.pillText}>Export trips</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.pillOption}
							onPress={() => { closeFabMenu(); setShowSortMenu(true); }}
							accessibilityLabel="Open sort options"
						>
							<Ionicons name="swap-vertical-outline" size={20} color={themeColors.addBtnText} />
							<Text style={styles.pillText}>Sort options</Text>
						</TouchableOpacity>
					</View>
				</Animated.View>
			</Modal>
		</View>
	);
}


