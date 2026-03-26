import axios from 'axios';
import { Platform } from 'react-native';
import { API_BASE_URL } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Fallback za web - ako @env ne radi
const API_URL = API_BASE_URL || 'https://muzejski-cuvari.duckdns.org/api';

export const isWeb = Platform.OS === 'web';

// Helper za čitanje CSRF tokena iz cookie-ja (Django ga postavlja kao 'csrftoken')
function getCsrfToken(): string | null {
    if (!isWeb) return null;
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : null;
}

const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
    // Web koristi session cookies - withCredentials šalje cookies automatski
    ...(isWeb && { withCredentials: true }),
})

// Request interceptor
apiClient.interceptors.request.use(
    async (config) => {
        console.log('Request:', config.method?.toUpperCase(), (config.baseURL || '') + (config.url || ''));

        if (isWeb) {
            const needsCsrf = config.method !== 'get';
            if (needsCsrf) {
                const csrfToken = getCsrfToken();
                if (csrfToken) {
                    config.headers['X-CSRFToken'] = csrfToken;
                }
            }
        } else {
            // Mobile: dodaj JWT Authorization header
            const token = await AsyncStorage.getItem('accessToken');
            if (token) {
                config.headers['Authorization'] = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - automatski refresh tokena ako je access istekao (samo mobile)
apiClient.interceptors.response.use(
    (response) => response, // Uspješan response - propusti dalje
    async (error) => {
        const originalRequest = error.config;

        // Na webu nema token refresh - ako je 401, sesija je istekla
        if (isWeb) {
            if (error.response?.status === 401) {
                // Očisti session state - korisnik će biti preusmjeren na login
                await AsyncStorage.removeItem('user');
                await AsyncStorage.removeItem('isSessionAuth');
            }
            return Promise.reject(error);
        }

        // Mobile JWT refresh logika
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = await AsyncStorage.getItem('refreshToken');

                if (!refreshToken) {
                    return Promise.reject(error);
                }

                const refreshResponse = await axios.post(
                    `${API_URL}/token/refresh/`,
                    { refresh: refreshToken }
                );

                const { access } = refreshResponse.data;

                await AsyncStorage.setItem('accessToken', access);

                originalRequest.headers['Authorization'] = `Bearer ${access}`;
                return apiClient(originalRequest);

            } catch (refreshError) {
                await AsyncStorage.removeItem('accessToken');
                await AsyncStorage.removeItem('refreshToken');
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default apiClient;