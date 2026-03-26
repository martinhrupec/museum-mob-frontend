import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { TouchableOpacity, Text } from 'react-native';
import { useAuthStore } from '../store/authStore';
import CustomSideMenu from '../components/CustomSideMenu';
import WebResponsiveWrapper from '../components/WebResponsiveWrapper';
import { getCurrentSystemSettings } from '../api/endpoints';
import { SystemSettings } from '../types';
import { usePeriodTimer } from '../hooks/usePeriodTimer';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import UsersScreen from '../screens/UsersScreen';
import ExhibitionsScreen from '../screens/ExhibitionsScreen';
import PointsScreen from '../screens/PointsScreen';
import ConfigurationScreen from '../screens/ConfigurationScreen';
import PositionHistoryScreen from '../screens/PositionHistoryScreen';
import ReceptionReportsScreen from '../screens/ReceptionReportsScreen';
import SystemSettingsScreen from '../screens/SystemSettingsScreen';
import AdminNotificationsScreen from '../screens/AdminNotificationsScreen';
import SystemChangesHistoryScreen from '../screens/SystemChangesHistoryScreen';

export type RootStackParamList = {
  Login: undefined;
  Početna: undefined;
  Korisnici: undefined;
  Izložbe: undefined;
  Bodovi: undefined;
  Konfiguracija: undefined;
  'Povijest upisivanja': undefined;
  'Prijave recepciji': undefined;
  'Postavke sustava': undefined;
  'Administratorske obavijesti': undefined;
  'Povijest promjena sustava': undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { accessToken, refreshToken, isSessionAuth, isLoading, loadTokens } = useAuthStore();
  const [menuVisible, setMenuVisible] = useState(false);
  const [navigationRef, setNavigationRef] = useState<any>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const periodInfo = usePeriodTimer(settings);

  useEffect(() => {
    loadTokens();
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await getCurrentSystemSettings();
        setSettings(data);
      } catch (error) {
        console.error('Error loading system settings:', error);
      }
    };
    
    if (accessToken || refreshToken || isSessionAuth) {
      loadSettings();
    }
  }, [accessToken, refreshToken, isSessionAuth]);

  if (isLoading) {
    return null;
  }

  const isAuthenticated = !!(accessToken || refreshToken || isSessionAuth);
  const headerColor = periodInfo?.color || '#F7F4D5';

  // Helper za tekst boju na osnovu pozadine
  const getHeaderTextColor = (bgColor: string): string => {
    if (bgColor === '#105666' || bgColor === '#0A3323') {
      return '#F7F4D5';
    }
    if (bgColor === '#A6C27A') {
      return '#105666';
    }
    return '#0A3323';
  };
  
  const headerTextColor = getHeaderTextColor(headerColor);

  return (
    <WebResponsiveWrapper>
    <NavigationContainer ref={setNavigationRef}>
      <Stack.Navigator
        screenOptions={({ navigation }) => ({
          cardStyle: { flex: 1 },
          headerShown: isAuthenticated,
          headerStyle: { backgroundColor: headerColor },
          headerTintColor: headerTextColor,
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: isAuthenticated ? () => (
            <TouchableOpacity
              onPress={() => setMenuVisible(true)}
              style={{ paddingLeft: 15 }}
            >
              <Text style={{ fontSize: 24, color: headerTextColor }}>☰</Text>
            </TouchableOpacity>
          ) : undefined,
        })}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Početna" component={HomeScreen} />
            <Stack.Screen name="Korisnici" component={UsersScreen} />
            <Stack.Screen name="Izložbe" component={ExhibitionsScreen} />
            <Stack.Screen name="Bodovi" component={PointsScreen} />
            <Stack.Screen name="Konfiguracija" component={ConfigurationScreen} />
            <Stack.Screen name="Povijest upisivanja" component={PositionHistoryScreen} />
            <Stack.Screen name="Prijave recepciji" component={ReceptionReportsScreen} />
            <Stack.Screen name="Postavke sustava" component={SystemSettingsScreen} />
            <Stack.Screen name="Administratorske obavijesti" component={AdminNotificationsScreen} />
            <Stack.Screen name="Povijest promjena sustava" component={SystemChangesHistoryScreen} />
          </>
        ) : (
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>

      {isAuthenticated && (
        <CustomSideMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
        />
      )}
    </NavigationContainer>
    </WebResponsiveWrapper>
  );
}
