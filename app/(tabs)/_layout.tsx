import { Ionicons } from '@expo/vector-icons';
import { Tabs, router, usePathname } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
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
          tabBarLabel: '',
          tabBarButton: (props) => {
            const selected = (props as any)?.accessibilityState?.selected;
            return (
              <CentralTripsButton
                selected={selected}
                onPress={() => {
                  // Only navigate if not already on the Trips root
                  if (pathname !== '/trips') {
                    router.replace('/trips');
                  }
                }}
              />
            );
          },
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          title: 'Lists',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'list' : 'list-outline'} color={color} size={size ?? 24} />
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

// Floating glossy central Trips button
function CentralTripsButton({ selected, onPress }: { selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Trips"
      style={({ pressed }) => [{
        position: 'relative',
        top: -24,
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: selected ? '#3478F6' : '#4F6DFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
        marginHorizontal: 8,
        borderWidth: 3,
        borderColor: '#FFF',
        opacity: pressed ? 0.85 : 1,
      }]}
    >
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '55%',
        borderTopLeftRadius: 35,
        borderTopRightRadius: 35,
        backgroundColor: 'rgba(255,255,255,0.35)',
      }} />
      <Ionicons name={selected ? 'boat' : 'boat-outline'} size={30} color={'#FFF'} />
    </Pressable>
  );
}
