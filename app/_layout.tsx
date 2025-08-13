import { Stack } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import 'react-native-gesture-handler'; // ensures gesture handler is initialized (helps avoid web/runtime crashes)

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

export default function AppLayout() {
  return (
    <RootErrorBoundary>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="trips/[id]" options={{ title: 'Trip Details' }} />
        <Stack.Screen name="trips/[id]/log-new" options={{ title: 'New Day Log' }} />
        <Stack.Screen name="trips/[id]/edit" options={{ title: 'Edit Trip' }} />
        <Stack.Screen name="trips/new" options={{ title: 'New Trip' }} />
      </Stack>
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
});
