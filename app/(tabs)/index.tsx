import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../components/ThemeContext';

export default function HomeScreen() {
  const { themeColors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: themeColors.background },
    title: { fontSize: 30, fontWeight: '600', marginBottom: 12, color: themeColors.text },
    body: { fontSize: 16, color: themeColors.textSecondary, textAlign: 'center' },
  }), [themeColors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cruise Journal Pro</Text>
      <Text style={styles.body}>Welcome aboard! Use the Trips tab to start a new journey.</Text>
    </View>
  );
}
