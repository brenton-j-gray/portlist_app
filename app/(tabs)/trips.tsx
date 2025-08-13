import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { getTrips } from '../../lib/storage';
import { Trip } from '../../types';

export default function TripsScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);

  const refresh = useCallback(async () => {
    const all = await getTrips();
    setTrips(all.sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Trips</Text>
        <Link href="/trips/new" style={styles.addBtn}>
          <Text style={styles.addText}>+ New Trip</Text>
        </Link>
      </View>

      {trips.length === 0 ? (
        <Text>No trips yet. Tap + New Trip to begin.</Text>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Link href={`/trips/${item.id}`} style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text>{item.startDate ?? 'Start ?'} → {item.endDate ?? 'End ?'}</Text>
              {!!item.ship && <Text>Ship: {item.ship}</Text>}
              <Text>{item.days.length} day logs</Text>
            </Link>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  addBtn: { backgroundColor: '#1e90ff', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  addText: { color: 'white', fontWeight: '600' },
  card: { padding: 14, borderRadius: 12, backgroundColor: '#f3f4f6', marginBottom: 10 },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
});
