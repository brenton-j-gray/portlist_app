import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../../../components/ThemeContext';
import { getTripById } from '../../../../../lib/storage';
import { DayLog, Trip } from '../../../../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ViewLogScreen() {
  const { id, logId } = useLocalSearchParams<{ id: string; logId: string }>();
  const { themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const [trip, setTrip] = useState<Trip | undefined>();
  const [log, setLog] = useState<DayLog | undefined>();

  useEffect(() => {
    (async () => {
      if (!id) return;
      const t = await getTripById(String(id));
      setTrip(t);
      const d = t?.days?.find((x) => x.id === logId);
      setLog(d);
    })();
  }, [id, logId]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    content: { padding: 16, paddingBottom: Math.max(24, (insets?.bottom || 0) + 24) },
    title: { fontSize: 24, fontWeight: '800', color: themeColors.text, marginBottom: 6 },
    date: { fontSize: 16, fontWeight: '700', color: themeColors.textSecondary, marginBottom: 12 },
    mediaWrap: { marginBottom: 16 },
    mediaImage: { width: SCREEN_WIDTH - 32, height: 240, borderRadius: 14 },
    pagerDots: { flexDirection: 'row', alignSelf: 'center', marginTop: 8, gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: themeColors.menuBorder },
    dotActive: { backgroundColor: themeColors.primary },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    infoText: { marginLeft: 8, color: themeColors.text, fontSize: 16 },
    section: { backgroundColor: themeColors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: themeColors.menuBorder, marginTop: 12 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: themeColors.textSecondary, marginBottom: 6 },
    sectionText: { fontSize: 16, color: themeColors.text, lineHeight: 22 },
    primaryBtn: { marginTop: 16, backgroundColor: themeColors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    primaryText: { color: themeColors.addBtnText, fontWeight: '800' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    emptyText: { color: themeColors.textSecondary },
  }), [themeColors, insets?.bottom]);
  const [page, setPage] = useState(0);

  if (!log || !trip) {
    return (
      <View style={[styles.container, styles.empty]}>
        <Text style={styles.emptyText}>Log not found.</Text>
      </View>
    );
  }

  const photos = log.photos && log.photos.length > 0
    ? log.photos
    : (log.photoUri ? [{ uri: log.photoUri }] : []);

  return (
    <View style={styles.container}>
  <Stack.Screen options={{ title: 'View Log' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {!!photos.length && (
          <View style={styles.mediaWrap}>
            <FlatList
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              data={photos}
              keyExtractor={(_, i) => String(i)}
              onMomentumScrollEnd={(ev) => {
                const idx = Math.round((ev.nativeEvent.contentOffset.x || 0) / (SCREEN_WIDTH - 32));
                setPage(idx);
              }}
              renderItem={({ item }) => (
                <View style={{ width: SCREEN_WIDTH - 32, marginRight: 8 }}>
                  <Image source={{ uri: item.uri }} style={styles.mediaImage} resizeMode="cover" />
                  {!!item.caption && <Text style={{ color: themeColors.textSecondary, marginTop: 6 }}>{item.caption}</Text>}
                </View>
              )}
            />
            {photos.length > 1 && (
              <View style={styles.pagerDots}>
                {photos.map((_, i) => (
                  <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        )}

        {!!log.title && <Text style={styles.title}>{log.title}</Text>}
        <Text style={styles.date}>{log.date}</Text>

        {!!log.weather && (
          <View style={styles.infoRow}>
            <Ionicons name={(log.weather + '-outline') as any} size={18} color={themeColors.textSecondary} />
            <Text style={styles.infoText}>{log.weather}</Text>
          </View>
        )}

        {!!(log.locationName || log.location) && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={themeColors.textSecondary} />
            <Text style={styles.infoText}>{log.locationName ? log.locationName : 'Location added'}</Text>
          </View>
        )}

        {!!log.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.sectionText}>{log.description}</Text>
          </View>
        )}

        {!!log.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.sectionText}>{log.notes}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push({ pathname: '/(tabs)/trips/[id]/log/[logId]/edit' as any, params: { id: String(id), logId: String(logId) } } as any)}
          accessibilityLabel="Edit log"
        >
          <Text style={styles.primaryText}>Edit Log</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
