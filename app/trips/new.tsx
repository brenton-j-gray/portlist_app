import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../components/ThemeContext';
import { addTrip, uid } from '../../lib/storage';
import { Trip } from '../../types';

/**
 * React component NewTripScreen: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
export default function NewTripScreen() {
  const { themeColors } = useTheme();
  const [title, setTitle] = useState('');
  const [ship, setShip] = useState('');
  const [startDate, setStartDate] = useState(''); // YYYY-MM-DD
  const [endDate, setEndDate] = useState('');
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  /**
     * React component toISODate: TODO describe purpose and where it’s used.
     * @param {Date} d - TODO: describe
     * @returns {string} TODO: describe
     */
    function toISODate(d: Date) {
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
     * React component parseISODate: TODO describe purpose and where it’s used.
     * @param {string | undefined} s - TODO: describe
     * @returns {Date} TODO: describe
     */
    function parseISODate(s: string | undefined): Date {
    if (!s) return new Date();
    const [y, m, d] = s.split('-').map((p) => parseInt(p, 10));
    if (!y || !m || !d) return new Date();
    // Months 0-indexed
    return new Date(y, m - 1, d);
  }

  /**
     * React component onChangeStart: TODO describe purpose and where it’s used.
     * @param {any} _event - TODO: describe
     * @param {Date | undefined} date - TODO: describe
     * @returns {void} TODO: describe
     */
    function onChangeStart(_event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setShowStart(false);
    if (!date) return;
    const v = toISODate(date);
    setStartDate(v);
    // If end is before start, clear it
  if (endDate && parseISODate(endDate) < date) setEndDate('');
  }

  /**
     * React component onChangeEnd: TODO describe purpose and where it’s used.
     * @param {any} _event - TODO: describe
     * @param {Date | undefined} date - TODO: describe
     * @returns {void} TODO: describe
     */
    function onChangeEnd(_event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setShowEnd(false);
    if (!date) return;
    const v = toISODate(date);
    setEndDate(v);
  }

  /**
     * React component onSave: TODO describe purpose and where it’s used.
     * @returns {Promise<void>} TODO: describe
     */
    async function onSave() {
    if (!title.trim()) return;
    // Validate end >= start when both provided
    if (startDate && endDate) {
      const s = parseISODate(startDate).getTime();
      const e = parseISODate(endDate).getTime();
      if (e < s) {
        Alert.alert('Invalid dates', 'End date cannot be before start date.');
        return;
      }
    }
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
  dateBtn: { borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, borderRadius: 8, padding: 12, marginBottom: 10 },
  dateText: { color: themeColors.text },
  btn: { backgroundColor: themeColors.primary, padding: 12, borderRadius: 10, alignItems: 'center' },
    btnText: { color: themeColors.badgeText, fontWeight: '700' },
  }), [themeColors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Trip</Text>

  <TextInput style={styles.input} placeholder="Trip title" placeholderTextColor={themeColors.textSecondary} value={title} onChangeText={setTitle} />
  <TextInput style={styles.input} placeholder="Ship (optional)" placeholderTextColor={themeColors.textSecondary} value={ship} onChangeText={setShip} />

  <Pressable style={styles.dateBtn} onPress={() => setShowStart(true)} accessibilityLabel="Choose start date">
    <Text style={styles.dateText}>{startDate ? `Start: ${startDate}` : 'Start date'}</Text>
  </Pressable>
  {showStart && (
    <DateTimePicker
      value={parseISODate(startDate)}
      mode="date"
      display={Platform.select({ android: 'calendar', ios: 'spinner', default: 'default' }) as any}
      onChange={onChangeStart}
      maximumDate={endDate ? parseISODate(endDate) : undefined}
    />
  )}

  <Pressable style={styles.dateBtn} onPress={() => setShowEnd(true)} accessibilityLabel="Choose end date">
    <Text style={styles.dateText}>{endDate ? `End: ${endDate}` : 'End date (optional)'}</Text>
  </Pressable>
  {showEnd && (
    <DateTimePicker
      value={parseISODate(endDate || startDate)}
      mode="date"
      display={Platform.select({ android: 'calendar', ios: 'spinner', default: 'default' }) as any}
      onChange={onChangeEnd}
      minimumDate={startDate ? parseISODate(startDate) : undefined}
    />
  )}

      <Pressable onPress={onSave} style={[styles.btn, !title.trim() && { opacity: 0.6 }]} disabled={!title.trim()}>
        <Text style={styles.btnText}>Save Trip</Text>
      </Pressable>
    </View>
  );
}
// styles via useMemo above
