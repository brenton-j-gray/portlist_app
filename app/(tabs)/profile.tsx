import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../components/ThemeContext';
import { apiGetProfile, apiSaveProfile } from '../../lib/api';

export default function ProfileScreen() {
  const { themeColors } = useTheme();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGetProfile();
        const p = res.profile || ({} as any);
        setFullName(p.fullName || '');
        setUsername(p.username || '');
        setBio(p.bio || '');
      } catch {
        // ignore if not logged in or network error
      }
    })();
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: themeColors.background },
    title: { fontSize: 30, fontWeight: '600', marginBottom: 10, color: themeColors.text },
    input: { borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, padding: 12, marginBottom: 10 },
    btn: { backgroundColor: themeColors.primary, padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
    btnText: { color: 'white', fontWeight: '700' },
  }), [themeColors]);

  async function onSave() {
    try {
      setBusy(true);
      await apiSaveProfile({ fullName: fullName.trim() || undefined, username: username.trim() || undefined, bio: bio.trim() || undefined });
  // Return to Settings tab after a successful save
  router.replace('/(tabs)/settings');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
  <TextInput placeholder="Full name" placeholderTextColor={themeColors.textSecondary} style={styles.input} value={fullName} onChangeText={setFullName} />
  <TextInput autoCapitalize="none" placeholder="Public username" placeholderTextColor={themeColors.textSecondary} style={styles.input} value={username} onChangeText={setUsername} />
  <TextInput placeholder="Bio" placeholderTextColor={themeColors.textSecondary} style={[styles.input, { height: 120 }]} multiline value={bio} onChangeText={setBio} />
      <Pressable onPress={onSave} style={styles.btn} disabled={busy}>
        <Text style={styles.btnText}>{busy ? 'Saving…' : 'Save'}</Text>
      </Pressable>
    </View>
  );
}
