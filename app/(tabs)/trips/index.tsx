// Trips tab root screen lives here under the folder-based route to enable nested screens.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, ImageBackground, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateWithPrefs, usePreferences } from '../../../components/PreferencesContext';

import { useTheme } from '../../../components/ThemeContext';
import { useToast } from '../../../components/ToastContext';
import { exportAllTrips, ExportFormat } from '../../../lib/exportTrip';
import { getTrips, saveTrips } from '../../../lib/storage';
import { Trip } from '../../../types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/**
 * React component parseLocalYmd: TODO describe purpose and where it’s used.
 * @param {any} s - TODO: describe
 * @returns {any} TODO: describe
 */
function parseLocalYmd(s: string): Date {
	const [y, m, d] = s.split('-').map(Number);
	return new Date(y, (m || 1) - 1, d || 1);
}
/**
 * React component startOfToday: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
function startOfToday(): Date {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
/**
 * React component parseLocalFromString: TODO describe purpose and where it’s used.
 * @param {any} dateStr - TODO: describe
 * @returns {any} TODO: describe
 */
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

/**
 * React component computeDurationDays: TODO describe purpose and where it’s used.
 * @param {any} start - TODO: describe
 * @param {any} end - TODO: describe
 * @returns {any} TODO: describe
 */
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

/**
 * React component TripsScreen: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
export default function TripsScreen() {
	const { themeColors } = useTheme();
	const { prefs, setPref } = usePreferences();
	const insets = useSafeAreaInsets();
	const [trips, setTrips] = useState<Trip[]>([]);
			const [sortBy, setSortBy] = useState<'created' | 'title' | 'startDate'>(prefs.defaultTripsSort);
		const [showExportMenu, setShowExportMenu] = useState(false);
			const { showProgress, update } = useToast();
			const handleExportAll = useCallback(async () => {
				const id = 'export_all';
				showProgress(id, 'Preparing export…');
				try {
					await exportAllTrips(prefs.exportFormat as ExportFormat || 'pdf');
					update(id, 'Export complete', 'success', 2500);
				} catch {
					update(id, 'Export failed', 'error', 4000);
				}
			}, [prefs.exportFormat, showProgress, update]);
	useEffect(() => { setSortBy(prefs.defaultTripsSort); }, [prefs.defaultTripsSort]);
	const [tab, setTab] = useState<'inprogress' | 'upcoming' | 'completed'>('upcoming');
	const [query, setQuery] = useState('');
	const [showSortMenu, setShowSortMenu] = useState(false);
	// FAB removed; dedicated Export + Sort buttons now inline / floating
	const [pendingDelete, setPendingDelete] = useState<Trip | null>(null);
	const [showUndo, setShowUndo] = useState(false);
	const undoTimerRef = useRef<number | null>(null);
	const [rowHeights, setRowHeights] = useState<Record<string, number>>({});

	const refresh = useCallback(async () => {
        const all = await getTrips();
        setTrips(all);
	}, []);

	const finalizeDelete = useCallback(async (trip: Trip) => {
		setTrips(prev => prev.filter(t => t.id !== trip.id));
		const remaining = (await getTrips()).filter(t => t.id !== trip.id);
		await saveTrips(remaining);
	}, []);

	const handleDelete = useCallback((trip: Trip) => {
		if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
		setPendingDelete(trip);
		finalizeDelete(trip);
		setShowUndo(true);
		undoTimerRef.current = setTimeout(() => {
			setPendingDelete(null);
			setShowUndo(false);
			undoTimerRef.current = null;
		}, 5000);
	}, [finalizeDelete]);

	const handleUndo = useCallback(async () => {
		if (!pendingDelete) return;
		if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
		const trip = pendingDelete;
		setPendingDelete(null);
		setShowUndo(false);
		setTrips(prev => [...prev, trip].sort((a,b)=>b.createdAt - a.createdAt));
		const existing = await getTrips();
		await saveTrips([...existing, trip]);
	}, [pendingDelete]);

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
		/**
     * React component isTripCompleted: TODO describe purpose and where it’s used.
     * @param {import("D:/Code/portlist_app/types").Trip} t - TODO: describe
     * @returns {boolean} TODO: describe
     */
    function isTripCompleted(t: Trip) {
			if (t.completed) return true;
			if (!t.endDate) return false;
			const endTs = parseLocalYmd(t.endDate).getTime();
			return endTs < startOfToday().getTime();
		}
		// In progress if start is on/before today and (no end or end is on/after today), and not explicitly completed
		/**
     * React component isTripInProgress: TODO describe purpose and where it’s used.
     * @param {import("D:/Code/portlist_app/types").Trip} t - TODO: describe
     * @returns {boolean} TODO: describe
     */
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
			tabsBar: {
				flexDirection: 'row',
				alignItems: 'flex-end',
				borderBottomWidth: 1,
				borderBottomColor: themeColors.primary,
				marginBottom: 10,
			},
			tabsRow: {
				flexDirection: 'row',
				alignItems: 'flex-end',
				gap: 6,
				marginBottom: 0,
			},
			tabBtn: {
				flex: 1,
				paddingVertical: 10,
				backgroundColor: themeColors.background,
				borderWidth: 1,
				borderColor: themeColors.menuBorder,
				borderBottomColor: themeColors.primary,
				borderTopLeftRadius: 10,
				borderTopRightRadius: 10,
				borderBottomLeftRadius: 0,
				borderBottomRightRadius: 0,
				borderBottomWidth: 1,
				alignItems: 'center',
				justifyContent: 'center',
				marginHorizontal: 2,
			},
			tabBtnActive: {
				backgroundColor: themeColors.card,
				borderColor: themeColors.primary,
				borderBottomWidth: 0,
				// Overlap the bottom strip so the active tab appears connected
				marginBottom: -1,
				zIndex: 3,
			},
			tabText: {
				fontSize: 15,
				fontWeight: '700',
				color: themeColors.text,
				letterSpacing: 0.2,
			},
			tabTextInactive: {
				color: themeColors.textSecondary,
			},
			searchRow: {
				flexDirection: 'row',
				alignItems: 'center',
				marginBottom: 6,
				marginTop: -2, // tighten space above search bar
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
		searchInput: { flex: 1, borderWidth: 1, borderColor: themeColors.primary, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
			secondaryBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: themeColors.primary, backgroundColor: themeColors.primary + '12' },
			iconBtn: { padding: 10, borderRadius: 999, borderWidth: 1, borderColor: themeColors.primary, backgroundColor: themeColors.primary + '12' },
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
	container: { flex: 1, padding: 16, backgroundColor: themeColors.background, paddingBottom: Math.max(24, (insets?.bottom || 0) + 16) },
	header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 },
	title: { fontSize: 30, fontWeight: '600', color: themeColors.text },
		addBtn: { backgroundColor: (themeColors as any).btnBg || themeColors.secondary, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 28 },
		addText: { color: (themeColors as any).btnText || '#FFFFFF', fontWeight: '600' },
		listContent: { paddingBottom: 30 + Math.max(0, (insets?.bottom || 0)) },
	card: {
			borderRadius: 18,
			backgroundColor: themeColors.card,
				borderWidth: 1,
				borderColor: themeColors.primary,
			overflow: 'hidden',
			position: 'relative',
			minHeight: 90,
		} as any,
		cardTextShadow: {
			textShadowColor: 'rgba(0,0,0,0.32)',
			textShadowOffset: { width: 0, height: 2 },
			textShadowRadius: 4,
		},
		cardBg: {
			position: 'absolute',
			left: 0,
			top: 0,
			right: 0,
			bottom: 0,
		} as any,
		cardBgZoom: {
			transform: [{ scale: 1.12 }], // Slight zoom to ensure full fill and crop
		},
		cardWhiteOverlay: {
			position: 'absolute',
			left: 0,
			top: 0,
			right: 0,
			bottom: 0,
			backgroundColor: 'rgba(255,255,255,0.10)', // very slight white overlay
			zIndex: 1,
			borderRadius: 18,
		},
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
			marginRight: 8, // Add space between completed badge and notes badge
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
				backgroundColor: (themeColors as any).btnBg || themeColors.secondary,
				borderWidth: 1,
				borderColor: themeColors.primaryDark + '29',
			},
			pillText: {
				fontSize: 15,
				fontWeight: '700',
				color: (themeColors as any).btnText || themeColors.badgeText,
			},
			inlineAddRow: {
				flexDirection: 'row',
				alignItems: 'center',
				gap: 10,
				marginBottom: 4,
			},
			inlineAddBtn: {
				flexDirection: 'row',
				alignItems: 'center',
				gap: 8,
				paddingVertical: 10,
				paddingHorizontal: 16,
				borderRadius: 14,
				backgroundColor: (themeColors as any).btnBg || themeColors.secondary,
				borderWidth: 1,
				borderColor: themeColors.primaryDark + '29',
				shadowColor: '#000',
				shadowOpacity: 0.15,
				shadowRadius: 4,
				shadowOffset: { width: 0, height: 2 },
				elevation: 2,
				justifyContent: 'center',
			},
			inlineAddText: {
				fontSize: 15,
				fontWeight: '700',
				letterSpacing: 0.2,
				color: (themeColors as any).btnText || themeColors.badgeText,
			},
	}), [themeColors, insets?.bottom]);


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

			{/* Browser-style status tabs under the search bar */}
			<View style={styles.tabsBar}>
				<View style={styles.tabsRow}>
				<Pressable
					style={[styles.tabBtn, tab === 'inprogress' && styles.tabBtnActive]}
					onPress={() => setTab('inprogress')}
					accessibilityRole="button"
					accessibilityLabel="Show In Progress trips"
				>
					<Text style={[styles.tabText, tab !== 'inprogress' && styles.tabTextInactive]}>In Progress</Text>
				</Pressable>
				<Pressable
					style={[styles.tabBtn, tab === 'upcoming' && styles.tabBtnActive]}
					onPress={() => setTab('upcoming')}
					accessibilityRole="button"
					accessibilityLabel="Show Upcoming trips"
				>
					<Text style={[styles.tabText, tab !== 'upcoming' && styles.tabTextInactive]}>Upcoming</Text>
				</Pressable>
				<Pressable
					style={[styles.tabBtn, tab === 'completed' && styles.tabBtnActive]}
					onPress={() => setTab('completed')}
					accessibilityRole="button"
					accessibilityLabel="Show Completed trips"
				>
					<Text style={[styles.tabText, tab !== 'completed' && styles.tabTextInactive]}>Completed</Text>
				</Pressable>
				</View>
			</View>

				{/* New Trip and Export inline left; sort button right */}
				<View style={[styles.inlineAddRow, { justifyContent: 'space-between', position: 'relative' }]}> 
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
						<Pressable
							onPress={handleExportAll}
							accessibilityLabel="Export all trips"
							style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.primary, alignItems: 'center', justifyContent: 'center' }}
						>
							<Ionicons name="download-outline" size={18} color={themeColors.primaryDark} />
						</Pressable>
						<Pressable
							style={[styles.inlineAddBtn, { width: undefined }]}
							onPress={() => router.push('/(tabs)/trips/new' as any)}
							accessibilityLabel="Add new trip"
						>
							<Ionicons name="add-circle-outline" size={20} color={(themeColors as any).btnText || themeColors.badgeText} />
							<Text style={styles.inlineAddText}>New Trip</Text>
						</Pressable>
					</View>
					<Pressable
						style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.primary, alignItems: 'center', justifyContent: 'center' }}
						onPress={() => setShowSortMenu(true)}
						accessibilityLabel="Open sort options"
					>
						<Ionicons name="swap-vertical-outline" size={20} color={themeColors.primaryDark} />
					</Pressable>
					<Pressable
						style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 10 }}
						onPress={() => setShowExportMenu(true)}
						accessibilityLabel="Choose export format"
					>
						<Ionicons name="document-text-outline" size={20} color={themeColors.primaryDark} />
					</Pressable>
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
							onPress={() => { setSortBy('created'); setPref('defaultTripsSort', 'created'); setShowSortMenu(false); }}
							accessibilityLabel="Sort by Recent"
						>
							<Text style={[styles.modalOptionText, sortBy === 'created' && styles.modalOptionTextActive]}>Recent</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.modalOption, sortBy === 'title' && styles.modalOptionActive]}
							onPress={() => { setSortBy('title'); setPref('defaultTripsSort', 'title'); setShowSortMenu(false); }}
							accessibilityLabel="Sort by A-Z"
						>
							<Text style={[styles.modalOptionText, sortBy === 'title' && styles.modalOptionTextActive]}>A-Z</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.modalOption, sortBy === 'startDate' && styles.modalOptionActive]}
							onPress={() => { setSortBy('startDate'); setPref('defaultTripsSort', 'startDate'); setShowSortMenu(false); }}
							accessibilityLabel="Sort by Start Date"
						>
							<Text style={[styles.modalOptionText, sortBy === 'startDate' && styles.modalOptionTextActive]}>Start Date</Text>
						</TouchableOpacity>
					</View>
				</View>
						</Modal>
						<Modal visible={showExportMenu} transparent animationType="fade" onRequestClose={() => setShowExportMenu(false)}>
								<Pressable style={styles.modalBackdrop} onPress={() => setShowExportMenu(false)} />
								<View style={styles.modalCenterWrap} pointerEvents="box-none">
										<View style={styles.modalCard}>
												<Text style={styles.modalTitle}>Export Format</Text>
												{(['pdf','json','txt','docx'] as ExportFormat[]).map(fmt => (
													<TouchableOpacity key={fmt} style={[styles.modalOption, prefs.exportFormat === fmt && styles.modalOptionActive]}
														onPress={() => { setPref('exportFormat', fmt as any); setShowExportMenu(false); }} accessibilityLabel={`Use ${fmt.toUpperCase()} format`}>
														<Text style={[styles.modalOptionText, prefs.exportFormat === fmt && styles.modalOptionTextActive]}>{fmt.toUpperCase()}</Text>
													</TouchableOpacity>
												))}
										</View>
								</View>
						</Modal>

			{/* Status menu modal removed in favor of folder tabs */}

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
							<View style={{ marginBottom: 16, borderRadius: 18 }}>
							<Swipeable
								overshootLeft={false}
								overshootRight={false}
								renderLeftActions={(progress) => {
									const opacity = progress.interpolate({ inputRange: [0, 0.05, 0.4, 1], outputRange: [0, 0.15, 0.85, 1], extrapolate: 'clamp' });
									const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1], extrapolate: 'clamp' });
									return (
										<Animated.View style={{ flexDirection: 'row', alignItems: 'center', opacity }}>
											<Animated.View style={{ transform: [{ scale }] }}>
												<Pressable
                                            onPress={() => router.push({ pathname: '/(tabs)/trips/[id]/edit' as any, params: { id: item.id } } as any)}
													accessibilityLabel={`Edit trip ${item.title}`}
													style={{
														width: 84,
														height: rowHeights[item.id] || 90,
														justifyContent: 'center',
														alignItems: 'center',
														backgroundColor: themeColors.primary,
														borderRadius: 18,
														marginRight: 8,
														shadowColor: '#000',
														shadowOpacity: 0.15,
														shadowRadius: 4,
														shadowOffset: { width: 0, height: 2 },
														elevation: 2,
													}}
												>
													<Ionicons name="create-outline" size={26} color={themeColors.badgeText} />
													<Text style={{ color: themeColors.badgeText, fontSize: 12, fontWeight: '700', marginTop: 4 }}>Edit</Text>
												</Pressable>
											</Animated.View>
										</Animated.View>
									);
								}}
								renderRightActions={(progress) => {
									const opacity = progress.interpolate({ inputRange: [0, 0.05, 0.4, 1], outputRange: [0, 0.15, 0.85, 1], extrapolate: 'clamp' });
									const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1], extrapolate: 'clamp' });
									return (
										<Animated.View style={{ flexDirection: 'row', alignItems: 'center', opacity }}>
											<Animated.View style={{ transform: [{ scale }] }}>
												<Pressable
													onPress={() => handleDelete(item)}
													accessibilityLabel={`Delete trip ${item.title}`}
													style={{
														width: 84,
														height: rowHeights[item.id] || 90,
														justifyContent: 'center',
														alignItems: 'center',
														backgroundColor: themeColors.danger,
														borderRadius: 18,
														marginLeft: 8,
														shadowColor: '#000',
														shadowOpacity: 0.15,
														shadowRadius: 4,
														shadowOffset: { width: 0, height: 2 },
														elevation: 2,
													}}
												>
													<Ionicons name="trash-outline" size={26} color={themeColors.badgeText} />
													<Text style={{ color: themeColors.badgeText, fontSize: 12, fontWeight: '700', marginTop: 4 }}>Delete</Text>
												</Pressable>
											</Animated.View>
										</Animated.View>
									);
								}}
							>
								<View style={{ position: 'relative' }}>
									<Pressable
										onLayout={(e)=>{ const h = e.nativeEvent.layout.height; setRowHeights(prev => prev[item.id]===h?prev:{...prev,[item.id]:h}); }}
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
											<>
												<ImageBackground
													source={{ uri: bgUri }}
													style={[styles.cardBg, styles.cardBgZoom]}
													resizeMode="cover"
													blurRadius={8}
												/>
												<View style={styles.cardWhiteOverlay} pointerEvents="none" />
											</>
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
											<View style={styles.cardHeaderRow}>
												<Text
													style={[
														styles.cardTitle,
														bgUri ? styles.cardTextShadow : null,
														bgUri ? { color: '#fff' } : null
													]}
													numberOfLines={1}
												>
													{item.title}
												</Text>
												{item.completed ? (
													<View style={[styles.completedChip, bgUri ? { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: '#fff' } : null]}>
													<Ionicons name="checkmark-done-outline" size={14} color={bgUri ? '#fff' : themeColors.primaryDark} />
													<Text style={[styles.completedChipText, bgUri ? { color: '#fff' } : null]}>Completed</Text>
												</View>
											) : null}
											{/* Notes badge removed; integrated into summary sentences */}
										</View>
										{/* Date line restored under title */}
											{(() => {
											/**
                                                     * React component fullFmt: TODO describe purpose and where it’s used.
                                                     * @param {string | undefined} d - TODO: describe
                                                     * @returns {string} TODO: describe
                                                     */
                                                    function fullFmt(d?: string) {
												if (!d) return '';
												return formatDateWithPrefs(d, prefs, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
											}
											let text = '';
											if (item.startDate && item.endDate) {
												if (item.startDate === item.endDate) text = fullFmt(item.startDate);
												else {
													text = `${fullFmt(item.startDate)} – ${fullFmt(item.endDate)}`;
												}
											} else if (item.startDate) {
												text = fullFmt(item.startDate);
											} else if (item.endDate) {
												text = fullFmt(item.endDate);
											}
											if (!text) return null;
											const lineColor = bgUri ? { color: '#f3f3f3' } : null;
											return <Text style={[styles.metaText, { fontWeight: '700' }, bgUri ? styles.cardTextShadow : null, lineColor]}>{text}</Text>;
										})()}
										{(() => {
											const duration = computeDurationDays(item.startDate, item.endDate);
											const portsCount = item.ports?.length || 0;
											const notesCount = item.days.length;
											const seaDays = item.days.filter(d => (d as any).isSeaDay).length;
											const parts: string[] = ['A'];
											if (duration) parts.push(`${duration}-day`);
											parts.push('cruise');
											if (item.ship) parts.push('on the ' + item.ship); else parts.push('(ship TBD)');
											if (portsCount > 0) parts.push(`visiting ${portsCount} port${portsCount === 1 ? '' : 's'}`);
											const extras: string[] = [];
											if (notesCount > 0) extras.push(`${notesCount} note${notesCount === 1 ? '' : 's'}`);
											if (seaDays > 0) extras.push(`${seaDays} sea day${seaDays === 1 ? '' : 's'}`);
											let sentence1 = parts.join(' ');
											if (extras.length) sentence1 += ' (' + extras.join(', ') + ')';
											if (!sentence1.endsWith('.')) sentence1 += '.'; // date range now shown above title line
											let sentence2 = '';
											if (item.startDate) {
												const todayMid = startOfToday().getTime();
												const startTs = parseLocalYmd(item.startDate).getTime();
												if (item.endDate) {
													const endTs = parseLocalYmd(item.endDate).getTime();
													if (todayMid >= startTs && todayMid <= endTs) {
														const dayNumber = Math.floor((todayMid - startTs) / MS_PER_DAY) + 1;
														const totalDays = duration || Math.floor((endTs - startTs) / MS_PER_DAY) + 1;
														const daysLeftCount = Math.floor((endTs - todayMid) / MS_PER_DAY);
														let tail = '';
														if (daysLeftCount < 0) tail = 'ended';
														else if (daysLeftCount === 0) tail = 'ends today';
														else tail = `ends in ${daysLeftCount} day${daysLeftCount === 1 ? '' : 's'}`;
														sentence2 = `Day ${dayNumber} of ${totalDays} (${tail})`;
													} else if (startTs > todayMid) {
														const daysUntil = Math.floor((startTs - todayMid) / MS_PER_DAY);
														if (daysUntil === 0) sentence2 = 'Begins today';
														else if (daysUntil === 1) sentence2 = 'Begins tomorrow';
														else sentence2 = `Begins in ${daysUntil} days`;
													} else if (todayMid > endTs) {
														const daysSinceEnd = Math.floor((todayMid - endTs) / MS_PER_DAY);
														if (daysSinceEnd === 1) sentence2 = 'Ended yesterday';
														else sentence2 = `Ended ${daysSinceEnd} days ago`;
													}
												} else {
													if (startTs > todayMid) {
														const daysUntil = Math.floor((startTs - todayMid) / MS_PER_DAY);
														if (daysUntil === 0) sentence2 = 'Begins today';
														else if (daysUntil === 1) sentence2 = 'Begins tomorrow';
														else sentence2 = `Begins in ${daysUntil} days`;
													} else if (startTs === todayMid) {
														sentence2 = 'Began today';
													} else {
														sentence2 = 'In progress';
													}
												}
											}
											if (!item.startDate && !item.endDate && typeof item.createdAt === 'number') {
												const createdDate = new Date(item.createdAt);
												const createdMid = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate()).getTime();
												const diff = Math.floor((startOfToday().getTime() - createdMid) / MS_PER_DAY);
												sentence2 = diff <= 0 ? 'Created today' : `Created ${diff} day${diff === 1 ? '' : 's'} ago`;
											}
											const lineColor = bgUri ? { color: '#efefef' } : null;
											return (
												<>
													<Text style={[styles.metaText, bgUri ? styles.cardTextShadow : null, lineColor]} numberOfLines={3}>{sentence1}</Text>
													{!!sentence2 && <Text style={[styles.metaText, bgUri ? styles.cardTextShadow : null, lineColor]}>{sentence2}</Text>}
												</>
											);
										})()}
									</View>
								</Pressable>
								</View>
							</Swipeable>
							</View>
						);
					}}
				/>
			)}

			{showUndo && (
				<View style={{ position: 'absolute', left: 20, right: 20, bottom: Math.max(20, (insets?.bottom||0)+20), backgroundColor: themeColors.card, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: themeColors.menuBorder, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 6 }}>
					<Text style={{ color: themeColors.text, fontSize: 14, fontWeight: '600' }}>Trip deleted</Text>
					<Pressable onPress={handleUndo} accessibilityLabel="Undo delete" style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
						<Text style={{ color: themeColors.primaryDark, fontWeight: '700', fontSize: 14 }}>UNDO</Text>
					</Pressable>
				</View>
			)}
		</View>
	);
}


