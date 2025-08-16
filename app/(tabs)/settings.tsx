import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../components/AuthContext';
import { useTheme } from '../../components/ThemeContext';

export default function SettingsScreen() {
  const { themePreference, setThemePreference, themeColors } = useTheme();
  const { token, logout } = useAuth();
  const [showDataModal, setShowDataModal] = useState(false);
  const [dataInfo, setDataInfo] = useState<{ dir?: string; files?: { name: string; size?: number }[]; tripsPath?: string; tripsCount?: number; note?: string }>({});
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: themeColors.background },
    title: { fontSize: 30, fontWeight: '600', marginBottom: 10, color: themeColors.text },
    body: { fontSize: 16, color: themeColors.textSecondary, textAlign: 'center', marginBottom: 16 },
    themeRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
    themeBtn: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: themeColors.card,
      borderWidth: 1,
      borderColor: themeColors.menuBorder,
      marginRight: 2,
    },
    themeBtnActive: {
      backgroundColor: themeColors.primary + '22',
      borderColor: themeColors.primary,
    },
    themeBtnText: {
      fontSize: 15,
      color: themeColors.text,
      fontWeight: '600',
    },
  divider: { height: 1, backgroundColor: themeColors.menuBorder, width: '80%', marginVertical: 16 },
  logoutBtn: { backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.menuBorder, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  logoutText: { color: themeColors.text, fontWeight: '700' },
  backupRow: { marginTop: 16, alignItems: 'center', gap: 10 },
  ctaBtn: { backgroundColor: themeColors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  ctaText: { color: 'white', fontWeight: '700' },
  }), [themeColors]);

  async function onViewLocalData() {
    try {
      const base = (FileSystem.documentDirectory ?? FileSystem.cacheDirectory) ?? undefined;
      if (!base) {
        setDataInfo({ note: 'FileSystem unavailable on this platform. Data may be stored in AsyncStorage.' });
        setShowDataModal(true);
        return;
      }
      const dir = `${base}kv/`;
      const dirInfo = await FileSystem.getInfoAsync(dir);
      let files: { name: string; size?: number }[] = [];
      let tripsPath: string | undefined;
      let tripsCount: number | undefined;
      if (dirInfo.exists && dirInfo.isDirectory) {
        const names = await FileSystem.readDirectoryAsync(dir);
        // gather file sizes
        files = await Promise.all(names.map(async (name) => {
          try {
            const info = await FileSystem.getInfoAsync(dir + name);
            return { name, size: (info as any).size as number | undefined };
          } catch {
            return { name };
          }
        }));
        // try to read trips.json
        if (names.includes('trips.json')) {
          tripsPath = dir + 'trips.json';
          try {
            const content = await FileSystem.readAsStringAsync(tripsPath, { encoding: FileSystem.EncodingType.UTF8 });
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) tripsCount = parsed.length;
          } catch {
            // ignore parse errors
          }
        }
      } else {
        // Directory may not exist yet; data likely in AsyncStorage only
        files = [];
      }
      setDataInfo({ dir, files, tripsPath, tripsCount, note: !dirInfo.exists ? 'No kv directory yet — data may still be in AsyncStorage.' : undefined });
  } catch {
      setDataInfo({ note: 'Unable to read local data directory.' });
    } finally {
      setShowDataModal(true);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.body}>Theme</Text>
      <View style={styles.themeRow}>
        <TouchableOpacity
          style={[styles.themeBtn, themePreference === 'system' && styles.themeBtnActive]}
          onPress={() => setThemePreference('system')}
        >
          <Text style={styles.themeBtnText}>Follow System</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.themeBtn, themePreference === 'light' && styles.themeBtnActive]}
          onPress={() => setThemePreference('light')}
        >
          <Text style={styles.themeBtnText}>Light</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.themeBtn, themePreference === 'dark' && styles.themeBtnActive]}
          onPress={() => setThemePreference('dark')}
        >
          <Text style={styles.themeBtnText}>Dark</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.backupRow}>
        <Text style={styles.body}>Backup: {token ? 'On (signed in)' : 'Local only (offline/signed out)'}</Text>
        {!token && (
          <>
            <TouchableOpacity onPress={() => router.push('/(auth)/login' as any)} style={styles.ctaBtn}>
              <Text style={styles.ctaText}>Sign in</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(auth)/register' as any)} style={[styles.ctaBtn, { backgroundColor: themeColors.primary + 'dd' }]}>
              <Text style={styles.ctaText}>Create account</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={{ height: 1, backgroundColor: themeColors.menuBorder, width: '80%', marginVertical: 16 }} />
      <TouchableOpacity onPress={onViewLocalData} style={[styles.ctaBtn, { backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.menuBorder }]}>
        <Text style={[styles.ctaText, { color: themeColors.text }]}>View local data folder</Text>
      </TouchableOpacity>

      {token && (
        <>
          <View style={{ height: 8 }} />
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile' as any)} style={[styles.ctaBtn, { backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.menuBorder }]}>
            <Text style={[styles.ctaText, { color: themeColors.text }]}>Profile</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </>
      )}

      <Modal visible={showDataModal} animationType="slide" transparent={true} onRequestClose={() => setShowDataModal(false)}>
        <View style={{ flex: 1, backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <View style={{ width: '100%', maxWidth: 520, backgroundColor: themeColors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: themeColors.menuBorder }}>
            <Text style={[styles.title, { marginBottom: 6 }]}>Local data</Text>
            {!!dataInfo.note && <Text style={[styles.body, { marginBottom: 8 }]}>{dataInfo.note}</Text>}
      {dataInfo.dir && (
              <>
                <Text style={[styles.body, { textAlign: 'left' }]}>Directory:</Text>
        <Text selectable style={[styles.body]}>{dataInfo.dir}</Text>
              </>
            )}
            <View style={{ height: 8 }} />
            <Text style={[styles.body, { textAlign: 'left' }]}>Files:</Text>
            <View style={{ maxHeight: 220 }}>
              <ScrollView>
                {dataInfo.files && dataInfo.files.length > 0 ? (
                  dataInfo.files.map((f, idx) => (
                    <Text key={idx} style={[styles.body, { textAlign: 'left' }]}>• {f.name}{typeof f.size === 'number' ? `  (${Math.round(f.size / 1024)} KB)` : ''}</Text>
                  ))
                ) : (
                  <Text style={[styles.body, { textAlign: 'left' }]}>No files</Text>
                )}
              </ScrollView>
            </View>
            {dataInfo.tripsPath !== undefined && (
              <>
                <View style={{ height: 8 }} />
                <Text style={[styles.body, { textAlign: 'left' }]}>trips.json: {typeof dataInfo.tripsCount === 'number' ? `${dataInfo.tripsCount} trips` : 'unreadable'}</Text>
                <Text selectable style={[styles.body, { fontSize: 12, textAlign: 'left' }]}>{dataInfo.tripsPath}</Text>
              </>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 10 }}>
              <TouchableOpacity onPress={() => setShowDataModal(false)} style={[styles.ctaBtn, { backgroundColor: themeColors.primary }]}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
// styles memoized above
