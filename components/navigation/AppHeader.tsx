import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';

// A single, reusable header used by both Tabs and nested Stack screens.
// It respects per-screen options like title and headerRight when provided.
export default function AppHeader(props: any) {
  const { themeColors } = useTheme();
  const { token, userName, userEmail } = useAuth();
  const { userAvatar } = useAuth() as any;
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // Compute the next-higher screen in our nav hierarchy from the current path
  const getParentPath = (path: string | null | undefined): string | null => {
    if (!path) return null;
    const parts = path.split('/').filter(Boolean);
    // Normalize trailing index segments (e.g., /[id]/index -> /[id])
    if (parts.length > 0 && parts[parts.length - 1] === 'index') {
      parts.pop();
    }
  // Example parts: ['(tabs)', 'trips', 'abc', 'note', 'def', 'edit']

  // Handle Profile/Security under Settings
  if (parts[0] === '(tabs)' && (parts[1] === 'profile' || parts[1] === 'security')) {
      return '/(tabs)/settings';
    }
    // Also handle plain '/profile' path
    if (parts[0] === 'profile') {
      return '/(tabs)/settings';
    }

    // Trips hierarchy
    if (parts[0] === '(tabs)' && parts[1] === 'trips') {
      // /(tabs)/trips -> no parent
      if (parts.length === 2) return null;

      // /(tabs)/trips/new -> parent trips
      if (parts.length === 3 && parts[2] === 'new') {
        return '/(tabs)/trips';
      }

      // /(tabs)/trips/[id] -> parent trips
      if (parts.length === 3) {
        return '/(tabs)/trips';
      }

    // /(tabs)/trips/[id]/edit or /(tabs)/trips/[id]/note-new -> parent [id]
  if (parts.length === 4 && (parts[3] === 'edit' || parts[3] === 'note-new')) {
        return `/(tabs)/trips/${parts[2]}`;
      }

    // /(tabs)/trips/[id]/note/[noteId] -> parent [id]
  if (parts.length === 5 && parts[3] === 'note') {
        return `/(tabs)/trips/${parts[2]}`;
      }

    // /(tabs)/trips/[id]/note/[noteId]/edit -> parent note/[noteId]
  if (parts.length === 6 && parts[3] === 'note' && parts[5] === 'edit') {
    return `/(tabs)/trips/${parts[2]}/note/${parts[4]}`;
      }
    }

    // Root trips hierarchy (without group), normalize parents to the (tabs) group
    if (parts[0] === 'trips') {
      // /trips -> no parent
      if (parts.length === 1) return null;

      // /trips/new|[id] -> parent trips
      if (parts.length === 2) {
        return '/(tabs)/trips';
      }

      // /trips/[id]/edit or /trips/[id]/note-new -> parent [id]
      if (parts.length === 3 && (parts[2] === 'edit' || parts[2] === 'note-new')) {
        return `/(tabs)/trips/${parts[1]}`;
      }

      // /trips/[id]/note/[noteId] -> parent [id]
      if (parts.length === 4 && parts[2] === 'note') {
        return `/(tabs)/trips/${parts[1]}`;
      }

      // /trips/[id]/note/[noteId]/edit -> parent note/[noteId]
      if (parts.length === 5 && parts[2] === 'note' && parts[4] === 'edit') {
        return `/(tabs)/trips/${parts[1]}/note/${parts[3]}`;
      }
    }

    // Generic fallback: for any grouped path with depth > 2, drop the last segment
    if (parts[0] === '(tabs)' && parts.length > 2) {
      return '/' + parts.slice(0, parts.length - 1).join('/');
    }

    // Otherwise no structured parent
    return null;
  };

  const title = props?.options?.title ?? props?.route?.name ?? '';
  const parentPath = getParentPath(pathname);
  const canGoBack = parentPath !== null;
  const HeaderRight = props?.options?.headerRight as (() => React.ReactNode) | undefined;

  return (
    <View
      style={{
        height: 56 + (insets?.top || 0),
        backgroundColor: themeColors.card,
        borderBottomWidth: 1,
        borderBottomColor: themeColors.menuBorder,
        paddingTop: insets?.top || 0,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {canGoBack ? (
          <Pressable
            onPress={() => {
              if (parentPath) {
                router.replace(parentPath as any);
              }
            }}
            accessibilityLabel="Go back"
            style={{ padding: 8, marginRight: 4 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={22} color={themeColors.primaryDark} />
          </Pressable>
        ) : null}
        <Text style={{ color: themeColors.text, fontSize: 18, fontWeight: '700' }} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {HeaderRight ? (
          // Allow screens to inject custom headerRight content
          HeaderRight()
        ) : token ? (
          // Default identity (shared across app)
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: themeColors.text, fontWeight: '700', maxWidth: 140 }} numberOfLines={1}>
              {userName || userEmail || 'User'}
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/profile' as any)}
              accessibilityLabel="Open profile"
            >
              {userAvatar ? (
                <Image source={{ uri: userAvatar }} style={{ width: 28, height: 28, borderRadius: 14 }} />
              ) : (
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: themeColors.menuBorder }} />
              )}
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}
