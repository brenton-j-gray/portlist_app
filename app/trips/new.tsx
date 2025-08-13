import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { addTrip, uid } from '../../lib/storage';
import { Trip } from '../../types';

export default function NewTripScreen() {
  const [title, setTitle] = useState('');
  const [ship, setShip] = useState('');
  const [startDate, setStartDate] = useState(''); // simple text for MVP (YYYY-MM-DD)
  const [endDate, setEndDate] = useState('');

  async function onSave() {
    if (!title.trim()) return;
    const trip: Trip = {
      id: uid(),
      title: title.trim(),
      ship: ship.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      ports: [],
      days: [],
      createdAt: Date.now(),
    };
    await addTrip(trip);
    router.replace(`/trips/${trip.id}`);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Trip</Text>

      <TextInput style={styles.input} placeholder="Trip title" value={title} onChangeText={setTitle} />
      <TextInput style={styles.input} placeholder="Ship (optional)" value={ship} onChangeText={setShip} />
      <TextInput style={styles.input} placeholder="Start date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} />
      <TextInput style={styles.input} placeholder="End date (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} />

      <Pressable onPress={onSave} style={[styles.btn, !title.trim() && { opacity: 0.6 }]} disabled={!title.trim()}>
        <Text style={styles.btnText}>Save Trip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, marginBottom: 10 },
  btn: { backgroundColor: '#10b981', padding: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '700' },
});
