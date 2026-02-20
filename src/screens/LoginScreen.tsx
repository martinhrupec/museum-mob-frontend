import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { login, getCurrentUser } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { setTokens, setUser } = useAuthStore();

  const handleLogin = async () => {
    console.log('🔵 handleLogin called');
    console.log('🔵 Username:', username);
    console.log('🔵 Password length:', password.length);
    
    if (!username || !password) {
      Alert.alert('Greška', 'Unesite korisničko ime i lozinku');
      return;
    }

    console.log('🔵 Starting login...');
    setIsLoading(true);
    try {
      // 1. Login i dobij tokene
      console.log('🔵 Calling login endpoint...');
      const { access, refresh } = await login(username, password);
      console.log('🔵 Login response received');
      console.log('🔵 Access token:', access?.substring(0, 20) + '...');
      
      await setTokens(access, refresh);
      console.log('🔵 Tokens saved');
      
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
      console.error('❌ Full error:', JSON.stringify(error, null, 2));
      
      const errorMessage = error.response?.data?.detail 
        || error.response?.data?.message
        || error.message
        || 'Proverite korisničko ime i lozinku';
      
      Alert.alert('Greška pri prijavi', errorMessage);
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
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        editable={!isLoading}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Lozinka"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
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
    borderColor: '#839958', // Moss Green
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
    backgroundColor: '#839958', // Moss Green
    opacity: 0.6,
  },
  buttonText: {
    color: '#839958', // Moss Green
    fontSize: 16,
    fontWeight: '600',
  },
});
