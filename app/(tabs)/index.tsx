import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../components/AuthContext';
import { useTheme } from '../../components/ThemeContext';
import { getTrips } from '../../lib/storage';
import type { DayLog, Trip } from '../../types';

export default function HomeScreen() {
  const { themeColors } = useTheme();
  const { userName } = useAuth();
  const [highlights, setHighlights] = useState<{ tripId: string; log: DayLog; tripTitle: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: themeColors.background },
    title: {
      fontSize: 30,
      marginBottom: 8,
      color: themeColors.text,
      fontFamily: 'Pacifico' as any,
      letterSpacing: 0.2,
      textShadowColor: themeColors.card,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    body: { fontSize: 16, color: themeColors.textSecondary },
    sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8, color: themeColors.text },
    card: { flexDirection: 'row', padding: 10, borderRadius: 10, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.menuBorder, marginBottom: 10, alignItems: 'center' },
    thumb: { width: 56, height: 56, borderRadius: 6, backgroundColor: themeColors.menuBorder, marginRight: 10 },
    cardTextWrap: { flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: themeColors.text },
    cardSub: { fontSize: 12, color: themeColors.textSecondary },
  }), [themeColors]);

  useEffect(() => {
    (async () => {
      try {
        const trips: Trip[] = await getTrips();
  const items: { tripId: string; log: DayLog; tripTitle: string }[] = [];
        for (const t of trips) {
          for (const d of t.days) {
            items.push({ tripId: t.id, log: d, tripTitle: t.title });
          }
        }
        items.sort((a, b) => (b.log.date || '').localeCompare(a.log.date || ''));
        setHighlights(items.slice(0, 3));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hour = new Date().getHours();
  const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const displayName = (userName || '').trim();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <Text style={styles.title}>
        {displayName ? `Good ${period}, ${displayName}` : `Good ${period}!`}
      </Text>
      <Text style={styles.body}>Here are your recent highlights.</Text>
      <Text style={styles.sectionTitle}>Recent highlights</Text>
      {loading ? (
        <Text style={styles.body}>Loading…</Text>
      ) : highlights.length === 0 ? (
        <Text style={styles.body}>No logs yet. Create one from the Trips tab.</Text>
      ) : (
        highlights.map((h, idx) => (
          <View key={`${h.tripId}_${h.log.id}_${idx}`} style={styles.card}>
            {h.log.photos && h.log.photos.length > 0 ? (
              <Image source={{ uri: h.log.photos[0].uri }} style={styles.thumb} />
            ) : (
              <View style={styles.thumb} />
            )}
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle}>{h.log.title || h.log.locationName || 'Log entry'}</Text>
              <Text style={styles.cardSub}>{new Date(h.log.date).toLocaleDateString()} • {h.tripTitle}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
