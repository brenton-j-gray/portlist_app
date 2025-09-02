import { Link, router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../components/AuthContext';
import { useTheme } from '../../components/ThemeContext';

/**
 * React component LoginScreen: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
export default function LoginScreen() {
  const { themeColors } = useTheme();
  const { login, token, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [mfaStage, setMfaStage] = useState(false);
  const [totp, setTotp] = useState('');

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
     * React component onLogin: TODO describe purpose and where it’s used.
     * @returns {Promise<void>} TODO: describe
     */
    async function onLogin() {
    try {
      setBusy(true);
      // Attempt login; if MFA required, prompt for TOTP
      const res = await (await import('../../lib/api')).apiLogin(email.trim().toLowerCase(), password, mfaStage ? totp.trim() : undefined);
      if ('mfaRequired' in res && res.mfaRequired) {
        setMfaStage(true);
        return;
      }
      if ('token' in res && res.token) {
        // Delegate token handling to AuthContext.login for now by reusing its flow
  await login(email.trim().toLowerCase(), password);
  router.replace('/(tabs)');
  return;
      }
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Login failed', e?.message || 'Check your email and password.');
    } finally {
      setBusy(false);
    }
  }

  // Redirect guard: if already authenticated, skip login UI
  useEffect(() => {
    if (!loading && token) {
      router.replace('/(tabs)');
    }
  }, [loading, token]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Sign in</Text>
  <TextInput autoCapitalize="none" placeholder="Email" placeholderTextColor={themeColors.textSecondary} style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />
  <TextInput placeholder="Password" placeholderTextColor={themeColors.textSecondary} style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
  {mfaStage && (
    <TextInput placeholder="6-digit code" placeholderTextColor={themeColors.textSecondary} style={styles.input} value={totp} onChangeText={setTotp} keyboardType="number-pad" />
  )}
        <Pressable onPress={onLogin} style={styles.btn} disabled={busy}>
          <Text style={styles.btnText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(tabs)')} style={styles.skipBtn} disabled={busy}>
          <Text style={styles.skipText}>Continue without account</Text>
        </Pressable>
        <View style={styles.linkRow}>
          <Link href="/(auth)/register"><Text style={styles.linkText}>Create an account</Text></Link>
        </View>
      </View>
    </View>
  );
}
