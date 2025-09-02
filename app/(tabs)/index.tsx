import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../components/AuthContext';
import { useFeatureFlags } from '../../components/FeatureFlagsContext';
import { NoteCard, NoteCardSkeleton } from '../../components/NoteCard';
import { Pill } from '../../components/Pill';
import { formatDateWithPrefs, formatTemperature, usePreferences } from '../../components/PreferencesContext';
import { useTheme } from '../../components/ThemeContext';
import { shortLocationLabel } from '../../lib/location';
import { getTrips } from '../../lib/storage';
import { fetchCurrentWeather, keyToLabel, WeatherPill, type WeatherKey } from '../../lib/weather';
import type { Note, Trip } from '../../types';

/**
 * React component HomeScreen: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
export default function HomeScreen() {
  const { themeColors } = useTheme();
  const { flags } = useFeatureFlags();
  const { userName } = useAuth();
  const [highlights, setHighlights] = useState<{ tripId: string; log: Note; tripTitle: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [locLoading, setLocLoading] = useState(true);
  // kept only as structured fields now; no concatenated weatherText
  const [whereText, setWhereText] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [weatherKey, setWeatherKey] = useState<WeatherKey>('unknown');
  const [tempF, setTempF] = useState<number | undefined>(undefined);
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: themeColors.background },
    title: {
      fontSize: 30,
      marginBottom: 8,
      color: themeColors.accent,
      fontFamily: 'Pacifico' as any,
      letterSpacing: 0.2,
      textShadowColor: themeColors.card,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    body: { fontSize: 16, color: themeColors.textSecondary },
    sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8, color: themeColors.text },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.primary, marginTop: 8 },
  infoText: { fontSize: 14, color: themeColors.text },
  infoPrimary: { fontSize: 15, fontWeight: '700', color: themeColors.text, marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 13, fontWeight: '700' },
  card: { flexDirection: 'row', padding: 10, borderRadius: 10, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.primary, marginBottom: 10, alignItems: 'center' },
    thumb: { width: 56, height: 56, borderRadius: 6, backgroundColor: themeColors.menuBorder, marginRight: 10 },
  cardTextWrap: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: themeColors.text },
  cardSub: { fontSize: 12, color: themeColors.textSecondary },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, flexShrink: 1, minWidth: 0 },
  }), [themeColors]);

  // Format date as: Weekday, DD Month YEAR (e.g., Monday, 18 August 2025)
  const formatWeekdayDDMonthYYYY = /**
   * React component formatWeekdayDDMonthYYYY: TODO describe purpose and where it’s used.
   * @param {Date} d - TODO: describe
   * @returns {string} TODO: describe
   */
  (d: Date) => {
    const weekday = d.toLocaleString(undefined, { weekday: 'long' });
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString(undefined, { month: 'long' });
    const year = String(d.getFullYear());
    return `${weekday}, ${day} ${month} ${year}`;
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const trips: Trip[] = await getTrips();
  const items: { tripId: string; log: Note; tripTitle: string }[] = [];
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
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Get today's date, local weather, and shorthand location (best-effort)
  useEffect(() => {
    (async () => {
      try {
        setLocLoading(true);
        if (!flags.weather) {
          // Weather disabled: still show date; skip location/permissions
          const now = new Date();
          setDateStr(formatWeekdayDDMonthYYYY(now));
          setLocLoading(false);
          return;
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setLocLoading(false); return; }
        const loc = await Location.getCurrentPositionAsync({});
        const w = await fetchCurrentWeather(loc.coords.latitude, loc.coords.longitude);
        setWeatherKey(w.key);
        setTempF(typeof w.tempF === 'number' ? Math.round(w.tempF) : undefined);
  const now = new Date();
  setDateStr(formatWeekdayDDMonthYYYY(now));
        // Resolve short location label
        try {
          const results = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          if (results && results.length) {
            const r = results[0] as any;
            const label = shortLocationLabel(r, loc.coords.latitude, loc.coords.longitude) || '';
            setWhereText(label);
          } else {
            setWhereText(`${loc.coords.latitude.toFixed(2)}, ${loc.coords.longitude.toFixed(2)}`);
          }
        } catch {
          setWhereText(`${loc.coords.latitude.toFixed(2)}, ${loc.coords.longitude.toFixed(2)}`);
        }
  // No-op: we show structured fields below
      } catch {
  const d = new Date();
  const ds = formatWeekdayDDMonthYYYY(d);
        setDateStr(ds);
      } finally {
        setLocLoading(false);
      }
    })();
  }, [flags.weather]);

  const { prefs } = usePreferences();
  const hour = new Date().getHours();
  const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const displayName = (userName || '').trim();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <Text style={styles.title}>
        {displayName ? `Good ${period}, ${displayName}!` : `Good ${period}!`}
      </Text>
      {locLoading ? (
        <View style={styles.infoCard}>
          <ActivityIndicator color={themeColors.primary} />
          <Text style={styles.infoText}>Fetching today’s date and local weather…</Text>
        </View>
      ) : (
        <View style={styles.infoCard}>
          <Ionicons
            name="calendar-outline"
            size={20}
            color={themeColors.primaryDark}
            accessibilityLabel="Today"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoPrimary}>{dateStr || formatDateWithPrefs(new Date().toISOString(), prefs, { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' })}</Text>
            <View style={styles.infoRow}>
              {flags.weather && ((weatherKey && weatherKey !== 'unknown') || tempF != null) ? (
                <WeatherPill weather={weatherKey} size="md" label={keyToLabel(weatherKey)} trailing={typeof tempF === 'number' ? `• ${formatTemperature(((tempF - 32) * 5)/9, prefs, { withUnit: true, decimals: 0 })}` : undefined} />
              ) : null}
              {flags.weather && !!whereText && (
                <Pill variant="success" iconName="location-outline">
                  {whereText}
                </Pill>
              )}
            </View>
          </View>
        </View>
      )}
      <Text style={styles.sectionTitle}>Recent highlights</Text>
      {loading ? (
        <>
          <NoteCardSkeleton thumbSize={56} lines={1} />
          <NoteCardSkeleton thumbSize={56} lines={2} />
          <NoteCardSkeleton thumbSize={56} lines={1} />
        </>
      ) : highlights.length === 0 ? (
  <Text style={styles.body}>No notes yet. Create one from the Trips tab.</Text>
      ) : (
        highlights.map((h, idx) => (
          <NoteCard
            key={`${h.tripId}_${h.log.id}_${idx}`}
            note={h.log}
            thumbSize={56}
            onPress={() => router.push({ pathname: '/(tabs)/trips/[id]/note/[noteId]' as any, params: { id: h.tripId, noteId: h.log.id } } as any)}
            subtitleElement={
              <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }} numberOfLines={1} ellipsizeMode="tail">
                {formatDateWithPrefs(h.log.date, prefs, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} • {h.tripTitle}
              </Text>
            }
            style={{ marginTop: 12 }}
          />
        ))
      )}
    </ScrollView>
  );
}
