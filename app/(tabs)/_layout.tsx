import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { useTheme } from '../../components/ThemeContext';
import AppHeader from '../../components/navigation/AppHeader';

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
  tabBarHideOnKeyboard: true,
  header: (props: any) => <AppHeader {...(props as any)} />,
  }), [themeColors]);
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={size ?? 24} />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trips',
          headerShown: false,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'boat' : 'boat-outline'} color={color} size={size ?? 24} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} color={color} size={size ?? 24} />
          ),
        }}
      />
  {/* Hidden screen for editing profile; navigable from Settings */}
  <Tabs.Screen name="profile" options={{ href: null, title: 'Edit Profile' }} />
  {/* Hidden screen for security settings; navigable from Settings */}
  <Tabs.Screen name="security" options={{ href: null, title: 'Security' }} />
    </Tabs>
  );
}
