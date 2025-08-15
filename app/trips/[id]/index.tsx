// Format date as DAY DD MMM YYYY, parsing YYYY-MM-DD as local date to avoid timezone shift
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../components/ThemeContext';
import { exportTripJSON } from '../../../lib/exportTrip';
import { getTripById } from '../../../lib/storage';
import { DayLog, Trip } from '../../../types';
function formatDate(dateStr: string) {
  if (!dateStr) return '';
  let d;
  // Parse YYYY-MM-DD as local date
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(dateStr);
  if (match) {
    const [year, month, day] = dateStr.split('-').map(Number);
    d = new Date(year, month - 1, day);
  } else {
    d = new Date(dateStr);
  }
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function TripDetail() {
  const { themeColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | undefined>(undefined);
  const [showActions, setShowActions] = useState(false);

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
    listContent: { paddingTop: 12, paddingBottom: 24 },
    emptyText: { marginTop: 24, textAlign: 'center', color: themeColors.textSecondary },
  }), [themeColors]);

  if (!trip) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: themeColors.background }}><Text style={{ color: themeColors.textSecondary }}>Loading trip...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[themeColors.primaryDark, themeColors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        <Pressable
          onPress={() => router.push(`/trips/${trip.id}/edit`)}
          style={styles.headerIconBtn}
          accessibilityLabel="Edit Trip"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="create-outline" size={20} color="#ffffff" />
        </Pressable>
        <Text style={styles.headerTitle}>{trip.title}</Text>
        <Text style={styles.headerDates}>{trip.startDate ? formatDate(trip.startDate) : '?'} → {trip.endDate ? formatDate(trip.endDate) : '?'}</Text>
      </LinearGradient>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Ionicons name="calendar-outline" size={20} color={themeColors.primaryDark} style={styles.summaryIcon} />
          <Text style={styles.summaryText}>{trip.startDate ? formatDate(trip.startDate) : '?'} → {trip.endDate ? formatDate(trip.endDate) : '?'}</Text>
        </View>
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
          <Ionicons name="document-text-outline" size={20} color={themeColors.accent} style={styles.summaryIcon} />
          <Text style={styles.summaryText}>{trip.days.length} day log{trip.days.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>
      <View style={styles.headerActions}>
        <Link href={`/trips/${trip.id}/edit`} style={styles.btnAlt}>
          <Text style={styles.btnTextAlt}>Edit Trip</Text>
        </Link>
        <Pressable onPress={() => exportTripJSON(trip)} style={styles.btnAlt} accessibilityLabel="Export Trip">
          <Text style={styles.btnTextAlt}>Export</Text>
        </Pressable>
        <Link href={`/trips/${trip.id}/log-new`} style={styles.btn}>
          <Text style={styles.btnText}>+ Log Day</Text>
        </Link>
      </View>
    {trip.days.length === 0 ? (
        <Text style={styles.emptyText}>No day logs yet. Add your first one.</Text>
      ) : (
        <FlatList
          data={trip.days}
          keyExtractor={(d) => d.id}
      renderItem={({ item }) => <DayItem item={item} themeColors={themeColors} tripId={String(id)} />}
          contentContainerStyle={styles.listContent}
          onScrollBeginDrag={() => { if (showActions) setShowActions(false); }}
        />
      )}
    </View>
  );
}

function DayItem({ item, themeColors, tripId }: { item: DayLog, themeColors: any, tripId: string }) {
  return (
    <Pressable
  onPress={() => router.push({ pathname: '/trips/[id]/log/[logId]/edit', params: { id: tripId, logId: item.id } })}
      style={{ padding: 12, borderRadius: 12, backgroundColor: themeColors.card, marginTop: 10 }}
      accessibilityLabel={`Edit log ${item.date}`}
    >
      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 4, color: themeColors.text }}>{item.date}</Text>
      {!!item.weather && <Text style={{ color: themeColors.textSecondary }}>Weather: {item.weather}</Text>}
      {!!item.notes && <Text numberOfLines={2} style={{ color: themeColors.textSecondary }}>{item.notes}</Text>}
      {!!item.photos?.length && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {item.photos.map((p, idx) => (
            <Image key={`${p.uri}-${idx}`} source={{ uri: p.uri }} style={{ width: 84, height: 84, borderRadius: 8 }} />
          ))}
        </View>
      )}
    </Pressable>
  );
}
