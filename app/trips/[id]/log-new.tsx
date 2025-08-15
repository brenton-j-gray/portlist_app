import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../../components/ThemeContext';
import { persistPhotoUris, saveCameraPhotoToLibrary } from '../../../lib/media';
import { getTripById, uid, upsertTrip } from '../../../lib/storage';
import { DayLog, Trip } from '../../../types';

export default function NewDayLogScreen() {
  const { themeColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | undefined>();
  const [date, setDate] = useState<string>('');
  const [weather, setWeather] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [photos, setPhotos] = useState<{ uri: string; caption?: string }[]>([]);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const t = await getTripById(id);
      setTrip(t);
      // Request media library & camera permission
  await ImagePicker.requestMediaLibraryPermissionsAsync();
  await ImagePicker.requestCameraPermissionsAsync();
    })();
  }, [id]);

  async function onSave() {
    if (!trip) return;
    const persisted = await persistPhotoUris(photos);
    const log: DayLog = { id: uid(), date: date || new Date().toISOString().slice(0,10), weather, notes, photos: persisted };
    const updated: Trip = { ...trip, days: [...trip.days, log] };
    await upsertTrip(updated);
    router.replace(`/trips/${trip.id}`);
  }

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 6,
    });
    if (!result.canceled) {
      const newPhotos = result.assets.map(a => ({ uri: a.uri }));
      setPhotos(prev => [...prev, ...newPhotos]);
    }
  }

  async function takePhoto() {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      const mapped = await Promise.all(
        result.assets.map(async a => ({ uri: await saveCameraPhotoToLibrary(a.uri) }))
      );
      setPhotos(prev => [...prev, ...mapped]);
    }
  }

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: themeColors.background },
    title: { fontSize: 22, fontWeight: '600', marginBottom: 12, color: themeColors.text },
    input: { borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, padding: 10, marginBottom: 10 },
  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  btn: { backgroundColor: themeColors.primary, padding: 12, borderRadius: 10, alignItems: 'center', flex: 1 },
    btnText: { color: themeColors.badgeText, fontWeight: '700' },
    photoList: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 12 },
    photoThumb: { width: 96, height: 96, borderRadius: 8, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.menuBorder },
    saveBtn: { backgroundColor: themeColors.primary, padding: 12, borderRadius: 10, alignItems: 'center' },
  }), [themeColors]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <Text style={styles.title}>New Day Log</Text>
      <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <TextInput style={styles.input} placeholder="Weather (optional)" value={weather} onChangeText={setWeather} />
      <TextInput style={[styles.input, { height: 120 }]} multiline placeholder="Notes" value={notes} onChangeText={setNotes} />
      <View style={styles.btnRow}>
        <Pressable onPress={pickFromLibrary} style={styles.btn} accessibilityLabel="Pick photos from library">
          <Text style={styles.btnText}>Add Photos</Text>
        </Pressable>
        <Pressable onPress={takePhoto} style={styles.btn} accessibilityLabel="Take a photo">
          <Text style={styles.btnText}>Take Photo</Text>
        </Pressable>
      </View>
      {!!photos.length && (
        <View style={styles.photoList}>
          {photos.map((p, idx) => (
            <Image key={`${p.uri}-${idx}`} source={{ uri: p.uri }} style={styles.photoThumb} />
          ))}
        </View>
      )}
      <Pressable onPress={onSave} style={styles.saveBtn}>
        <Text style={styles.btnText}>Save Log</Text>
      </Pressable>
    </ScrollView>
  );
}
// styles via useMemo above
