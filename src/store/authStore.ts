import { create } from 'zustand';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { getCurrentUser } from '../api/endpoints';

const isWeb = Platform.OS === 'web';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isSessionAuth: boolean; // true na webu (session cookies)
  isLoading: boolean;

  // Actions
  setUser: (user: User) => Promise<void>;
  setTokens: (access: string, refresh: string) => Promise<void>;
  setSessionAuth: () => Promise<void>; // Za web session login
  logout: () => Promise<void>;
  loadTokens: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isSessionAuth: false,
  isLoading: true,

  setUser: async (user) => {
    await AsyncStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },

  // Mobile JWT tokeni
  setTokens: async (access, refresh) => {
    await AsyncStorage.setItem('accessToken', access);
    await AsyncStorage.setItem('refreshToken', refresh);
    set({ accessToken: access, refreshToken: refresh });
  },

  // Web session - nema tokena, samo flag da je autentificiran
  setSessionAuth: async () => {
    await AsyncStorage.setItem('isSessionAuth', 'true');
    set({ isSessionAuth: true });
  },

  logout: async () => {
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('isSessionAuth');
    set({ user: null, accessToken: null, refreshToken: null, isSessionAuth: false });
  },

  loadTokens: async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;

      if (isWeb) {
        // Web: provjeri sa backendom je li session cookie još validan
        try {
          const freshUser = await getCurrentUser();
          await AsyncStorage.setItem('isSessionAuth', 'true');
          await AsyncStorage.setItem('user', JSON.stringify(freshUser));
          set({ isSessionAuth: true, user: freshUser, isLoading: false });
        } catch {
          // Session istekla ili nevažeća
          await AsyncStorage.removeItem('isSessionAuth');
          await AsyncStorage.removeItem('user');
          set({ isSessionAuth: false, user: null, isLoading: false });
        }
      } else {
        // Mobile: učitaj JWT tokene
        const access = await AsyncStorage.getItem('accessToken');
        const refresh = await AsyncStorage.getItem('refreshToken');
        set({ accessToken: access, refreshToken: refresh, user, isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load tokens:', error);
      set({ isLoading: false });
    }
  },
}));
