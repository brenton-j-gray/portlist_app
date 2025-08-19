// Format date as DAY DD MMM YYYY, parsing YYYY-MM-DD as local date to avoid timezone shift
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pill } from '../../../components/Pill';
import { useTheme } from '../../../components/ThemeContext';
import { exportTripJSON } from '../../../lib/exportTrip';
import { getTripById } from '../../../lib/storage';
import { Note, Trip } from '../../../types';
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
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const days = Math.floor((e.getTime() - s.getTime()) / MS_PER_DAY) + 1; // inclusive
  return days > 0 ? days : null;
}

export default function TripDetail() {
  const { themeColors, colorScheme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | undefined>(undefined);
  const [showActions, setShowActions] = useState(false);
  const [fabMenuModalVisible, setFabMenuModalVisible] = useState(false);
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuTranslate = useRef(new Animated.Value(8)).current;
  const FAB_SIZE = 56;
  const insets = useSafeAreaInsets();

  const refresh = useCallback(async () => {
    if (!id) return;
    const t = await getTripById(id);
    setTrip(t);
  }, [id]);

  useEffect(() => { refresh(); }, [id, refresh]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 0, backgroundColor: themeColors.background },
    gradientHeader: {
      paddingTop: 48,
      paddingBottom: 28,
      paddingHorizontal: 24,
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
      alignItems: 'flex-start',
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
    headerIconBtn: {
      position: 'absolute',
      right: 16,
      top: 50,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)'
    },
    headerTitle: {
      color: '#fff',
      fontSize: 28,
      fontWeight: '700',
      marginBottom: 4,
      letterSpacing: 0.2,
    },
    headerDates: {
      color: '#e0e7ff',
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 2,
    },
    summaryCard: {
      backgroundColor: themeColors.card,
      borderRadius: 18,
      marginHorizontal: 18,
      marginTop: -24,
      marginBottom: 18,
      padding: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius: 6,
      elevation: 2,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    summaryIcon: { marginRight: 10 },
    summaryText: { fontSize: 16, color: themeColors.text, fontWeight: '500' },
  headerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 },
  btn: { backgroundColor: themeColors.primary, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, marginTop: 2 },
  btnAlt: { backgroundColor: themeColors.actionBtnBg, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, marginTop: 2, borderWidth: 1, borderColor: themeColors.primaryDark + '29' },
  btnText: { color: themeColors.addBtnText, fontWeight: '700', fontSize: 16 },
  btnTextAlt: { color: themeColors.text, fontWeight: '700', fontSize: 16 },
    card: { padding: 12, borderRadius: 12, backgroundColor: themeColors.card, marginTop: 10 },
    cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4, color: themeColors.text },
  listContent: { paddingTop: 12, paddingBottom: 120, paddingHorizontal: 18 },
    emptyText: { marginTop: 24, textAlign: 'center', color: themeColors.textSecondary },
  }), [themeColors]);

  if (!trip) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: themeColors.background }}><Text style={{ color: themeColors.textSecondary }}>Loading trip...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={themeColors.cardAccentGradient as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
  >
        <Text style={styles.headerTitle}>{trip.title}</Text>
      </LinearGradient>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Ionicons name="calendar-outline" size={20} color={themeColors.primaryDark} style={styles.summaryIcon} />
          <Text style={styles.summaryText}>{trip.startDate ? formatDate(trip.startDate) : '?'} → {trip.endDate ? formatDate(trip.endDate) : '?'}</Text>
        </View>
        {(() => {
          const d = computeDurationDays(trip.startDate, trip.endDate);
          if (!d) return null;
          return (
            <View style={styles.summaryRow}>
              <Ionicons name="time-outline" size={20} color={themeColors.primaryDark} style={styles.summaryIcon} />
              <Text style={styles.summaryText}>Duration: {d} day{d === 1 ? '' : 's'}</Text>
            </View>
          );
        })()}
        {!!trip.ship && (
          <View style={styles.summaryRow}>
            <Ionicons name="boat-outline" size={20} color={themeColors.primary} style={styles.summaryIcon} />
            <Text style={styles.summaryText}>{trip.ship}</Text>
          </View>
        )}
        {!!trip.ports?.length && (
          <View style={styles.summaryRow}>
            <Ionicons name="location-outline" size={20} color={themeColors.accent} style={styles.summaryIcon} />
            <Text style={styles.summaryText}>{trip.ports.length} port{trip.ports.length > 1 ? 's' : ''}</Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Ionicons name="document-text-outline" size={20} color={themeColors.highlight} style={styles.summaryIcon} />
          <Text style={styles.summaryText}>{trip.days.length} note{trip.days.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

  {trip.days.length === 0 ? (
    <Text style={styles.emptyText}>No notes yet. Add your first one.</Text>
      ) : (
        <FlatList
          data={trip.days}
          keyExtractor={(d) => d.id}
      renderItem={({ item }) => <DayItem item={item} themeColors={themeColors} colorScheme={colorScheme} tripId={String(id)} />}
          contentContainerStyle={styles.listContent}
          onScrollBeginDrag={() => { if (showActions) setShowActions(false); }}
        />
      )}

      {/* Floating bottom-left menu button (mirrors Trips tab) */}
      {(() => {
        const fabBottom = Math.max(12, (insets?.bottom || 0) + 20);

        const openFabMenu = () => {
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
        };
        const closeFabMenu = () => {
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
        };

        return (
          <>
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
                backgroundColor: themeColors.primary,
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
              <Ionicons name="menu" size={28} color={themeColors.badgeText} />
            </Pressable>

            <Modal
              visible={fabMenuModalVisible}
              transparent
              animationType="fade"
              onRequestClose={closeFabMenu}
            >
              <Pressable style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={closeFabMenu} />
              <Animated.View style={{ position: 'absolute', left: 20, bottom: fabBottom + FAB_SIZE + 50, opacity: menuOpacity, transform: [{ translateY: menuTranslate }] }}>
                <View style={{ minWidth: 200, borderRadius: 12, backgroundColor: 'transparent', padding: 8 }}>
                  <Pressable
                    onPress={() => { closeFabMenu(); router.push({ pathname: '/(tabs)/trips/[id]/note-new' as any, params: { id: trip.id } } as any); }}
                    accessibilityLabel="Add note"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 999, marginVertical: 6, backgroundColor: themeColors.primary, borderWidth: 1, borderColor: themeColors.primaryDark + '29' }}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={themeColors.badgeText} />
                    <Text style={{ fontSize: 15, color: themeColors.badgeText, fontWeight: '700' }}>Add note</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { closeFabMenu(); exportTripJSON(trip); }}
                    accessibilityLabel="Export trip"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 999, marginVertical: 6, backgroundColor: themeColors.primary, borderWidth: 1, borderColor: themeColors.primaryDark + '29' }}
                  >
                    <Ionicons name="download-outline" size={20} color={themeColors.badgeText} />
                    <Text style={{ fontSize: 15, color: themeColors.badgeText, fontWeight: '700' }}>Export trip</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { closeFabMenu(); router.push({ pathname: '/(tabs)/trips/[id]/edit' as any, params: { id: trip.id } } as any); }}
                    accessibilityLabel="Edit trip"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 999, marginVertical: 6, backgroundColor: themeColors.primary, borderWidth: 1, borderColor: themeColors.primaryDark + '29' }}
                  >
                    <Ionicons name="create-outline" size={20} color={themeColors.badgeText} />
                    <Text style={{ fontSize: 15, color: themeColors.badgeText, fontWeight: '700' }}>Edit trip</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </Modal>
          </>
        );
      })()}
    </View>
  );
}

function DayItem({ item, themeColors, colorScheme, tripId }: { item: Note, themeColors: any, colorScheme: 'light' | 'dark', tripId: string }) {
  const thumbUri = item.photos?.[0]?.uri || item.photoUri;
  return (
    <Pressable
  onPress={() => router.push({ pathname: '/(tabs)/trips/[id]/note/[noteId]' as any, params: { id: tripId, noteId: item.id } } as any)}
      style={{ padding: 12, borderRadius: 12, backgroundColor: themeColors.card, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}
      accessibilityLabel={`Edit note ${item.date}`}
    >
      {thumbUri ? (
        <Image source={{ uri: thumbUri }} style={{ width: 64, height: 64, borderRadius: 8 }} />
      ) : (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 8,
            backgroundColor: themeColors.card,
            borderWidth: 1,
            borderColor: themeColors.menuBorder,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityLabel="No photo yet"
        >
          <Ionicons name="image-outline" size={24} color={themeColors.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        {!!item.title && <Text numberOfLines={1} style={{ fontSize: 16, color: themeColors.text, fontWeight: '600' }}>{item.title}</Text>}
        <Text style={{ fontWeight: '600', color: themeColors.text, marginTop: item.title ? 2 : 0 }}>{item.date}</Text>
        {!!item.description && <Text numberOfLines={2} style={{ color: themeColors.textSecondary, marginTop: 2 }}>{item.description}</Text>}
        {!!item.notes && <Text numberOfLines={2} style={{ color: themeColors.textSecondary, marginTop: 2 }}>{item.notes}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
          {!!item.weather && (
            <Pill variant="accent" iconName={(item.weather + '-outline') as any}>
              {item.weather}
            </Pill>
          )}
          {!!(item.locationName || item.location) && (
            <Pill variant="highlight" iconName="location-outline">
              {(() => {
                const label = item.locationName || '';
                if (/.*,\s*[A-Z]{2}$/i.test(label)) return label;
                const parts = label.split(',').map(p => p.trim()).filter(Boolean);
                if (parts.length >= 2) return `${parts[0]}, ${parts[parts.length - 1]}`;
                return label || 'Location added';
              })()}
            </Pill>
          )}
        </View>
      </View>
    </Pressable>
  );
}
