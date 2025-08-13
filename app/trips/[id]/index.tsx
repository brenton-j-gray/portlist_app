import { Link, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { deleteTrip, getTripById } from '../../../lib/storage';
import { DayLog, Trip } from '../../../types';
import { exportTripJSON } from './exporter';

export default function TripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!id) return;
    const t = await getTripById(id);
    setTrip(t);
  }, [id]);

  useEffect(() => { refresh(); }, [id, refresh]);

  if (!trip) {
    return (
      <View style={styles.container}><Text>Loading trip...</Text></View>
    );
  }

  function safeNavigateAfterDelete() {
    // Try going back; if no history (web) fallback to root trips tab
    try {
      router.back();
    } catch {
      router.replace('/trips');
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{trip.title}</Text>
        <View style={styles.buttonRow}>
          <Link href={`/trips/${trip.id}/log-new`} style={[styles.btn, styles.btnSpacing]}>
            <Text style={styles.btnText}>+ Log Day</Text>
          </Link>
          <Link href={`/trips/${trip.id}/edit`} style={[styles.btn, styles.secondaryBtn, styles.btnSpacing]}>
            <Text style={styles.btnText}>Edit</Text>
          </Link>
          <Pressable style={[styles.btn, styles.exportBtn, styles.btnSpacing]} onPress={() => exportTripJSON(trip)}>
            <Text style={styles.btnText}>Export</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.deleteBtn]}
            onPress={async () => {
              // Native platforms: use Alert API with buttons
              if (Platform.OS !== 'web') {
                Alert.alert('Delete Trip', 'Are you sure? This cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTrip(trip.id); safeNavigateAfterDelete(); } },
                ]);
                return;
              }
              // Web: simple confirm dialog
              if (window.confirm('Delete this trip? This cannot be undone.')) {
                await deleteTrip(trip.id);
                safeNavigateAfterDelete();
              }
            }}
          >
            <Text style={styles.btnText}>Del</Text>
          </Pressable>
        </View>
      </View>

      <Text style={{ marginBottom: 8 }}>{trip.startDate ?? '?'} → {trip.endDate ?? '?'}</Text>
      {!!trip.ship && <Text style={{ marginBottom: 12 }}>Ship: {trip.ship}</Text>}

      {trip.days.length === 0 ? (
        <Text>No day logs yet. Add your first one.</Text>
      ) : (
        <FlatList
          data={trip.days}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => <DayItem item={item} />}
        />
      )}
    </View>
  );
}

function DayItem({ item }: { item: DayLog }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.date}</Text>
      {!!item.weather && <Text>Weather: {item.weather}</Text>}
      {!!item.notes && <Text numberOfLines={2}>{item.notes}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  buttonRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  btn: { backgroundColor: '#1e90ff', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  btnSpacing: { marginRight: 8 },
  secondaryBtn: { backgroundColor: '#64748b' },
  exportBtn: { backgroundColor: '#6366f1' },
  deleteBtn: { backgroundColor: '#dc2626' },
  btnText: { color: 'white', fontWeight: '600' },
  card: { padding: 12, borderRadius: 12, backgroundColor: '#f3f4f6', marginTop: 10 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
});
