import { Link, router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../components/AuthContext';
import { useTheme } from '../../components/ThemeContext';

/**
 * React component RegisterScreen: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
export default function RegisterScreen() {
  const { themeColors } = useTheme();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.primary, borderRadius: 12, padding: 16 },
    title: { color: themeColors.text, fontSize: 22, fontWeight: '800', marginBottom: 12 },
    input: { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.menuBorder, borderWidth: 1, borderRadius: 10, padding: Platform.OS === 'web' ? 10 : 12, marginBottom: 10 },
    btn: { backgroundColor: themeColors.primary, padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
    btnText: { color: 'white', fontWeight: '700' },
    linkRow: { marginTop: 10, alignItems: 'center' },
    linkText: { color: themeColors.primaryDark, fontWeight: '700' },
  skipBtn: { marginTop: 10, padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: themeColors.primary, backgroundColor: themeColors.primary + '12' },
  skipText: { color: themeColors.primaryDark, fontWeight: '700' },
  }), [themeColors]);

  /**
     * React component onRegister: TODO describe purpose and where it’s used.
     * @returns {Promise<void>} TODO: describe
     */
    async function onRegister() {
    try {
      setBusy(true);
  await register(email.trim().toLowerCase(), password);
  router.replace('/(auth)/setup');
    } catch (e: any) {
      Alert.alert('Register failed', e?.message || 'Try a different email.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Create account</Text>
  <TextInput autoCapitalize="none" placeholder="Email" placeholderTextColor={themeColors.textSecondary} style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />
  <TextInput placeholder="Password" placeholderTextColor={themeColors.textSecondary} style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
        <Pressable onPress={onRegister} style={styles.btn} disabled={busy}>
          <Text style={styles.btnText}>{busy ? 'Creating…' : 'Create account'}</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(tabs)')} style={styles.skipBtn} disabled={busy}>
          <Text style={styles.skipText}>Continue without account</Text>
        </Pressable>
        <View style={styles.linkRow}>
          <Link href="/(auth)/login"><Text style={styles.linkText}>Have an account? Sign in</Text></Link>
        </View>
      </View>
    </View>
  );
}
