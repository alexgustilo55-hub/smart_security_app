import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView, 
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeRouter } from './api/navigation';


interface LoginResponse { 
  success: boolean;
  message: string;
  user?: { user_id: number; username: string; role: string };
}

const login = async (username: string, password: string): Promise<LoginResponse> => {
  try {
    const response = await fetch('http://192.168.137.1:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include', 
    });

    const data = await response.json();

    return {
      success: response.ok && data.success,
      message: data.message,
      user: data.user,
    };
  } catch (err) {
    console.error('Login network error:', err);
    return { success: false, message: 'Network error' };
  }
};

export default function LoginScreen() {
  const router = useSafeRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleLogin = async () => {
    if (!username || !password) {
      setFlash({ type: 'error', message: 'Enter username and password' });
      return;
    }

    setLoading(true);
    try {
      const data = await login(username, password);

      if (data.success) {
        
        try {
          await AsyncStorage.setItem('isLoggedIn', 'true');
          if (data.user) await AsyncStorage.setItem('user', JSON.stringify(data.user));
        } catch (e) {
          console.warn('AsyncStorage failed:', e);
        }

        setFlash({ type: 'success', message: 'Login successful!' });

        // Redirect to admin page
        setTimeout(() => router.replace('/admin_sensor_monitor'), 500);
      } else {
        setFlash({ type: 'error', message: data.message });
      }
    } catch (err) {
      console.error('Login error:', err);
      setFlash({ type: 'error', message: 'Something went wrong' });
    } finally {
      setLoading(false);
      setTimeout(() => setFlash(null), 4000);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Fixed logo import */}
        <Image source={require('../assets/SecuTrack.png')} style={styles.logo} />

        <View style={styles.card}>
          <Text style={styles.title}>Admin Login</Text>
          <Text style={styles.subtitle}>Secure access to your IoT security system</Text>

          <TextInput
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Logging in...' : 'Login'}</Text>
          </TouchableOpacity>
        </View>

        {flash && (
          <View style={[styles.flash, flash.type === 'success' ? styles.success : styles.error]}>
            <Text style={styles.flashText}>{flash.message}</Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f6fb' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  logo: { width: 200, height: 150, resizeMode: 'contain', marginBottom: 10 },
  card: {
    width: 350,
    maxWidth: '90%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    elevation: 5,
    alignItems: 'center',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#1e3a8a', marginBottom: 10 },
  subtitle: { fontSize: 15, color: '#4b5563', marginBottom: 20, textAlign: 'center' },
  input: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginBottom: 15,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#111',
  },
  button: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    marginTop: 5,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  flash: { position: 'absolute', top: 60, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  flashText: { color: '#fff', fontWeight: '600' },
  success: { backgroundColor: '#28a745' },
  error: { backgroundColor: '#dc3545' },
});