import { useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { SystemSettings, AssignmentPosition } from '../types';
import {
  registerForPushNotificationsAsync,
  schedulePeriodNotifications,
  scheduleShiftNotifications,
  cancelAllNotifications,
} from '../utils/notifications';

const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled';

/**
 * Hook za upravljanje notifikacijama perioda i smjena
 */
export const useNotifications = (
  settings: SystemSettings | null,
  myAssignments: AssignmentPosition[] | null = null,
) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isEnabledRef = useRef(false);

  // Drži ref sinkroniziran sa stanjem
  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  // Setup: učitaj preference iz storage-a i postavi listenere
  useEffect(() => {
    if (Platform.OS === 'web') {
      setIsLoading(false);
      return;
    }

    const setup = async () => {
      try {
        const stored = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);

        // Ako korisnik nikad nije odlučio, pitaj za permisije
        if (stored === null) {
          const hasPermission = await registerForPushNotificationsAsync();
          setIsEnabled(hasPermission);
          await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, hasPermission ? 'true' : 'false');
        } else if (stored === 'true') {
          // Provjeri jesu li permisije i dalje aktivne
          const { status } = await Notifications.getPermissionsAsync();
          const stillGranted = status === 'granted';
          setIsEnabled(stillGranted);
          if (!stillGranted) {
            await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'false');
          }
        } else {
          setIsEnabled(false);
        }
      } catch (error) {
        console.error('Error setting up notifications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    setup();

    // Listener za notifikacije koje stižu dok je app otvoren
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('📬 Notifikacija primljena:', notification);
    });

    // Listener za kada korisnik tapne na notifikaciju
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('👆 Korisnik je tapnuo notifikaciju:', response);
      }
    );

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);

  // Scheduling: reagiraj na promjene settings-a, assignments-a ili isEnabled
  useEffect(() => {
    if (Platform.OS === 'web' || isLoading) return;

    const schedule = async () => {
      if (isEnabled && settings) {
        await schedulePeriodNotifications(settings);
        // Schedule shift notifikacije ako imamo assignmente
        if (myAssignments && myAssignments.length > 0) {
          await scheduleShiftNotifications(myAssignments);
        }
      } else {
        await cancelAllNotifications();
      }
    };

    schedule();
  }, [settings, myAssignments, isEnabled, isLoading]);

  // Auto-rescheduling svakih 24h
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const interval = setInterval(async () => {
      if (isEnabledRef.current && settings) {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        if (scheduled.length < 6) {
          console.log('🔄 Auto-rescheduling notifikacija...');
          await schedulePeriodNotifications(settings);
          if (myAssignments && myAssignments.length > 0) {
            await scheduleShiftNotifications(myAssignments);
          }
        }
      }
    }, 24 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [settings, myAssignments]);

  const disableNotifications = async () => {
    await cancelAllNotifications();
    setIsEnabled(false);
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'false');
  };

  const enableNotifications = async () => {
    const hasPermission = await registerForPushNotificationsAsync();
    setIsEnabled(hasPermission);
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, hasPermission ? 'true' : 'false');
  };

  return {
    isEnabled,
    isLoading,
    enableNotifications,
    disableNotifications,
  };
};
