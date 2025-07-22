import { useRouter } from 'expo-router';
import { Button, StyleSheet, Text, View } from 'react-native';

export default function TripsScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Trips</Text>
      <Text>No trips yet. Tap below to add your first cruise!</Text>
      <Button title="Add Trip" onPress={() => {/* later: router.push('/trips/new') */}} />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 10 },
});
