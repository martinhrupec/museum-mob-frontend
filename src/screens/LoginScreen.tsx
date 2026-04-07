import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { login, getCurrentUser } from '../api/endpoints';
import { crossAlert } from '../utils/alert';
import { useAuthStore } from '../store/authStore';

const isWeb = Platform.OS === 'web';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { setTokens, setUser, setSessionAuth } = useAuthStore();

  const handleLogin = async () => {
    console.log('🔵 handleLogin called');
    console.log('🔵 Username:', username);
    console.log('🔵 Platform:', Platform.OS, '| Auth type:', isWeb ? 'session' : 'JWT');

    if (!username || !password) {
      crossAlert('Greška', 'Unesite korisničko ime i lozinku');
      return;
    }

    console.log('🔵 Starting login...');
    setIsLoading(true);
    try {
      // 1. Login - različit endpoint za web (session) i mobile (JWT)
      console.log('🔵 Calling login endpoint...');
      const data = await login(username, password);
      console.log('🔵 Login response received');

      if (isWeb) {
        // Web session auth - sesija je u cookie-ju, samo postavimo flag
        await setSessionAuth();
        console.log('🔵 Session auth set');
      } else {
        // Mobile JWT auth - sačuvaj tokene
        const { access, refresh } = data;
        console.log('🔵 Access token:', access?.substring(0, 20) + '...');
        await setTokens(access, refresh);
        console.log('🔵 Tokens saved');
      }

      // 2. Dohvati podatke o trenutnom korisniku
      console.log('🔵 Fetching current user...');
      const userData = await getCurrentUser();
      console.log('🔵 User data received:', userData);

      setUser(userData);

      console.log('✅ Uspješna prijava:', userData.username, 'Rola:', userData.role);

      // Navigacija će se automatski desiti jer je auth state promenjen
    } catch (error: any) {
      console.error('❌ Login error:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error message:', error.message);

      let errorMessage: string;
      if (error.response?.status === 401 || error.response?.status === 400) {
        errorMessage = 'Pogrešno korisničko ime ili lozinka. Provjerite podatke i pokušajte ponovo.';
      } else if (!error.response) {
        errorMessage = 'Nije moguće spojiti se na server. Provjerite internetsku vezu.';
      } else {
        errorMessage = error.response?.data?.detail
          || error.response?.data?.message
          || error.message
          || 'Greška pri prijavi. Pokušajte ponovo.';
      }

      crossAlert('Greška pri prijavi', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Muzejski čuvari</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Korisničko ime"
        placeholderTextColor="#7A9A6A"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoComplete="username"
        autoCorrect={false}
        editable={!isLoading}
      />

      <TextInput
        style={styles.input}
        placeholder="Lozinka"
        placeholderTextColor="#7A9A6A"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        autoCorrect={false}
        editable={!isLoading}
      />
      
      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Prijava...' : 'Prijavi se'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#F7F4D5', // Beige
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
    color: '#0A3323', // Dark Green
  },
  input: {
    backgroundColor: '#F7F4D5', // Beige
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#A6C27A', // Moss Green
    color: '#0A3323', // Dark Green
  },
  button: {
    backgroundColor: '#0A3323', // Dark Green
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#A6C27A', // Moss Green
    opacity: 0.6,
  },
  buttonText: {
    color: '#A6C27A', // Moss Green
    fontSize: 16,
    fontWeight: '600',
  },
});
