import axios from 'axios';
import { API_BASE_URL } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Fallback za web - ako @env ne radi
const API_URL = API_BASE_URL || 'https://muzejski-cuvari.duckdns.org/api';

console.log('🔧 API_BASE_URL from env:', API_BASE_URL);
console.log('🔧 Using API_URL:', API_URL);

const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Request interceptor - dodaje JWT token u svaki zahtev
apiClient.interceptors.request.use(
    async (config) => {
        console.log('📤 Request:', config.method?.toUpperCase(), (config.baseURL || '') + (config.url || ''));
        console.log('📦 Body:', JSON.stringify(config.data));
        console.log('📋 Headers:', JSON.stringify(config.headers));
        
        const token = await AsyncStorage.getItem('accessToken');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - automatski refresh tokena ako je access istekao
apiClient.interceptors.response.use(
    (response) => response, // Uspešan response - propusti dalje
    async (error) => {
        const originalRequest = error.config;
        
        // Ako je 401 i nismo već pokušali refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            try {
                const refreshToken = await AsyncStorage.getItem('refreshToken');
                
                if (!refreshToken) {
                    // Nema refresh tokena - idi na login
                    return Promise.reject(error);
                }
                
                // Pokušaj refresh access tokena DIREKTNO (bez importa endpoints)
                const refreshResponse = await axios.post(
                    `${API_BASE_URL}/api/refresh/`,
                    { refresh: refreshToken }
                );
                
                const { access } = refreshResponse.data;
                
                // Sačuvaj novi access token
                await AsyncStorage.setItem('accessToken', access);
                
                // Ponovi originalni zahtev sa novim tokenom
                originalRequest.headers['Authorization'] = `Bearer ${access}`;
                return apiClient(originalRequest);
                
            } catch (refreshError) {
                // Refresh token takođe istekao - logout korisnika
                await AsyncStorage.removeItem('accessToken');
                await AsyncStorage.removeItem('refreshToken');
                return Promise.reject(refreshError);
            }
        }
        
        return Promise.reject(error);
    }
);

export default apiClient;