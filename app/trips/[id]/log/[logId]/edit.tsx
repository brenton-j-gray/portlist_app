import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../../../../components/ThemeContext';
import { persistPhotoUris, saveCameraPhotoToLibrary } from '../../../../../lib/media';
import { getTripById, upsertTrip } from '../../../../../lib/storage';
import { DayLog, Trip } from '../../../../../types';

export default function EditDayLogScreen() {
  const { themeColors } = useTheme();
  const { id, logId } = useLocalSearchParams<{ id: string; logId: string }>();
  const [trip, setTrip] = useState<Trip | undefined>();
  const [log, setLog] = useState<DayLog | undefined>();
  const [date, setDate] = useState<string>('');
  const [weather, setWeather] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [photos, setPhotos] = useState<{ uri: string; caption?: string }[]>([]);

  useEffect(() => {
    (async () => {
      if (!id || !logId) return;
      const t = await getTripById(id);
      if (!t) return;
      setTrip(t);
      const found = t.days.find(d => d.id === logId);
      if (found) {
        setLog(found);
        setDate(found.date || '');
        setWeather(found.weather || '');
        setNotes(found.notes || '');
        if (found.photos?.length) setPhotos(found.photos);
        else if (found.photoUri) setPhotos([{ uri: found.photoUri }]);
      }
      // Request permissions for media and camera
      await ImagePicker.requestMediaLibraryPermissionsAsync();
      await ImagePicker.requestCameraPermissionsAsync();
    })();
  }, [id, logId]);

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.8,
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

  function removePhotoAt(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }

  async function onSave() {
    if (!trip || !log) return;
    const persisted = await persistPhotoUris(photos);
    const updatedLog: DayLog = {
      ...log,
      date: date || log.date,
      weather: weather || undefined,
      notes: notes || undefined,
      photos: persisted,
      photoUri: undefined,
    };
    const nextDays = trip.days.map(d => (d.id === log.id ? updatedLog : d));
    const updatedTrip: Trip = { ...trip, days: nextDays };
    await upsertTrip(updatedTrip);
    router.replace(`/trips/${trip.id}`);
  }

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: themeColors.background },
    title: { fontSize: 22, fontWeight: '600', marginBottom: 12, color: themeColors.text },
    input: { borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, padding: 10, marginBottom: 10 },
  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  btn: { backgroundColor: themeColors.primary, padding: 12, borderRadius: 10, alignItems: 'center', flex: 1 },
    btnText: { color: themeColors.badgeText, fontWeight: '700' },
    photoList: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 12 },
    photoWrap: { position: 'relative' },
    photoThumb: { width: 96, height: 96, borderRadius: 8, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.menuBorder },
    removeBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: themeColors.danger, borderRadius: 999, padding: 4 },
    saveBtn: { backgroundColor: themeColors.primary, padding: 12, borderRadius: 10, alignItems: 'center' },
  }), [themeColors]);

  if (!trip || !log) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: themeColors.background }}><Text style={{ color: themeColors.textSecondary }}>Loading log...</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <Text style={styles.title}>Edit Day Log</Text>
      <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <TextInput style={styles.input} placeholder="Weather (optional)" value={weather} onChangeText={setWeather} />
      <TextInput style={[styles.input, { height: 120 }]} multiline placeholder="Notes" value={notes} onChangeText={setNotes} />

      <View style={styles.btnRow}>
        <Pressable onPress={pickFromLibrary} style={styles.btn} accessibilityLabel="Add photos from library">
          <Text style={styles.btnText}>Add Photos</Text>
        </Pressable>
        <Pressable onPress={takePhoto} style={styles.btn} accessibilityLabel="Take a photo">
          <Text style={styles.btnText}>Take Photo</Text>
        </Pressable>
      </View>

      {!!photos.length && (
        <View style={styles.photoList}>
          {photos.map((p, idx) => (
            <View style={styles.photoWrap} key={`${p.uri}-${idx}`}>
              <Image source={{ uri: p.uri }} style={styles.photoThumb} />
              <Pressable onPress={() => removePhotoAt(idx)} style={styles.removeBtn} accessibilityLabel="Remove photo">
                <Ionicons name="close" size={16} color={themeColors.badgeText} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Pressable onPress={onSave} style={styles.saveBtn}>
        <Text style={styles.btnText}>Save Changes</Text>
      </Pressable>
    </ScrollView>
  );
}
