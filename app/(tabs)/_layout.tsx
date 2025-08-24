import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
      {/* Leftmost: Map */}
      <Tabs.Screen
        name="map"
        options={{
          href: flags.maps ? undefined : null,
          title: 'Map',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} color={color} size={size ?? 24} />
          ),
        }}
      />
      {/* Next: Trips (standard tab) */}
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
      {/* Center floating button: Home */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: '',
          tabBarButton: (props) => {
            const selected = (props as any)?.accessibilityState?.selected;
            return (
              <CentralHomeButton
                selected={selected}
                onPress={() => {
                  if (pathname !== '/') {
                    router.replace('/');
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

// Floating glossy central Home button
function CentralHomeButton({ selected: _selectedFromTabs, onPress }: { selected?: boolean; onPress?: () => void }) {
  const { themeColors, colorScheme } = useTheme();
  const pathname = usePathname();
  const selected = pathname === '/'; // derive explicitly to avoid timing issues with custom tabBarButton
  const bg = selected ? themeColors.primary : (themeColors.primaryDark ?? themeColors.primary);
  const iconColor = themeColors.btnText;
  // Ring (outer border) should match tab bar upper border color in dark mode per request
  const ringColor = colorScheme === 'dark'
    ? themeColors.menuBorder
    : (selected ? themeColors.accent : themeColors.card);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Home"
      style={({ pressed }) => [{
        position: 'relative',
        top: -24,
        width: 74, // slightly larger to make ring + glow clearer
        height: 74,
        borderRadius: 37,
        backgroundColor: bg,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: selected ? themeColors.accent : '#000',
        shadowOffset: { width: 0, height: selected ? 6 : 4 },
        shadowOpacity: selected ? 0.55 : 0.35,
        shadowRadius: selected ? 11 : 7,
        elevation: selected ? 15 : 10,
        marginHorizontal: 8,
        borderWidth: selected ? 4 : 3,
        borderColor: ringColor,
        opacity: pressed ? 0.9 : 1,
        overflow: 'visible',
      }]}
    >
      {/* Inner glow ring */}
      {selected && (
        <View style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 37,
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.35)',
        }} />
      )}
      {/* Accent radial glow contained within bounds so it's not clipped by tab bar */}
      {selected && (
        <LinearGradient
          pointerEvents="none"
          colors={[
            'rgba(248,131,121,0.50)',
            'rgba(248,131,121,0.20)',
            'rgba(248,131,121,0.05)',
            'rgba(248,131,121,0)'
          ]}
          locations={[0,0.55,0.8,1]}
          start={{ x: 0.5, y: 0.15 }}
          end={{ x: 0.5, y: 1 }}
          style={{
            position: 'absolute',
            top: -2,
            left: -2,
            right: -2,
            bottom: -2,
            borderRadius: 39,
          }}
        />
      )}
      {/* Top light sheen */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 37,
        }}
      />
      <Ionicons name={selected ? 'home' : 'home-outline'} size={30} color={iconColor} />
    </Pressable>
  );
}
