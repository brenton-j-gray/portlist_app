import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { useTheme } from '../../components/ThemeContext';

export default function TabsLayout() {
  const { themeColors } = useTheme();
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
  }), [themeColors]);
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
