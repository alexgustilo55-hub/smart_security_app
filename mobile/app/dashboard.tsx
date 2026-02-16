import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeRouter } from './api/navigation';

export default function Dashboard() {
  const router = useSafeRouter();

  const handleLogout = () => {
    router.push('/'); 
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hello!! Admin 👋</Text>
      <Text style={styles.subtitle}>Welcome to your dashboard</Text>

      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f4f6fb' },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 10, color: '#1e3a8a' },
  subtitle: { fontSize: 16, color: '#4b5563', marginBottom: 30, textAlign: 'center' },
  button: { backgroundColor: '#dc3545', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
