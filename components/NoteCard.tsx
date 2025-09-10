import { Ionicons } from '@expo/vector-icons';
import React, { ReactNode } from 'react';
import { Image, LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import { WeatherPill } from '../lib/weather';
import { Note } from '../types';
import { Pill } from './Pill';
import { formatDateWithPrefs, formatTemperature, usePreferences } from './PreferencesContext';
import { useTheme } from './ThemeContext';

export interface NoteCardProps {
  note: Note;
  onPress?: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
  thumbSize?: number; // default 80 (list); can set 56 for compact
  subtitleElement?: ReactNode; // optional custom element below title/date
  style?: any;
  testID?: string;
  compact?: boolean; // condensed spacing / smaller thumb variant
}

/**
 * React component NoteCard: TODO describe purpose and where it’s used.
 * @param {any} { note, onPress, onLayout, thumbSize = 80, subtitleElement, style, testID, compact = false } - TODO: describe
 * @returns {any} TODO: describe
 */
export function NoteCard({ note, onPress, onLayout, thumbSize = 80, subtitleElement, style, testID, compact = false }: NoteCardProps) {
  const { themeColors } = useTheme();
  const { prefs } = usePreferences();
  const thumbUri = note.photos?.[0]?.uri || note.photoUri;
  const accent = note.color || (note.isSeaDay ? themeColors.primary : themeColors.primary);
  const baseBg = note.color ? note.color + '22' : (note.isSeaDay ? themeColors.primary + '12' : themeColors.card);
  const padH = compact ? 10 : 12;
  const padV = compact ? 10 : 12;
  const gap = compact ? 8 : 10;
  const imgSize = compact ? Math.min(thumbSize, 64) : thumbSize;
  const titleSize = compact ? 15 : 16;
  const metaTop = compact ? (note.title ? 1 : 0) : (note.title ? 2 : 0);

  return (
    <Pressable
      onLayout={onLayout}
      onPress={onPress}
      style={[{ paddingVertical: padV, paddingHorizontal: padH, borderRadius: 12, backgroundColor: baseBg, marginTop: compact ? 8 : 10, flexDirection: 'row', alignItems: 'center', gap, borderWidth: 1, borderColor: accent, position: 'relative' }, style]}
      accessibilityLabel={`Open note ${note.title || note.date}`}
      testID={testID}
    >
      {!!note.emoji && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 2, right: 6, zIndex: 10, elevation: 6 }}>
          <Text style={{ fontSize: 32, lineHeight: 40, textShadowColor: 'rgba(0,0,0,0.28)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4, color: undefined as any, backgroundColor: 'transparent', opacity: 1 }}>{note.emoji}</Text>
        </View>
      )}
      {thumbUri ? (
        <Image source={{ uri: thumbUri }} style={{ width: imgSize, height: imgSize, borderRadius: 8 }} />
      ) : (
        <View style={{ width: imgSize - 16, height: imgSize - 16, borderRadius: 8, backgroundColor: note.isSeaDay ? themeColors.primary + '22' : themeColors.card, borderWidth: 1, borderColor: note.isSeaDay ? themeColors.primary : themeColors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={note.isSeaDay ? 'boat-outline' : 'image-outline'} size={24} color={note.isSeaDay ? themeColors.primaryDark : themeColors.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        {!!note.title && <Text numberOfLines={1} style={{ fontSize: titleSize, color: themeColors.text, fontWeight: '600' }}>{note.title}</Text>}
        {note.isSeaDay && !note.title && (
          <Text numberOfLines={1} style={{ fontSize: titleSize, color: themeColors.text, fontWeight: '600' }}>Sea Day</Text>
        )}
  <Text style={{ fontWeight: '600', color: themeColors.text, marginTop: metaTop, fontSize: compact ? 13 : 14 }}>{formatDateWithPrefs(note.date, prefs, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Text>
        {subtitleElement}
        {!!note.description && <Text numberOfLines={compact ? 1 : 2} style={{ color: themeColors.textSecondary, marginTop: 2, fontSize: compact ? 13 : 14 }}>{note.description}</Text>}
        {!!note.notes && <Text numberOfLines={compact ? 1 : 2} style={{ color: themeColors.textSecondary, marginTop: 2, fontSize: compact ? 13 : 14 }}>{note.notes}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 6 : 10, marginTop: compact ? 4 : 6, flexWrap: 'wrap' }}>
          {!!note.weather && <WeatherPill weather={note.weather} size="sm" trailing={typeof (note as any).tempC === 'number' ? formatTemperature((note as any).tempC, prefs, { withUnit: true, decimals: 0 }) : undefined} />}
          {note.isSeaDay && (
            <Pill variant="success" iconName="boat-outline">Sea Day</Pill>
          )}
          {!!(note.locationName || note.location) && (
            <Pill variant="success" iconName="location-outline">
              {(() => {
                const label = note.locationName || '';
                if (/.*,\s*[A-Z]{2}$/i.test(label)) return label;
                const parts = label.split(',').map(p => p.trim()).filter(Boolean);
                if (parts.length >= 2) return `${parts[0]}, ${parts[parts.length - 1]}`;
                return label || 'Location added';
              })()}
            </Pill>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default NoteCard;

// Lightweight skeleton (no shimmer) for loading Note content
/**
 * React component NoteCardSkeleton: TODO describe purpose and where it’s used.
 * @param {any} { thumbSize = 80, lines = 2, showWeather = true, showLocation = true, style } - TODO: describe
 * @returns {any} TODO: describe
 */
export function NoteCardSkeleton({ thumbSize = 80, lines = 2, showWeather = true, showLocation = true, style }: { thumbSize?: number; lines?: number; showWeather?: boolean; showLocation?: boolean; style?: any }) {
  const { themeColors } = useTheme();
  const base = themeColors.card;
  const pulseColor = themeColors.menuBorder + '55';
  const lineArray = Array.from({ length: lines });
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ padding: 12, borderRadius: 12, backgroundColor: base, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: themeColors.menuBorder }, style]}
    >
      <View style={{ width: thumbSize, height: thumbSize, borderRadius: 8, backgroundColor: themeColors.menuBorder + '55' }} />
      <View style={{ flex: 1 }}>
        <View style={{ width: '55%', height: 16, borderRadius: 6, backgroundColor: pulseColor, marginBottom: 6 }} />
        <View style={{ width: '40%', height: 14, borderRadius: 6, backgroundColor: pulseColor, marginBottom: 6 }} />
        {lineArray.map((_, i) => (
          <View key={i} style={{ width: i === lines - 1 ? '70%' : '90%', height: 12, borderRadius: 6, backgroundColor: pulseColor, marginBottom: 6 }} />
        ))}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          {showWeather && <View style={{ width: 68, height: 20, borderRadius: 999, backgroundColor: pulseColor }} />}
          {showLocation && <View style={{ width: 92, height: 20, borderRadius: 999, backgroundColor: pulseColor }} />}
        </View>
      </View>
    </View>
  );
}