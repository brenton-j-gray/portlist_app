import { Redirect } from 'expo-router';

// Redirect root to tabs group to avoid blank screen & silence missing default export warning.
export default function RootIndex() {
	return <Redirect href="/(tabs)" />;
}

