import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { SystemSettings } from '../types';
import {
  registerForPushNotificationsAsync,
  schedulePeriodNotifications,
  cancelAllNotifications,
} from '../utils/notifications';

/**
 * Hook za upravljanje notifikacijama perioda
 */
export const useNotifications = (settings: SystemSettings | null) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Setup notifikacija pri mount-u
    const setup = async () => {
      try {
        const hasPermission = await registerForPushNotificationsAsync();
        setIsEnabled(hasPermission);

        if (hasPermission && settings) {
          await schedulePeriodNotifications(settings);
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

    // Auto-rescheduling svakih 7 dana
    const checkAndReschedule = async () => {
      if (isEnabled && settings) {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        // Ako ima manje od 6 notifikacija (1 tjedan), reschedule
        if (scheduled.length < 6) {
          console.log('🔄 Auto-rescheduling notifikacija...');
          await schedulePeriodNotifications(settings);
        }
      }
    };

    // Provjeri svakih 24h
    const interval = setInterval(checkAndReschedule, 24 * 60 * 60 * 1000);

    return () => {
      subscription.remove();
      responseSubscription.remove();
      clearInterval(interval);
    };
  }, [settings, isEnabled]);

  // Re-schedule notifikacije kad se settings promijene
  useEffect(() => {
    const reschedule = async () => {
      if (isEnabled && settings && !isLoading) {
        await schedulePeriodNotifications(settings);
      }
    };

    reschedule();
  }, [settings, isEnabled, isLoading]);

  const disableNotifications = async () => {
    await cancelAllNotifications();
    setIsEnabled(false);
  };

  const enableNotifications = async () => {
    const hasPermission = await registerForPushNotificationsAsync();
    setIsEnabled(hasPermission);

    if (hasPermission && settings) {
      await schedulePeriodNotifications(settings);
    }
  };

  return {
    isEnabled,
    isLoading,
    enableNotifications,
    disableNotifications,
  };
};
