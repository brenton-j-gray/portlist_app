import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../../components/ThemeContext';
import { deleteTrip, getTripById, upsertTrip } from '../../../lib/storage';
import { Trip } from '../../../types';
function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function EditTripScreen() {
  const { themeColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | undefined>();
  const [title, setTitle] = useState('');
  const [ship, setShip] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');

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

  async function performDelete() {
    if (!trip) return;
    await deleteTrip(trip.id);
    router.replace('/trips');
  }

  function onDelete() {
    setConfirmText('');
    setShowDeleteModal(true);
  }

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: themeColors.background },
    title: { fontSize: 22, fontWeight: '600', marginBottom: 12, color: themeColors.text },
    input: { borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, padding: 10, marginBottom: 10 },
    btn: { backgroundColor: themeColors.primaryDark, padding: 12, borderRadius: 10, alignItems: 'center' },
    btnText: { color: themeColors.badgeText, fontWeight: '700' },
    label: { fontSize: 14, fontWeight: '500', marginBottom: 2, marginLeft: 2, color: themeColors.textSecondary },
  delBtn: { backgroundColor: themeColors.danger, padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  delBtnText: { color: themeColors.badgeText, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: themeColors.card, borderRadius: 14, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: themeColors.menuBorder },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6, color: themeColors.text },
  modalMessage: { fontSize: 14, color: themeColors.textSecondary, marginBottom: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtnCancel: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card },
  modalBtnCancelText: { color: themeColors.text, fontWeight: '600' },
  modalInput: { borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.background, color: themeColors.text, borderRadius: 8, padding: 10, marginBottom: 14 },
  modalBtnDelete: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: themeColors.danger },
  modalBtnDeleteText: { color: themeColors.badgeText, fontWeight: '700' },
  }), [themeColors]);

  if (!trip) {
    return <View style={styles.container}><Text style={{ color: themeColors.textSecondary }}>Loading...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Trip</Text>
  <Text style={styles.label}>Trip Title</Text>
  <TextInput style={styles.input} placeholder="Trip title" value={title} onChangeText={setTitle} />
  <Text style={styles.label}>Ship (optional)</Text>
  <TextInput style={styles.input} placeholder="Ship (optional)" value={ship} onChangeText={setShip} />
  <Text style={styles.label}>Start Date</Text>
      <>
        <Pressable onPress={() => setShowStartPicker(true)} style={styles.input}>
          <Text style={{ color: startDate ? themeColors.text : themeColors.textSecondary }}>{startDate ? formatDate(startDate) : 'Start date (YYYY-MM-DD)'}</Text>
        </Pressable>
        {showStartPicker && (
          <DateTimePicker
            value={startDate ? new Date(startDate) : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(event, date) => {
              setShowStartPicker(Platform.OS === 'ios');
              if (date) setStartDate(date.toISOString().slice(0, 10));
            }}
          />
        )}
      </>
  <Text style={styles.label}>End Date</Text>
      <>
        <Pressable onPress={() => setShowEndPicker(true)} style={styles.input}>
          <Text style={{ color: endDate ? themeColors.text : themeColors.textSecondary }}>{endDate ? formatDate(endDate) : 'End date (YYYY-MM-DD)'}</Text>
        </Pressable>
        {showEndPicker && (
          <DateTimePicker
            value={endDate ? new Date(endDate) : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(event, date) => {
              setShowEndPicker(Platform.OS === 'ios');
              if (date) setEndDate(date.toISOString().slice(0, 10));
            }}
          />
        )}
      </>
      <Pressable onPress={onSave} style={[styles.btn, !title.trim() && { opacity: 0.6 }]} disabled={!title.trim()}>
        <Text style={styles.btnText}>Save Changes</Text>
      </Pressable>
      <Pressable onPress={onDelete} style={styles.delBtn} accessibilityLabel="Delete Trip">
        <Text style={styles.delBtnText}>Delete Trip</Text>
      </Pressable>

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowDeleteModal(false); setConfirmText(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Trip?</Text>
            <Text style={styles.modalMessage}>This cannot be undone. Type the trip title below to confirm:</Text>
            <Text style={[styles.modalMessage, { fontWeight: '700', color: themeColors.text }]}>
              {trip?.title}
            </Text>
            <TextInput
              autoFocus
              style={styles.modalInput}
              placeholder={`Type "${trip?.title}"`}
              placeholderTextColor={themeColors.textSecondary}
              value={confirmText}
              onChangeText={setConfirmText}
              accessibilityLabel="Confirmation input"
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => { setShowDeleteModal(false); setConfirmText(''); }} style={styles.modalBtnCancel} accessibilityRole="button">
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={performDelete}
                style={[styles.modalBtnDelete, (confirmText.trim() !== (trip?.title ?? '').trim()) && { opacity: 0.5 }]}
                accessibilityRole="button"
                disabled={confirmText.trim() !== (trip?.title ?? '').trim()}
              >
                <Text style={styles.modalBtnDeleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// styles created via useMemo above
