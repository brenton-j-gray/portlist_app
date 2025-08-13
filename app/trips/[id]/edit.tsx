import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getTripById, upsertTrip } from '../../../lib/storage';
import { Trip } from '../../../types';

export default function EditTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | undefined>();
  const [title, setTitle] = useState('');
  const [ship, setShip] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    (async () => {
      if (!id) return;
      const t = await getTripById(id);
      if (t) {
        setTrip(t);
        setTitle(t.title);
        setShip(t.ship || '');
        setStartDate(t.startDate || '');
        setEndDate(t.endDate || '');
      }
    })();
  }, [id]);

  async function onSave() {
    if (!trip) return;
    if (!title.trim()) {
      Alert.alert('Title required');
      return;
    }
    const updated: Trip = { ...trip, title: title.trim(), ship: ship.trim() || undefined, startDate: startDate || undefined, endDate: endDate || undefined };
    await upsertTrip(updated);
    router.replace(`/trips/${trip.id}`);
  }

  if (!trip) {
    return <View style={styles.container}><Text>Loading...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Trip</Text>
      <TextInput style={styles.input} placeholder="Trip title" value={title} onChangeText={setTitle} />
      <TextInput style={styles.input} placeholder="Ship (optional)" value={ship} onChangeText={setShip} />
      <TextInput style={styles.input} placeholder="Start date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} />
      <TextInput style={styles.input} placeholder="End date (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} />
      <Pressable onPress={onSave} style={[styles.btn, !title.trim() && { opacity: 0.6 }]} disabled={!title.trim()}>
        <Text style={styles.btnText}>Save Changes</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, marginBottom: 10 },
  btn: { backgroundColor: '#6366f1', padding: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '700' },
});
