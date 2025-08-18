import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import type { Href } from 'expo-router';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-gesture-handler'; // ensures gesture handler is initialized (helps avoid web/runtime crashes)
import { AuthProvider, useAuth } from '../components/AuthContext';
import { ThemeProvider, useTheme } from '../components/ThemeContext';
import { pushTrips, syncTripsBackground } from '../lib/sync';

class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, { error?: Error }> {
  state: { error?: Error } = { };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: any) { console.warn('Root layout error boundary caught', error, info); }
  render() {
    if (this.state.error) {
      return (
        <View style={styles.errContainer}>
          <Text style={styles.errTitle}>Something went wrong</Text>
          <Text selectable>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}


function AppLayoutInner() {
  const { themeColors, colorScheme } = useTheme();
  const { token, userName, userEmail } = useAuth();
  // Load custom fonts (used by Home greeting, etc.)
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Pacifico: Pacifico_400Regular,
  });
  useEffect(() => { syncTripsBackground(); }, []);
  // Auto-backup on app focus and at interval when enabled in Settings
  useEffect(() => {
    let cancelled = false;
    let ticking = false;
    const doSyncIfEnabled = async (reason: 'focus' | 'interval') => {
      if (ticking) return; // avoid overlapping syncs
      ticking = true;
      try {
        const enabled = (await AsyncStorage.getItem('cjp_auto_backup')) === '1';
        if (!enabled || !token) return;
        await syncTripsBackground();
        const ok = await pushTrips();
        if (ok) {
          const ts = Date.now();
          await AsyncStorage.setItem('cjp_last_backup_at', String(ts));
        }
      } catch { /* ignore offline/errors */ }
      finally { ticking = false; }
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !cancelled) doSyncIfEnabled('focus');
    });

    // interval (15 minutes)
    const id = setInterval(() => { if (!cancelled) doSyncIfEnabled('interval'); }, 15 * 60 * 1000);

    return () => {
      cancelled = true;
      sub.remove();
      clearInterval(id);
    };
  }, [token]);
  if (!fontsLoaded) return null;
  const BackButton = ({ to, label }: { to?: Href; label?: string }) => {
    const pathname = usePathname();
    // Compute parent route if `to` not provided, using canonical /(tabs)/trips hierarchy
    let computedTo: string | undefined = typeof to === 'string' ? to : undefined;
    if (!computedTo) {
      const parts = (pathname || '/').split('/').filter(Boolean);
      // Normalize trailing 'index' so /x/y/index -> /x/y
      if (parts.length > 0 && parts[parts.length - 1] === 'index') {
        parts.pop();
      }
      // Normalize to (tabs) grouped routes if we're under trips
      const isTabsTrips = parts[0] === '(tabs)' && parts[1] === 'trips';
      const isRootTrips = parts[0] === 'trips';

      if (isTabsTrips) {
        // /(tabs)/trips -> no parent
        if (parts.length === 2) {
          computedTo = undefined;
        } else if (parts.length === 3) {
          // /(tabs)/trips/new or /(tabs)/trips/[id]
          computedTo = '/(tabs)/trips';
        } else if (parts.length === 4) {
          // /(tabs)/trips/[id]/edit or log-new
          computedTo = `/(tabs)/trips/${parts[2]}`;
        } else if (parts.length === 5 && parts[3] === 'log') {
          // /(tabs)/trips/[id]/log/[logId]
          computedTo = `/(tabs)/trips/${parts[2]}`;
        } else if (parts.length === 6 && parts[3] === 'log' && parts[5] === 'edit') {
          // /(tabs)/trips/[id]/log/[logId]/edit
          computedTo = `/(tabs)/trips/${parts[2]}/log/${parts[4]}`;
        }
      } else if (isRootTrips) {
        // Legacy/top-level trips paths: redirect to tabs-based parents
        if (parts.length === 1) {
          computedTo = '/(tabs)/trips';
        } else if (parts.length === 2) {
          computedTo = '/(tabs)/trips';
        } else if (parts.length >= 3) {
          computedTo = `/(tabs)/trips/${parts[1]}`;
        }
      } else if (parts[0] === '(tabs)' && parts[1] === 'profile') {
        // Profile should go up to Settings
        computedTo = '/(tabs)/settings';
      } else if (parts.length > 1) {
        // Generic fallback: drop the last segment
        const parentParts = parts.slice(0, parts.length - 1);
        computedTo = '/' + parentParts.join('/');
      } else {
        // Fallback to tabs root
        computedTo = '/(tabs)' as any;
      }
    }

    const displayLabel = label ?? (
      computedTo === '/(tabs)/trips' ? 'Trips' : computedTo?.includes('/trips/') ? 'Trip' : 'Back'
    );

    return (
      <Pressable
        onPress={() => {
          if (computedTo) {
            router.replace(computedTo as any);
          }
        }}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 }}
        accessibilityLabel={`Go back`}
      >
        <Ionicons name="chevron-back" size={24} color={themeColors.primaryDark} />
        <Text style={{ color: themeColors.primaryDark, fontWeight: '600' }}>{displayLabel}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
  <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} animated />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: themeColors.card },
        headerTitleStyle: { color: themeColors.text },
        headerTintColor: themeColors.primaryDark,
        headerShadowVisible: false,
      }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen name="trips/[id]/log/[logId]/index" options={{ title: 'View Log', headerBackVisible: false, contentStyle: { backgroundColor: themeColors.background }, headerLeft: () => <BackButton />, headerRight: () => (
          token ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
              <Text style={{ color: themeColors.text, fontWeight: '700', maxWidth: 120 }} numberOfLines={1}>{userName || userEmail || 'User'}</Text>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: themeColors.menuBorder }} />
            </View>
          ) : null
        ) }} />
  <Stack.Screen name="trips/[id]/index" options={{ title: 'Trip Details', headerBackVisible: false, contentStyle: { backgroundColor: themeColors.background }, headerLeft: () => <BackButton />, headerRight: () => (
          token ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
      <Text style={{ color: themeColors.text, fontWeight: '700', maxWidth: 120 }} numberOfLines={1}>{userName || userEmail || 'User'}</Text>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: themeColors.menuBorder }} />
            </View>
          ) : null
        ) }} />
  <Stack.Screen name="trips/[id]/log-new" options={{ title: 'New Log', headerBackVisible: false, contentStyle: { backgroundColor: themeColors.background }, headerLeft: () => <BackButton />, headerRight: () => (
          token ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
      <Text style={{ color: themeColors.text, fontWeight: '700', maxWidth: 120 }} numberOfLines={1}>{userName || userEmail || 'User'}</Text>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: themeColors.menuBorder }} />
            </View>
          ) : null
        ) }} />
  <Stack.Screen name="trips/[id]/edit" options={{ title: 'Edit Trip', headerBackVisible: false, contentStyle: { backgroundColor: themeColors.background }, headerLeft: () => <BackButton />, headerRight: () => (
          token ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
      <Text style={{ color: themeColors.text, fontWeight: '700', maxWidth: 120 }} numberOfLines={1}>{userName || userEmail || 'User'}</Text>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: themeColors.menuBorder }} />
            </View>
          ) : null
        ) }} />
  <Stack.Screen name="trips/[id]/log/[logId]/edit" options={{ title: 'Edit Log', headerBackVisible: false, contentStyle: { backgroundColor: themeColors.background }, headerLeft: () => <BackButton />, headerRight: () => (
          token ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
      <Text style={{ color: themeColors.text, fontWeight: '700', maxWidth: 120 }} numberOfLines={1}>{userName || userEmail || 'User'}</Text>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: themeColors.menuBorder }} />
            </View>
          ) : null
        ) }} />
  <Stack.Screen name="trips/new" options={{ title: 'New Trip', headerBackVisible: false, contentStyle: { backgroundColor: themeColors.background }, headerLeft: () => <BackButton />, headerRight: () => (
          token ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
      <Text style={{ color: themeColors.text, fontWeight: '700', maxWidth: 120 }} numberOfLines={1}>{userName || userEmail || 'User'}</Text>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: themeColors.menuBorder }} />
            </View>
          ) : null
        ) }} />
      </Stack>
    </View>
  );
}

export default function AppLayout() {
  return (
    <RootErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppLayoutInner />
        </AuthProvider>
      </ThemeProvider>
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
});
