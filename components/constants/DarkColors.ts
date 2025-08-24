// Centralized dark mode color constants for Cruise Journal Pro
// Dark-complementary to brand palette
export const DarkColors = {
  // Core hues adapted for dark UI
  primary: '#7FC8F8', // Aqua Mist pops on dark
  primaryDark: '#46AEEB', // slightly deeper aqua for contrast
  secondary: '#23597aff', // Deep Sea Blue as secondary accents on dark
  accent: '#F88379', // Coral Glow
  highlight: '#E5C07B', // Golden Sand
  success: '#22C55E',
  // Neutral mid-gray tuned for dark
  neutral: '#94A3B8',

  // Surfaces
  // Darkened background & card to reduce contrast of lists in dark mode
  background: '#1b2327',
  card: '#2c383f',

  // Gradients (use primary → secondary for dark)
  cardAccentGradient: ['#7FC8F8', '#1E4D6B'],
  cardAccentGradientVertical: ['#7FC8F8', '#1E4D6B'],

  // Text & UI
  text: '#F3F6F9',
  textSecondary: '#9AA2AE',
  badgeText: '#0E1113',
  actionBtnBg: 'rgba(127,200,248,0.15)',
  menuBg: '#151A1E',
  menuBorder: '#20262B',
  menuText: '#F3F6F9',
  menuDanger: '#f87171',

  // Buttons
  btnBg: '#7FC8F8', // primary on dark (aqua)
  btnText: '#0E1113',
  addBtnText: '#0E1113', // legacy
  addBtnBg: '#7FC8F8',   // legacy

  // Alerts
  danger: '#f87171',
};
