import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../components/ThemeContext';
import { addTrip, uid } from '../../lib/storage';
import { Trip } from '../../types';

export default function NewTripScreen() {
  const { themeColors } = useTheme();
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

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: themeColors.background },
    title: { fontSize: 22, fontWeight: '600', marginBottom: 12, color: themeColors.text },
    input: { borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, padding: 10, marginBottom: 10 },
    btn: { backgroundColor: themeColors.primary, padding: 12, borderRadius: 10, alignItems: 'center' },
    btnText: { color: themeColors.badgeText, fontWeight: '700' },
  }), [themeColors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Trip</Text>

  <TextInput style={styles.input} placeholder="Trip title" placeholderTextColor={themeColors.textSecondary} value={title} onChangeText={setTitle} />
  <TextInput style={styles.input} placeholder="Ship (optional)" placeholderTextColor={themeColors.textSecondary} value={ship} onChangeText={setShip} />
  <TextInput style={styles.input} placeholder="Start date (YYYY-MM-DD)" placeholderTextColor={themeColors.textSecondary} value={startDate} onChangeText={setStartDate} />
  <TextInput style={styles.input} placeholder="End date (YYYY-MM-DD)" placeholderTextColor={themeColors.textSecondary} value={endDate} onChangeText={setEndDate} />

      <Pressable onPress={onSave} style={[styles.btn, !title.trim() && { opacity: 0.6 }]} disabled={!title.trim()}>
        <Text style={styles.btnText}>Save Trip</Text>
      </Pressable>
    </View>
  );
}
// styles via useMemo above
