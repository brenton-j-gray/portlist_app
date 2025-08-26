import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../components/ThemeContext';
import { useToast } from '../../components/ToastContext';
import { clearPortsCache, PortEntry, removeCachedPortByName, sanitizePortQuery } from '../../lib/ports';
import { PortsCache } from '../../lib/portsCache';

export default function DebugPortsScreen() {
  const isDev = !!(global as any).__DEV__;
  const { themeColors } = useTheme();
  const toast = useToast();
  const [items, setItems] = useState<PortEntry[]>([]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background, padding: 12 },
    row: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, marginBottom: 8 },
    title: { fontWeight: '700', color: themeColors.text },
    meta: { color: themeColors.textSecondary, fontSize: 12, marginTop: 6 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
    btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: themeColors.menuBorder },
    btnText: { color: themeColors.primary, fontWeight: '700' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }
  });

  const load = useCallback(async () => {
    try {
  const c = await PortsCache.load();
      setItems(c || []);
    } catch (e) { setItems([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRemove = useCallback((name: string) => {
    Alert.alert('Remove cached port', `Remove cached entry for "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          const ok = await removeCachedPortByName(name);
          if (ok) {
            toast.show(`Removed ${name}`, { kind: 'success' });
            await load();
          } else {
            toast.show(`No cached entry found for ${name}`, { kind: 'info' });
          }
        } catch (e) { toast.show('Error removing entry', { kind: 'error' }); }
      } }
    ]);
  }, [load, toast]);

  const onClear = useCallback(() => {
    Alert.alert('Clear ports cache', 'Clear all cached online ports? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        try {
          await clearPortsCache();
          await load();
          toast.show('Cleared ports cache', { kind: 'success' });
        } catch (e) { toast.show('Failed to clear cache', { kind: 'error' }); }
      } }
    ]);
  }, [load, toast]);

  if (!isDev) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>Not available</Text></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={{ color: themeColors.text, fontWeight: '700' }}>Cached Ports</Text>
        <View style={{ flexDirection: 'row' }}>
          <Pressable onPress={load} style={[styles.btn, { marginRight: 8 }]}><Text style={styles.btnText}>Reload</Text></Pressable>
          <Pressable onPress={onClear} style={styles.btn}><Text style={[styles.btnText, { color: themeColors.danger }]}>Clear All</Text></Pressable>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => `${i.name}_${i.lat}_${i.lng}`}
    renderItem={({ item }) => (
          <View style={styles.row}>
      <Text style={styles.title}>{item.name}</Text>
      <Text style={styles.meta}>sanitized: {sanitizePortQuery(item.name)}</Text>
      <Text style={styles.meta}>{item.regionCode ? `${item.regionCode}` : ''}{item.regionCode && item.country ? ', ' : ''}{item.country ? `${item.country}` : ''}</Text>
      <Text style={styles.meta}>{item.lat.toFixed(6)}, {item.lng.toFixed(6)} — {item.source || 'unknown'}</Text>
      {item.originalQuery ? <Text style={styles.meta}>originalQuery: {item.originalQuery}</Text> : null}
      {item.savedAt ? <Text style={styles.meta}>savedAt: {new Date(item.savedAt).toLocaleString()}</Text> : null}
      {item.lastAccessed ? <Text style={styles.meta}>lastAccessed: {new Date(item.lastAccessed).toLocaleString()}</Text> : null}
            <View style={styles.actions}>
              <Pressable onPress={() => onRemove(item.name)} style={styles.btn}><Text style={styles.btnText}>Remove</Text></Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={() => <Text style={{ color: themeColors.textSecondary }}>No cached ports</Text>}
      />
    </View>
  );
}
