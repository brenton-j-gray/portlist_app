import { Ionicons } from '@expo/vector-icons';
import { Tabs, router, usePathname } from 'expo-router';
import React, { useMemo } from 'react';
import { useFeatureFlags } from '../../components/FeatureFlagsContext';
import { useTheme } from '../../components/ThemeContext';
import AppHeader from '../../components/navigation/AppHeader';

export default function TabsLayout() {
  const { themeColors } = useTheme();
  const { flags } = useFeatureFlags();
  const pathname = usePathname();
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
        name="map"
        options={{
          // Hide when disabled to avoid non-Screen children warnings
          href: flags.maps ? undefined : null,
          title: 'Map',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} color={color} size={size ?? 24} />
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
        listeners={{
          tabPress: (e) => {
            // Always go to the parent Trips index when pressing the tab
            e.preventDefault();
            // Group segments like (tabs) are not part of the path; trips index is '/trips'
            // Use replace to avoid stacking previous nested screens
            if (pathname !== '/trips') {
              router.replace('/trips');
            } else {
              // Already on /trips; re-navigate to refresh/scroll-to-top behavior if desired
              router.replace('/trips');
            }
          },
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
