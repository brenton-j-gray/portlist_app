import { Stack } from 'expo-router';
import React, { useMemo } from 'react';
import { useTheme } from '../../../components/ThemeContext';
import AppHeader from '../../../components/navigation/AppHeader';

export default function TripsStackLayout() {
	const { themeColors } = useTheme();
	const screenOptions = useMemo(() => ({
		header: (props: any) => <AppHeader {...(props as any)} />,
		headerShadowVisible: false,
		contentStyle: { backgroundColor: themeColors.background },
	}), [themeColors]);
	return (
		<Stack screenOptions={screenOptions}>
			<Stack.Screen name="index" options={{ title: 'Trips' }} />
			<Stack.Screen name="new" options={{ title: 'New Trip' }} />
			<Stack.Screen name="[id]/index" options={{ title: 'Trip Details' }} />
			<Stack.Screen name="[id]/edit" options={{ title: 'Edit Trip' }} />
			<Stack.Screen name="[id]/note-new" options={{ title: 'New Note' }} />
			<Stack.Screen name="[id]/note/[noteId]/index" options={{ title: 'View Note' }} />
			<Stack.Screen name="[id]/note/[noteId]/edit" options={{ title: 'Edit Note' }} />
		</Stack>
	);
}

