import { Colors } from '../components/constants/Colors';
import { DarkColors } from '../components/constants/DarkColors';
import { ColorScheme } from './useColorScheme';

export function useThemeColors(scheme: ColorScheme) {
  return scheme === 'dark' ? DarkColors : Colors;
}
