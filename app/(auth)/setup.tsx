import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../components/ThemeContext';
import { apiSaveProfile } from '../../lib/api';

/**
 * React component SetupScreen: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
export default function SetupScreen() {
  const { themeColors } = useTheme();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 460, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.primary, borderRadius: 12, padding: 16 },
    title: { color: themeColors.text, fontSize: 22, fontWeight: '800', marginBottom: 12 },
    input: { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.menuBorder, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
    btn: { backgroundColor: themeColors.primary, padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
    btnText: { color: 'white', fontWeight: '700' },
  secondaryBtn: { padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: themeColors.primary, backgroundColor: themeColors.primary + '12' },
  secondaryText: { color: themeColors.primaryDark, fontWeight: '700' },
  }), [themeColors]);

  /**
     * React component onSave: TODO describe purpose and where it’s used.
     * @returns {Promise<void>} TODO: describe
     */
    async function onSave() {
    try {
      setBusy(true);
      await apiSaveProfile({ fullName: fullName.trim() || undefined, username: username.trim() || undefined, bio: bio.trim() || undefined });
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Setup failed', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Set up your profile</Text>
  <TextInput placeholder="Full name (optional)" placeholderTextColor={themeColors.textSecondary} style={styles.input} value={fullName} onChangeText={setFullName} />
  <TextInput autoCapitalize="none" placeholder="Public username (optional)" placeholderTextColor={themeColors.textSecondary} style={styles.input} value={username} onChangeText={setUsername} />
  <TextInput placeholder="Bio (optional)" placeholderTextColor={themeColors.textSecondary} style={[styles.input, { height: 100 }]} multiline value={bio} onChangeText={setBio} />
        <Pressable onPress={onSave} style={styles.btn} disabled={busy}>
          <Text style={styles.btnText}>{busy ? 'Saving…' : 'Save & Continue'}</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(tabs)')} style={styles.secondaryBtn} disabled={busy}>
          <Text style={styles.secondaryText}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}
