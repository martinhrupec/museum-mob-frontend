import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User) => Promise<void>;
  setTokens: (access: string, refresh: string) => Promise<void>;
  logout: () => Promise<void>;
  loadTokens: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,
  
  setUser: async (user) => {
    await AsyncStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },
  
  setTokens: async (access, refresh) => {
    await AsyncStorage.setItem('accessToken', access);
    await AsyncStorage.setItem('refreshToken', refresh);
    set({ accessToken: access, refreshToken: refresh });
  },
  
  logout: async () => {
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('user');
    set({ user: null, accessToken: null, refreshToken: null });
  },
  
  loadTokens: async () => {
    try {
      const access = await AsyncStorage.getItem('accessToken');
      const refresh = await AsyncStorage.getItem('refreshToken');
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      set({ accessToken: access, refreshToken: refresh, user, isLoading: false });
    } catch (error) {
      console.error('Failed to load tokens:', error);
      set({ isLoading: false });
    }
  },
}));
