import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getTripById, uid, upsertTrip } from '../../../lib/storage';
import { DayLog, Trip } from '../../../types';

export default function NewDayLogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | undefined>();
  const [date, setDate] = useState<string>('');
  const [weather, setWeather] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    (async () => {
      if (!id) return;
      const t = await getTripById(id);
      setTrip(t);
    })();
  }, [id]);

  async function onSave() {
    if (!trip) return;
    const log: DayLog = { id: uid(), date: date || new Date().toISOString().slice(0,10), weather, notes };
    const updated: Trip = { ...trip, days: [...trip.days, log] };
    await upsertTrip(updated);
    router.replace(`/trips/${trip.id}`);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Day Log</Text>
      <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <TextInput style={styles.input} placeholder="Weather (optional)" value={weather} onChangeText={setWeather} />
      <TextInput style={[styles.input, { height: 120 }]} multiline placeholder="Notes" value={notes} onChangeText={setNotes} />
      <Pressable onPress={onSave} style={styles.btn}>
        <Text style={styles.btnText}>Save Log</Text>
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
