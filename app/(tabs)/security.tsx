import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAppLock } from '../../components/AppLockContext';
import { useTheme } from '../../components/ThemeContext';
import { api2faDisable, api2faSetup, api2faStatus, api2faVerifySetup, apiChangeEmail, apiChangePassword } from '../../lib/api';

/**
 * React component SecurityScreen: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
export default function SecurityScreen() {
  const { themeColors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: themeColors.background },
  section: { backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.primary, borderRadius: 12, padding: 14, marginBottom: 14 },
    title: { fontSize: 18, fontWeight: '700', color: themeColors.text, marginBottom: 8 },
    label: { fontSize: 12, color: themeColors.textSecondary, marginBottom: 6, fontWeight: '600' },
    row: { flexDirection: 'row', gap: 8 },
    input: { flex: 1, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, padding: 12 },
    btn: { backgroundColor: themeColors.primary, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: 'white', fontWeight: '700' },
  }), [themeColors]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
  <AppLockSection />
  <TwoFASection />
      <View style={styles.section}>
        <Text style={styles.title}>Change email</Text>
        <EmailChangeForm />
      </View>
      <View style={styles.section}>
        <Text style={styles.title}>Change password</Text>
        <PasswordChangeForm />
      </View>
    </ScrollView>
  );
}

/**
 * React component EmailChangeForm: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
function EmailChangeForm() {
  const { themeColors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const styles = useMemo(() => StyleSheet.create({
    row: { flexDirection: 'row', gap: 8 },
    input: { flex: 1, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, padding: 12 },
    btn: { backgroundColor: themeColors.primary, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: 'white', fontWeight: '700' },
  }), [themeColors]);

  /**
     * React component onSubmit: TODO describe purpose and where it’s used.
     * @returns {Promise<void>} TODO: describe
     */
    async function onSubmit() {
    if (!email || !password) return;
    setBusy(true);
    try {
      await apiChangeEmail(email.trim(), password);
      Alert.alert('Success', 'Email updated.');
      setEmail('');
      setPassword('');
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <View style={styles.row}>
        <TextInput placeholder="New email" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={themeColors.textSecondary} style={styles.input} value={email} onChangeText={setEmail} />
        <TextInput placeholder="Current password" secureTextEntry placeholderTextColor={themeColors.textSecondary} style={styles.input} value={password} onChangeText={setPassword} />
        <TouchableOpacity onPress={onSubmit} disabled={busy || !email || !password} style={[styles.btn, { opacity: busy || !email || !password ? 0.6 : 1 }]}>
          {busy ? <ActivityIndicator color={'white'} /> : <Text style={styles.btnText}>Save</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * React component PasswordChangeForm: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
function PasswordChangeForm() {
  const { themeColors } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const styles = useMemo(() => StyleSheet.create({
    row: { flexDirection: 'row', gap: 8 },
    input: { flex: 1, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, padding: 12 },
    btn: { backgroundColor: themeColors.primary, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: 'white', fontWeight: '700' },
  }), [themeColors]);

  /**
     * React component onSubmit: TODO describe purpose and where it’s used.
     * @returns {Promise<void>} TODO: describe
     */
    async function onSubmit() {
    if (!currentPassword || !newPassword) return;
    setBusy(true);
    try {
      await apiChangePassword(currentPassword, newPassword);
      Alert.alert('Success', 'Password updated.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <View style={styles.row}>
        <TextInput placeholder="Current password" secureTextEntry placeholderTextColor={themeColors.textSecondary} style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} />
        <TextInput placeholder="New password (min 8)" secureTextEntry placeholderTextColor={themeColors.textSecondary} style={styles.input} value={newPassword} onChangeText={setNewPassword} />
        <TouchableOpacity onPress={onSubmit} disabled={busy || !currentPassword || !newPassword} style={[styles.btn, { opacity: busy || !currentPassword || !newPassword ? 0.6 : 1 }]}>
          {busy ? <ActivityIndicator color={'white'} /> : <Text style={styles.btnText}>Save</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * React component TwoFASection: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
function TwoFASection() {
  const { themeColors } = useTheme();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const styles = useMemo(() => StyleSheet.create({
  section: { backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.primary, borderRadius: 12, padding: 14, marginBottom: 14 },
    title: { fontSize: 18, fontWeight: '700', color: themeColors.text, marginBottom: 8 },
    row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    input: { flex: 1, borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, padding: 12 },
    btn: { backgroundColor: themeColors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: 'white', fontWeight: '700' },
    info: { color: themeColors.textSecondary, marginTop: 8 },
    codesWrap: { marginTop: 8, gap: 6 },
  codeItem: { color: themeColors.text },
  }), [themeColors]);

  React.useEffect(() => {
    (async () => {
      try {
        const s = await api2faStatus();
        setEnabled(!!s.enabled);
      } catch {}
    })();
  }, []);

  /**
     * React component startSetup: TODO describe purpose and where it’s used.
     * @returns {Promise<void>} TODO: describe
     */
    async function startSetup() {
    setBusy(true);
    try {
      const { otpauthUri: uri } = await api2faSetup();
      setOtpauthUri(uri);
    } catch (e: any) {
      Alert.alert('2FA setup failed', e?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  /**
     * React component verifySetup: TODO describe purpose and where it’s used.
     * @returns {Promise<void>} TODO: describe
     */
    async function verifySetup() {
    if (!code) return;
    setBusy(true);
    try {
      const res = await api2faVerifySetup(code.trim());
      setEnabled(true);
      setBackupCodes(res.backupCodes || []);
      setOtpauthUri(null);
      setCode('');
    } catch (e: any) {
      Alert.alert('Invalid code', e?.message || 'Check the 6-digit code and try again.');
    } finally {
      setBusy(false);
    }
  }

  /**
     * React component disable2fa: TODO describe purpose and where it’s used.
     * @returns {Promise<void>} TODO: describe
     */
    async function disable2fa() {
    if (!password) return;
    setBusy(true);
    try {
      await api2faDisable(password);
      setEnabled(false);
      setPassword('');
      setBackupCodes(null);
      setOtpauthUri(null);
    } catch (e: any) {
      Alert.alert('Disable failed', e?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Two‑Factor Authentication (TOTP)</Text>
      {enabled === null ? (
        <ActivityIndicator />
      ) : enabled ? (
        <>
          <Text style={styles.info}>2FA is enabled on your account.</Text>
          <View style={{ height: 8 }} />
          <View style={styles.row}>
            <TextInput placeholder="Current password" secureTextEntry placeholderTextColor={themeColors.textSecondary} style={styles.input} value={password} onChangeText={setPassword} />
            <TouchableOpacity onPress={disable2fa} disabled={busy || !password} style={[styles.btn, { opacity: busy || !password ? 0.6 : 1 }]}>
              {busy ? <ActivityIndicator color={'white'} /> : <Text style={styles.btnText}>Disable</Text>}
            </TouchableOpacity>
          </View>
        </>
      ) : otpauthUri ? (
        <>
          <Text style={styles.info}>Scan this QR code with your authenticator app, then enter the 6‑digit code to verify.</Text>
          <View style={{ alignItems: 'center', marginVertical: 12 }}>
            {otpauthUri ? <QRCode value={otpauthUri} size={180} /> : null}
          </View>
          <View style={styles.row}>
            <TextInput placeholder="6‑digit code" keyboardType="number-pad" placeholderTextColor={themeColors.textSecondary} style={styles.input} value={code} onChangeText={setCode} />
            <TouchableOpacity onPress={verifySetup} disabled={busy || !code} style={[styles.btn, { opacity: busy || !code ? 0.6 : 1 }]}>
              {busy ? <ActivityIndicator color={'white'} /> : <Text style={styles.btnText}>Verify</Text>}
            </TouchableOpacity>
          </View>
          {backupCodes && backupCodes.length > 0 ? (
            <View style={styles.codesWrap}>
              <Text style={styles.info}>Save these backup codes in a safe place. Each code can be used once if you lose your device:</Text>
              {backupCodes.map((c, i) => (
                <Text key={i} selectable style={styles.codeItem}>{c}</Text>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <TouchableOpacity onPress={startSetup} disabled={busy} style={[styles.btn, { alignSelf: 'flex-start', opacity: busy ? 0.6 : 1 }]}>
          {busy ? <ActivityIndicator color={'white'} /> : <Text style={styles.btnText}>Enable 2FA</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * React component AppLockSection: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
function AppLockSection() {
  const { themeColors } = useTheme();
  const { enabled, setEnabled, lockNow } = useAppLock();
  const styles = useMemo(() => StyleSheet.create({
  section: { backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.primary, borderRadius: 12, padding: 14, marginBottom: 14 },
    title: { fontSize: 18, fontWeight: '700', color: themeColors.text, marginBottom: 8 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    label: { fontSize: 16, color: themeColors.text },
  }), [themeColors]);
  return (
    <View style={styles.section}>
      <Text style={styles.title}>App Lock</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Face/Touch ID</Text>
        <Switch
          value={enabled}
          onValueChange={async (v: boolean) => {
            await setEnabled(v);
            if (v) lockNow();
          }}
          thumbColor={enabled ? themeColors.primary : themeColors.menuBorder}
          trackColor={{ false: themeColors.menuBorder, true: themeColors.primary + '66' }}
        />
      </View>
    </View>
  );
}
