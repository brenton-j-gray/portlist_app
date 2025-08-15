// Format date as DAY DD MMM YYYY, parsing YYYY-MM-DD as local date to avoid timezone shift
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../components/ThemeContext';
import { getTrips } from '../../lib/storage';
import { Trip } from '../../types';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
function parseLocalYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
function getDaysLabel(item: Trip): { text: string; kind: 'future' | 'past' | 'today' | 'current' } | undefined {
  const today = startOfToday().getTime();
  const hasStart = !!item.startDate;
  const hasEnd = !!item.endDate;
  const startTs = hasStart ? parseLocalYmd(item.startDate as string).getTime() : undefined;
  const endTs = hasEnd ? parseLocalYmd(item.endDate as string).getTime() : undefined;

  // Future: count down to start date
  if (typeof startTs === 'number' && today < startTs) {
    const diff = Math.ceil((startTs - today) / MS_PER_DAY);
    return { text: `${diff} day${diff === 1 ? '' : 's'} until start`, kind: 'future' };
  }

  // Current (in progress): between start and end (inclusive)
  if (typeof startTs === 'number' && typeof endTs === 'number' && today >= startTs && today <= endTs) {
    return { text: 'In progress', kind: 'current' };
  }

  // Past: prefer days since end if end date exists, else days since start if only start exists
  if (typeof endTs === 'number' && today > endTs) {
    const diff = Math.floor((today - endTs) / MS_PER_DAY);
    const days = Math.max(0, diff);
    return { text: `${days} day${days === 1 ? '' : 's'} since end`, kind: 'past' };
  }
  if (typeof startTs === 'number' && !hasEnd && today > startTs) {
    const diff = Math.floor((today - startTs) / MS_PER_DAY);
    const days = Math.max(0, diff);
    return { text: `${days} day${days === 1 ? '' : 's'} since start`, kind: 'past' };
  }

  // Today edge-cases
  if (typeof startTs === 'number' && today === startTs) {
    return { text: 'Starts today', kind: 'today' };
  }

  // Fallback: days since created if no dates present
  if (!hasStart && !hasEnd && typeof item.createdAt === 'number') {
    const createdDay = new Date(item.createdAt);
    const createdMid = new Date(createdDay.getFullYear(), createdDay.getMonth(), createdDay.getDate()).getTime();
    const diff = Math.floor((today - createdMid) / MS_PER_DAY);
    const days = Math.max(0, diff);
    return { text: `${days} day${days === 1 ? '' : 's'} since created`, kind: days === 0 ? 'today' : 'past' };
  }

  return undefined;
}
function formatDate(dateStr: string) {
  if (!dateStr) return '';
  let d;
  // Parse YYYY-MM-DD as local date
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(dateStr);
  if (match) {
    const [year, month, day] = dateStr.split('-').map(Number);
    d = new Date(year, month - 1, day);
  } else {
    d = new Date(dateStr);
  }
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const CARD_SHADOW: any = {
  borderRadius: 18,
  marginVertical: 8,
  marginHorizontal: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 8,
  elevation: 4,
  overflow: 'hidden',
  position: 'relative',
};

export default function TripsScreen() {
  const { themeColors } = useTheme();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [sortBy, setSortBy] = useState<'created' | 'title' | 'startDate'>('created');

  const refresh = useCallback(async () => {
    const all = await getTrips();
    setTrips(all);
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Long-press delete removed: no contextual menu or delete from list.

  // Sort trips based on sortBy
  const sortedTrips = [...trips].sort((a, b) => {
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    } else if (sortBy === 'startDate') {
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    } else {
      // Default: created
      return b.createdAt - a.createdAt;
    }
  });

  const styles = useMemo(() => StyleSheet.create({
    sortRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 8,
    },
    sortLabel: {
      fontSize: 15,
      color: themeColors.textSecondary,
      marginRight: 6,
      fontWeight: '500',
    },
    sortBtn: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 6,
      backgroundColor: themeColors.card,
      borderWidth: 1,
      borderColor: themeColors.primary + '22',
      marginRight: 2,
    },
    sortBtnActive: {
      backgroundColor: themeColors.primary + '18',
      borderColor: themeColors.primary,
    },
    
    sortBtnText: {
      fontSize: 14,
      color: themeColors.primaryDark,
      fontWeight: '600',
    },
    cardActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginTop: 16,
      gap: 16,
      paddingBottom: 2,
    },
    actionBtn: {
      marginRight: 0,
      backgroundColor: themeColors.actionBtnBg,
      padding: 0,
      borderWidth: 1,
      borderColor: themeColors.primaryDark + '29',
      borderRadius: 8,
      minWidth: 50,
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 0,
      flexDirection: 'column',
    },
    actionLabel: {
      fontSize: 12,
      color: themeColors.textSecondary,
      marginTop: 2,
      fontWeight: '500',
      textAlign: 'center',
      letterSpacing: 0.1,
    },
  container: { flex: 1, padding: 16, backgroundColor: themeColors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '600', color: themeColors.text },
    addBtn: { backgroundColor: themeColors.addBtnBg, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
    addText: { color: themeColors.addBtnText, fontWeight: '600' },
    listContent: { paddingBottom: 30 },
  card: {
      marginBottom: 24,
      borderRadius: 18,
      backgroundColor: themeColors.card,
      overflow: 'hidden',
      position: 'relative',
      minHeight: 90,
    } as any,
    cardAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
  width: 7,
  backgroundColor: 'transparent', // gradient overlays this
      opacity: 0.85,
      zIndex: 1,
    } as any,
    cardContent: {
      padding: 20,
      paddingLeft: 24,
      zIndex: 2,
    },
  cardPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.98 }],
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    cardTitle: {
      fontSize: 22,
      fontWeight: '700',
      flex: 1,
      marginRight: 8,
      color: themeColors.text,
      letterSpacing: 0.1,
    },
    metaText: {
      fontSize: 14,
      color: themeColors.textSecondary,
      marginBottom: 2,
      fontWeight: '500',
      letterSpacing: 0.05,
    },
    countdownText: {
      fontSize: 13,
      marginTop: 2,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
  badge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      minWidth: 28,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    } as any,
    badgeText: {
      color: themeColors.badgeText,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
  }), [themeColors]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Trips</Text>
        <Link href="/trips/new" style={styles.addBtn}>
          <Text style={styles.addText}>+ New Trip</Text>
        </Link>
      </View>
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <TouchableOpacity
          style={[styles.sortBtn, sortBy === 'created' && styles.sortBtnActive]}
          onPress={() => setSortBy('created')}
        >
          <Text style={styles.sortBtnText}>Recent</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortBtn, sortBy === 'title' && styles.sortBtnActive]}
          onPress={() => setSortBy('title')}
        >
          <Text style={styles.sortBtnText}>A-Z</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortBtn, sortBy === 'startDate' && styles.sortBtnActive]}
          onPress={() => setSortBy('startDate')}
        >
          <Text style={styles.sortBtnText}>Start Date</Text>
        </TouchableOpacity>
      </View>

      {sortedTrips.length === 0 ? (
        <Text style={{ color: themeColors.textSecondary }}>No trips yet. Tap + New Trip to begin.</Text>
      ) : (
        <FlatList
          data={sortedTrips}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            return (
              <View style={{ position: 'relative' }}>
                <Pressable
                  style={({ pressed }) => [
                    styles.card,
                    CARD_SHADOW,
                    pressed && styles.cardPressed
                  ]}
                  onPress={() => router.push(`/trips/${item.id}`)}
                  accessibilityLabel={`Trip card for ${item.title}`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <LinearGradient
                      colors={[themeColors.primaryDark, themeColors.primary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.cardAccent}
                    />
                  <View style={styles.cardContent}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                      <LinearGradient
                        colors={['#6366f1', '#1e90ff']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.badge}
                      >
                        <Text style={styles.badgeText}>{item.days.length}</Text>
                      </LinearGradient>
                    </View>
                    <Text style={styles.metaText}>
                      {item.startDate ? formatDate(item.startDate) : 'Start ?'} → {item.endDate ? formatDate(item.endDate) : 'End ?'}
                    </Text>
                    {(() => {
                      const info = getDaysLabel(item);
                      if (!info) return null;
                      const accentKinds = new Set(['today', 'current']);
                      const color = info.kind === 'future'
                        ? themeColors.primary
                        : accentKinds.has(info.kind)
                        ? themeColors.accent
                        : themeColors.textSecondary;
                      const fontStyle = info.kind === 'current' ? 'italic' : 'normal';
                      return <Text style={[styles.countdownText, { color, fontStyle }]}>{info.text}</Text>;
                    })()}
                    {!!item.ship && <Text style={styles.metaText}>Ship: {item.ship}</Text>}
                    {!!item.ports?.length && <Text style={styles.metaText}>Ports: {item.ports.length}</Text>}
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => router.push(`/trips/${item.id}/log-new`)}
                        accessibilityLabel="Add Note"
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <Ionicons name="add-circle-outline" size={32} color={themeColors.primaryDark} />
                        <Text style={styles.actionLabel}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Pressable>
                
    </View>
  );
          }}
        />
      )}
    </View>
  );
}
