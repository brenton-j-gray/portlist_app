import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useTheme } from './ThemeContext';

type PillVariant = 'accent' | 'highlight' | 'primary' | 'neutral' | 'success';
type PillSize = 'sm' | 'md';

interface PillProps {
  variant: PillVariant;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  children: React.ReactNode;
  size?: PillSize;
  numberOfLines?: number;
  style?: ViewStyle;
  textStyle?: TextStyle;
  iconColorOverride?: string; // allow custom icon tint (e.g., weather colors)
}

/**
 * React component Pill: TODO describe purpose and where it’s used.
 * @param {any} { variant, iconName, children, size = 'sm', numberOfLines = 1, style, textStyle, iconColorOverride } - TODO: describe
 * @returns {any} TODO: describe
 */
export function Pill({ variant, iconName, children, size = 'sm', numberOfLines = 1, style, textStyle, iconColorOverride }: PillProps) {
  const { themeColors, colorScheme } = useTheme();
  // Map variant to a token color from theme
  const token: string = (() => {
    switch (variant) {
      case 'accent': return themeColors.accent;
      case 'highlight': return themeColors.highlight;
      case 'primary': return themeColors.primary;
  case 'success': return (themeColors as any).success ?? themeColors.primary;
  case 'neutral': default: return (themeColors as any).neutral ?? themeColors.textSecondary; // balanced neutral gray
    }
  })();
  const paddingH = size === 'md' ? 10 : 8;
  const paddingV = size === 'md' ? 6 : 4;
  const fontSize = size === 'md' ? 14 : 13;
  const iconSize = size === 'md' ? 16 : 14;

  return (
    <View
      style={[
        styles.base,
        {
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
          borderColor: token + '55',
          backgroundColor: token + '22',
        },
        style,
      ]}
    >
      {!!iconName && (
        <Ionicons name={iconName as any} size={iconSize} color={iconColorOverride || token} style={{ marginRight: 6 }} />
      )}
      <Text
        numberOfLines={numberOfLines}
        ellipsizeMode="tail"
        style={[
          {
            color: colorScheme === 'light'
              ? (variant === 'neutral' ? themeColors.text : themeColors.text)
              : (variant === 'neutral' ? themeColors.text : token),
            fontWeight: '700',
            fontSize,
            flexShrink: 1,
          },
          textStyle,
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
  },
});

export default Pill;
