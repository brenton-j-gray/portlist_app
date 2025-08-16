import { Tabs, router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../../components/AuthContext';
import { useTheme } from '../../components/ThemeContext';

export default function TabsLayout() {
  const { themeColors } = useTheme();
  const { token, userName, userEmail } = useAuth();
  const screenOptions = useMemo(() => ({
    tabBarLabelStyle: {
      fontSize: 18,
      lineHeight: 18,
      paddingBottom: 0,
      paddingTop: 0,
    },
    tabBarStyle: {
      minHeight: 70,
      paddingBottom: 1,
      paddingTop: 1,
      backgroundColor: themeColors.card,
      borderTopColor: themeColors.menuBorder,
      borderTopWidth: 1,
    },
    tabBarActiveTintColor: themeColors.primary,
    tabBarInactiveTintColor: themeColors.textSecondary,
    headerStyle: { backgroundColor: themeColors.card },
    headerTitleStyle: { color: themeColors.text },
    headerTintColor: themeColors.primaryDark,
    headerRight: () => (
      token ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
          <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>Logged in as:</Text>
          <Text style={{ color: themeColors.text, fontWeight: '700', maxWidth: 120 }} numberOfLines={1}>
            {userName || userEmail || 'User'}
          </Text>
          <Pressable onPress={() => router.push('/(tabs)/profile' as any)} accessibilityLabel="Open profile">
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: themeColors.menuBorder }} />
          </Pressable>
        </View>
      ) : null
    ),
  }), [themeColors, token, userName, userEmail]);
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
  {/* Hidden screen for editing profile; navigable from Settings */}
  <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
