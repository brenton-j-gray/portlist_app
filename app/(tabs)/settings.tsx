import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../components/AuthContext';
import { useTheme } from '../../components/ThemeContext';
// forms moved to a dedicated Security screen
import { pushTrips, syncTripsBackground } from '../../lib/sync';

/**
 * React component SettingsScreen: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
export default function SettingsScreen() {
  const { themePreference, setThemePreference, themeColors, themePalette, setThemePalette, availablePalettes } = useTheme();
  const { token, logout } = useAuth();
  const [autoBackup, setAutoBackup] = useState<boolean>(false);
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: themeColors.background },
    section: {
      backgroundColor: themeColors.card,
      borderWidth: 1,
      borderColor: themeColors.primary,
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
  chipActive: { backgroundColor: themeColors.primary + '22', borderColor: themeColors.primary }, // generic active (other selectors)
  appearanceChipActive: { backgroundColor: themeColors.accent + '22', borderColor: themeColors.accent },
    chipText: { fontSize: 14, color: themeColors.text, fontWeight: '600' },
    primaryBtn: { backgroundColor: (themeColors as any).btnBg || themeColors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
    primaryText: { color: (themeColors as any).btnText || '#FFFFFF', fontWeight: '700' },
  ghostBtn: { backgroundColor: ((themeColors as any).btnBg || themeColors.primary) + '12', borderWidth: 1, borderColor: (themeColors as any).btnBg || themeColors.primary, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  ghostText: { color: (themeColors as any).btnBg || themeColors.primary, fontWeight: '700' },
    dangerBtn: { backgroundColor: themeColors.danger, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
    dangerText: { color: 'white', fontWeight: '700' },
  // input styles no longer needed here
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

  /**
     * React component onBackupNow: TODO describe purpose and where it’s used.
     * @returns {Promise<void>} TODO: describe
     */
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
      {/* Support / Donate */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/donate' as any)} style={styles.primaryBtn}>
          <Text style={styles.primaryText}>Donate</Text>
        </TouchableOpacity>
      </View>

      {/* Appearance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View>
          <Text style={styles.rowLabel}>Theme</Text>
          <View style={styles.chips}>
            <TouchableOpacity style={[styles.chip, themePreference === 'system' && styles.appearanceChipActive]} onPress={() => setThemePreference('system')}>
              <Text style={styles.chipText}>System</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip, themePreference === 'light' && styles.appearanceChipActive]} onPress={() => setThemePreference('light')}>
              <Text style={styles.chipText}>Light</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip, themePreference === 'dark' && styles.appearanceChipActive]} onPress={() => setThemePreference('dark')}>
              <Text style={styles.chipText}>Dark</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ marginTop: 16 }}>
          <Text style={styles.rowLabel}>Color Palette</Text>
          <View style={[styles.chips, { flexWrap: 'wrap' }]}>
            {availablePalettes.map(p => (
              <TouchableOpacity
                key={p.key}
                style={[styles.chip, themePalette === p.key && styles.chipActive]}
                onPress={() => setThemePalette(p.key)}
              >
                <Text style={styles.chipText}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

  {/* Features card removed per request */}

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
      <ActivityIndicator color={(themeColors as any).btnText || '#FFFFFF'} />
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
            <TouchableOpacity onPress={() => router.push('/(auth)/register' as any)} style={styles.primaryBtn}>
              <Text style={styles.primaryText}>Create account</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Account */}
      {token && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile' as any)} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>Profile</Text>
          </TouchableOpacity>
          <View style={{ height: 8 }} />
          <TouchableOpacity onPress={() => router.push('/(tabs)/security' as any)} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>Security</Text>
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
