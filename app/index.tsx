import { Redirect } from 'expo-router';

// Redirect root to tabs group to avoid blank screen & silence missing default export warning.
/**
 * React component RootIndex: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
export default function RootIndex() {
	return <Redirect href="/(tabs)" />;
}

