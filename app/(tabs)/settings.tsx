import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../components/ThemeContext';

export default function SettingsScreen() {
  const { themePreference, setThemePreference, themeColors } = useTheme();
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
  }), [themeColors]);

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
    </View>
  );
}
// styles memoized above
