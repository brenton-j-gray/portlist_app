import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../components/AuthContext';
import { useTheme } from '../../components/ThemeContext';
import { pushTrips, syncTripsBackground } from '../../lib/sync';

export default function SettingsScreen() {
  const { themePreference, setThemePreference, themeColors } = useTheme();
  const { token, logout } = useAuth();
  const [autoBackup, setAutoBackup] = useState<boolean>(false);
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: themeColors.background },
    section: {
      backgroundColor: themeColors.card,
      borderWidth: 1,
      borderColor: themeColors.menuBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 14,
    },
    sectionTitle: { fontSize: 14, color: themeColors.textSecondary, marginBottom: 8, fontWeight: '600', letterSpacing: 0.3 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
    rowLabel: { fontSize: 16, color: themeColors.text },
    valueText: { fontSize: 16, color: themeColors.textSecondary },
    separator: { height: 1, backgroundColor: themeColors.menuBorder },
    chips: { flexDirection: 'row', gap: 8, marginTop: 6 },
    chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.menuBorder },
    chipActive: { backgroundColor: themeColors.primary + '22', borderColor: themeColors.primary },
    chipText: { fontSize: 14, color: themeColors.text, fontWeight: '600' },
    primaryBtn: { backgroundColor: themeColors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
    primaryText: { color: 'white', fontWeight: '700' },
    ghostBtn: { backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.menuBorder, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
    ghostText: { color: themeColors.text, fontWeight: '700' },
    dangerBtn: { backgroundColor: themeColors.danger, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
    dangerText: { color: 'white', fontWeight: '700' },
  }), [themeColors]);

  // hydrate backup settings
  useEffect(() => {
    (async () => {
      try {
        const a = await AsyncStorage.getItem('cjp_auto_backup');
        if (a != null) setAutoBackup(a === '1');
        const t = await AsyncStorage.getItem('cjp_last_backup_at');
        if (t) setLastBackupAt(Number(t));
      } catch {}
    })();
  }, []);

  // persist auto backup preference
  useEffect(() => {
    (async () => {
      try { await AsyncStorage.setItem('cjp_auto_backup', autoBackup ? '1' : '0'); } catch {}
    })();
  }, [autoBackup]);

  async function onBackupNow() {
    setBackupBusy(true);
    try {
      if (!token) throw new Error('Sign in to back up');
      // Try a background sync; if pull succeeds it won’t harm, then push local
      await syncTripsBackground();
      const ok = await pushTrips();
      if (ok) {
        const ts = Date.now();
        setLastBackupAt(ts);
        try { await AsyncStorage.setItem('cjp_last_backup_at', String(ts)); } catch {}
      }
    } finally {
      setBackupBusy(false);
    }
  }

  // removed: local storage inspection UI

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      {/* Appearance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View>
          <Text style={styles.rowLabel}>Theme</Text>
          <View style={styles.chips}>
            <TouchableOpacity style={[styles.chip, themePreference === 'system' && styles.chipActive]} onPress={() => setThemePreference('system')}>
              <Text style={styles.chipText}>System</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip, themePreference === 'light' && styles.chipActive]} onPress={() => setThemePreference('light')}>
              <Text style={styles.chipText}>Light</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip, themePreference === 'dark' && styles.chipActive]} onPress={() => setThemePreference('dark')}>
              <Text style={styles.chipText}>Dark</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Backup */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backup</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Status</Text>
          <Text style={styles.valueText}>{token ? 'On (signed in)' : 'Local only'}</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Auto Backup</Text>
          <Switch
            value={autoBackup}
            onValueChange={setAutoBackup}
            thumbColor={autoBackup ? themeColors.primary : themeColors.menuBorder}
            trackColor={{ false: themeColors.menuBorder, true: themeColors.primary + '66' }}
          />
        </View>
        <View style={styles.separator} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Last Backup</Text>
          <Text style={styles.valueText}>{lastBackupAt ? new Date(lastBackupAt).toLocaleString() : 'Never'}</Text>
        </View>
        <TouchableOpacity onPress={onBackupNow} disabled={!token || backupBusy} style={[styles.primaryBtn, { opacity: !token ? 0.6 : 1 }]}>
          {backupBusy ? (
            <ActivityIndicator color={'white'} />
          ) : (
            <Text style={styles.primaryText}>Backup Now</Text>
          )}
        </TouchableOpacity>
        {!token && (
          <>
            <View style={{ height: 8 }} />
            <TouchableOpacity onPress={() => router.push('/(auth)/login' as any)} style={styles.primaryBtn}>
              <Text style={styles.primaryText}>Sign in</Text>
            </TouchableOpacity>
            <View style={{ height: 8 }} />
            <TouchableOpacity onPress={() => router.push('/(auth)/register' as any)} style={[styles.primaryBtn, { backgroundColor: themeColors.primary + 'dd' }]}>
              <Text style={styles.primaryText}>Create account</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Account */}
      {token && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile' as any)} style={styles.ghostBtn}>
            <Text style={styles.ghostText}>Profile</Text>
          </TouchableOpacity>
          <View style={{ height: 8 }} />
          <TouchableOpacity onPress={logout} style={styles.dangerBtn}>
            <Text style={styles.dangerText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
// styles memoized above
