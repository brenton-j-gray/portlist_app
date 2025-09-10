import { Colors } from '../components/constants/Colors';
import { DarkColors } from '../components/constants/DarkColors';
import { ColorScheme } from './useColorScheme';

/**
 * Function useThemeColors: TODO describe purpose and usage.
 * @param {any} scheme - TODO: describe
 * @returns {any} TODO: describe
 */
export function useThemeColors(scheme: ColorScheme) {
  return scheme === 'dark' ? DarkColors : Colors;
}
