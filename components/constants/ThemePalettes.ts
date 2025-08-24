// Additional theme palettes (light & dark variants) extending the base shape used by Colors/DarkColors.
// Each palette provides the full token set so switching is seamless.

export type ThemePaletteKey = 'ocean' | 'sunset' | 'forest' | 'violet';

type PaletteVariant = {
  primary: string;
  primaryDark: string;
  secondary: string;
  accent: string;
  highlight: string;
  neutral: string;
  success: string;
  background: string;
  card: string;
  cardAccentGradient: string[];
  cardAccentGradientVertical: string[];
  text: string;
  textSecondary: string;
  badgeText: string;
  actionBtnBg: string;
  menuBg: string;
  menuBorder: string;
  menuText: string;
  menuDanger: string;
  btnBg: string;
  btnText: string;
  addBtnText: string; // legacy
  addBtnBg: string;   // legacy
  danger: string;
};

export interface ThemePaletteDefinition {
  light: PaletteVariant;
  dark: PaletteVariant;
  label: string; // for UI chips
}

// Helper to build gradient convenience values
function grad(a: string, b: string) { return [a, b]; }

export const ThemePalettes: Record<ThemePaletteKey, ThemePaletteDefinition> = {
  ocean: { // current default (mirrors existing Colors / DarkColors)
    label: 'Ocean',
    light: {
      primary: '#23597A',
      primaryDark: '#163A52',
      secondary: '#7FC8F8',
      accent: '#F88379',
      highlight: '#E5C07B',
      neutral: '#64748B',
      success: '#22C55E',
      background: '#F3F3F3',
      card: '#FFFFFF',
      cardAccentGradient: grad('#7FC8F8', '#1E4D6B'),
      cardAccentGradientVertical: grad('#7FC8F8', '#1E4D6B'),
      text: '#22223B',
      textSecondary: '#475569',
      badgeText: '#FFFFFF',
      actionBtnBg: 'rgba(30,77,107,0.08)',
      menuBg: '#FFFFFF',
      menuBorder: '#E5E7EB',
      menuText: '#22223B',
      menuDanger: '#DC2626',
      btnBg: '#23597A',
      btnText: '#FFFFFF',
      addBtnText: '#FFFFFF',
      addBtnBg: '#1E4D6B',
      danger: '#DC2626',
    },
  dark: {
      primary: '#7FC8F8',
      primaryDark: '#46AEEB',
      secondary: '#23597A',
      accent: '#F88379',
      highlight: '#E5C07B',
      success: '#22C55E',
      neutral: '#94A3B8',
  background: '#1B2327',
  card: '#2C383F',
      cardAccentGradient: grad('#7FC8F8', '#1E4D6B'),
      cardAccentGradientVertical: grad('#7FC8F8', '#1E4D6B'),
      text: '#F3F6F9',
      textSecondary: '#9AA2AE',
      badgeText: '#0E1113',
      actionBtnBg: 'rgba(127,200,248,0.15)',
      menuBg: '#151A1E',
      menuBorder: '#20262B',
      menuText: '#F3F6F9',
      menuDanger: '#F87171',
      btnBg: '#7FC8F8',
      btnText: '#0E1113',
      addBtnText: '#0E1113',
      addBtnBg: '#7FC8F8',
      danger: '#F87171',
    }
  },
  sunset: {
    label: 'Sunset',
    light: {
      primary: '#D97706', // amber
      primaryDark: '#B45309',
      secondary: '#FDBA74', // soft orange
      accent: '#F472B6', // pink accent
      highlight: '#FCD34D',
      neutral: '#64748B',
      success: '#10B981',
      background: '#FFF8F1',
      card: '#FFFFFF',
      cardAccentGradient: grad('#FDBA74', '#D97706'),
      cardAccentGradientVertical: grad('#FDBA74', '#D97706'),
      text: '#1F2937',
      textSecondary: '#6B7280',
      badgeText: '#1F2937',
      actionBtnBg: 'rgba(217,119,6,0.12)',
      menuBg: '#FFFFFF',
      menuBorder: '#F1D7BF',
      menuText: '#1F2937',
      menuDanger: '#DC2626',
      btnBg: '#D97706',
      btnText: '#FFFFFF',
      addBtnText: '#FFFFFF',
      addBtnBg: '#B45309',
      danger: '#DC2626',
    },
  dark: {
      primary: '#FDBA74',
      primaryDark: '#F59E0B',
      secondary: '#B45309',
      accent: '#F472B6',
      highlight: '#FCD34D',
      success: '#10B981',
      neutral: '#94A3B8',
  background: '#221A15',
  card: '#2F221B',
      cardAccentGradient: grad('#FDBA74', '#D97706'),
      cardAccentGradientVertical: grad('#FDBA74', '#D97706'),
      text: '#FDF7EF',
      textSecondary: '#E0D5CC',
      badgeText: '#1F2937',
      actionBtnBg: 'rgba(253,186,116,0.15)',
      menuBg: '#1F1712',
      menuBorder: '#4B3A2F',
      menuText: '#FDF7EF',
      menuDanger: '#F87171',
      btnBg: '#FDBA74',
      btnText: '#1F2937',
      addBtnText: '#1F2937',
      addBtnBg: '#FDBA74',
      danger: '#F87171',
    }
  },
  forest: {
    label: 'Forest',
    light: {
      primary: '#2F855A',
      primaryDark: '#276749',
      secondary: '#68D391',
      accent: '#38B2AC',
      highlight: '#F6E05E',
      neutral: '#64748B',
      success: '#22C55E',
      background: '#F4FDF7',
      card: '#FFFFFF',
      cardAccentGradient: grad('#68D391', '#276749'),
      cardAccentGradientVertical: grad('#68D391', '#276749'),
      text: '#1F2937',
      textSecondary: '#4B5563',
      badgeText: '#FFFFFF',
      actionBtnBg: 'rgba(47,133,90,0.10)',
      menuBg: '#FFFFFF',
      menuBorder: '#D1E7DA',
      menuText: '#1F2937',
      menuDanger: '#DC2626',
      btnBg: '#2F855A',
      btnText: '#FFFFFF',
      addBtnText: '#FFFFFF',
      addBtnBg: '#276749',
      danger: '#DC2626',
    },
  dark: {
      primary: '#68D391',
      primaryDark: '#48BB78',
      secondary: '#276749',
      accent: '#38B2AC',
      highlight: '#F6E05E',
      success: '#22C55E',
      neutral: '#A3B6C5',
  background: '#16201C',
  card: '#23302A',
      cardAccentGradient: grad('#68D391', '#276749'),
      cardAccentGradientVertical: grad('#68D391', '#276749'),
      text: '#EDF7F1',
      textSecondary: '#B7CEC3',
      badgeText: '#1C2621',
      actionBtnBg: 'rgba(104,211,145,0.18)',
      menuBg: '#141C18',
      menuBorder: '#2F3D35',
      menuText: '#EDF7F1',
      menuDanger: '#F87171',
      btnBg: '#68D391',
      btnText: '#1C2621',
      addBtnText: '#1C2621',
      addBtnBg: '#68D391',
      danger: '#F87171',
    }
  },
  violet: {
    label: 'Violet',
    light: {
      primary: '#6D28D9',
      primaryDark: '#4C1D95',
      secondary: '#C4B5FD',
      accent: '#F472B6',
      highlight: '#FBBF24',
      neutral: '#64748B',
      success: '#22C55E',
      background: '#F7F5FB',
      card: '#FFFFFF',
      cardAccentGradient: grad('#C4B5FD', '#6D28D9'),
      cardAccentGradientVertical: grad('#C4B5FD', '#6D28D9'),
      text: '#1F1F29',
      textSecondary: '#555566',
      badgeText: '#FFFFFF',
      actionBtnBg: 'rgba(109,40,217,0.11)',
      menuBg: '#FFFFFF',
      menuBorder: '#E4DDF4',
      menuText: '#1F1F29',
      menuDanger: '#DC2626',
      btnBg: '#6D28D9',
      btnText: '#FFFFFF',
      addBtnText: '#FFFFFF',
      addBtnBg: '#4C1D95',
      danger: '#DC2626',
    },
  dark: {
      primary: '#C4B5FD',
      primaryDark: '#A78BFA',
      secondary: '#4C1D95',
      accent: '#F472B6',
      highlight: '#FBBF24',
      success: '#22C55E',
      neutral: '#A2A8C5',
  background: '#1B1522',
  card: '#2A2133',
      cardAccentGradient: grad('#C4B5FD', '#6D28D9'),
      cardAccentGradientVertical: grad('#C4B5FD', '#6D28D9'),
      text: '#F4F2F7',
      textSecondary: '#C8C2D6',
      badgeText: '#221B2B',
      actionBtnBg: 'rgba(196,181,253,0.18)',
      menuBg: '#1A1422',
      menuBorder: '#3F3350',
      menuText: '#F4F2F7',
      menuDanger: '#F87171',
      btnBg: '#C4B5FD',
      btnText: '#221B2B',
      addBtnText: '#221B2B',
      addBtnBg: '#C4B5FD',
      danger: '#F87171',
    }
  },
};

export const THEME_PALETTE_KEYS: ThemePaletteKey[] = ['ocean', 'sunset', 'forest', 'violet'];