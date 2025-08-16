import { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import { Stack, router, usePathname } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-gesture-handler'; // ensures gesture handler is initialized (helps avoid web/runtime crashes)
import { AuthProvider, useAuth } from '../components/AuthContext';
import { ThemeProvider, useTheme } from '../components/ThemeContext';
import { syncTripsBackground } from '../lib/sync';

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
  const { themeColors } = useTheme();
  const { token, userName, userEmail } = useAuth();
  useEffect(() => { syncTripsBackground(); }, []);
  const BackButton = ({ to, label }: { to?: Href; label?: string }) => {
    const pathname = usePathname();
    // Compute parent route if `to` not provided
    let computedTo: Href | undefined = to;
    if (!computedTo) {
      const parts = (pathname || '/').split('/').filter(Boolean);
      if (parts[0] === 'trips') {
        // /trips => no back button needed (not used on tabs)
        // /trips/[id] => parent is /trips
        // Any deeper under /trips/[id]/... => parent is /trips/[id]
        if (parts.length <= 2) {
          computedTo = '/trips' as Href;
        } else {
          computedTo = { pathname: '/trips/[id]', params: { id: parts[1] } } as unknown as Href;
        }
      } else {
        // Fallback
        computedTo = '/' as Href;
      }
    }

    const displayLabel = label ?? (typeof computedTo === 'string' && computedTo === '/trips' ? 'Trips' : 'Back');

    return (
      <Pressable
        onPress={() => {
          // Enforce hierarchical navigation: always go to computed parent
          if (computedTo) {
            router.replace(computedTo);
          } else {
            router.replace('/');
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
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="trips/[id]/index" options={{ title: 'Trip Details', headerBackVisible: false, headerLeft: () => <BackButton />, headerRight: () => (
          token ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
              <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>Logged in as:</Text>
      <Text style={{ color: themeColors.text, fontWeight: '700', maxWidth: 120 }} numberOfLines={1}>{userName || userEmail || 'User'}</Text>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: themeColors.menuBorder }} />
            </View>
          ) : null
        ) }} />
  <Stack.Screen name="trips/[id]/log-new" options={{ title: 'New Log', headerBackVisible: false, headerLeft: () => <BackButton />, headerRight: () => (
          token ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
              <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>Logged in as:</Text>
      <Text style={{ color: themeColors.text, fontWeight: '700', maxWidth: 120 }} numberOfLines={1}>{userName || userEmail || 'User'}</Text>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: themeColors.menuBorder }} />
            </View>
          ) : null
        ) }} />
    <Stack.Screen name="trips/[id]/edit" options={{ title: 'Edit Trip', headerBackVisible: false, headerLeft: () => <BackButton />, headerRight: () => (
          token ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
              <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>Logged in as:</Text>
      <Text style={{ color: themeColors.text, fontWeight: '700', maxWidth: 120 }} numberOfLines={1}>{userName || userEmail || 'User'}</Text>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: themeColors.menuBorder }} />
            </View>
          ) : null
        ) }} />
  <Stack.Screen name="trips/[id]/log/[logId]/edit" options={{ title: 'Edit Log', headerBackVisible: false, headerLeft: () => <BackButton />, headerRight: () => (
          token ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
              <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>Logged in as:</Text>
      <Text style={{ color: themeColors.text, fontWeight: '700', maxWidth: 120 }} numberOfLines={1}>{userName || userEmail || 'User'}</Text>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: themeColors.menuBorder }} />
            </View>
          ) : null
        ) }} />
    <Stack.Screen name="trips/new" options={{ title: 'New Trip', headerBackVisible: false, headerLeft: () => <BackButton />, headerRight: () => (
          token ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
              <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>Logged in as:</Text>
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
