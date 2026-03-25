import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { crossAlert } from './alert';
import { SystemSettings } from '../types';

// Konfiguracija kako će se notifikacije prikazivati kada je app u foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Zatraži permisije za notifikacije
 */
export async function registerForPushNotificationsAsync(): Promise<boolean> {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      crossAlert(
        'Notifikacije onemogućene',
        'Molimo omogućite notifikacije u postavkama uređaja kako biste primali obavijesti o rokovima.'
      );
      return false;
    }

    return true;
  } else {
    crossAlert('Info', 'Notifikacije rade samo na fizičkom uređaju');
    return false;
  }
}

/**
 * Izračunaj datum i vrijeme za početak perioda
 */
function getDateForPeriodStart(
  currentWeekStart: string,
  day: number,
  timeStr: string
): Date {
  const weekStart = new Date(currentWeekStart);
  const target = new Date(weekStart);
  target.setDate(weekStart.getDate() + day);

  const [h, m, s] = timeStr.split(':').map(Number);
  target.setHours(h, m, s || 0, 0);

  return target;
}

/**
 * Schedule notifikacije za sve periode
 */
export async function schedulePeriodNotifications(settings: SystemSettings): Promise<void> {
  // Prvo otkaži sve postojeće notifikacije
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();

  // Config period
  const configStart = getDateForPeriodStart(
    settings.this_week_start,
    settings.config_start_day,
    settings.config_start_time
  );
  const configEnd = getDateForPeriodStart(
    settings.this_week_start,
    settings.config_end_day,
    settings.config_end_time
  );

  // Grace period
  const graceStart = getDateForPeriodStart(
    settings.this_week_start,
    settings.grace_period_start_day,
    settings.grace_period_start_time
  );
  const graceEnd = getDateForPeriodStart(
    settings.this_week_start,
    settings.grace_period_end_day,
    settings.grace_period_end_time
  );

  // Manual period
  const manualStart = getDateForPeriodStart(
    settings.this_week_start,
    settings.manual_assignment_day,
    settings.manual_assignment_time
  );
  const manualEnd = getDateForPeriodStart(
    settings.this_week_start,
    settings.manual_assignment_end_day,
    settings.manual_assignment_end_time
  );

  // Schedule notifikacije za ovaj tjedan i sljedeći
  const weeks = [
    { start: settings.this_week_start, label: 'ovaj tjedan' },
    { start: settings.next_week_start, label: 'sljedeći tjedan' },
  ];

  for (const week of weeks) {
    const weekOffset = week.start === settings.next_week_start ? 7 : 0;

    // Config period - početak
    const configStartDate = new Date(configStart);
    configStartDate.setDate(configStartDate.getDate() + weekOffset);
    if (configStartDate > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚙️ Konfiguracijski period',
          body: 'Konfiguracijski period je počeo!',
          sound: true,
        },
        trigger: {
          type: 'date',
          date: configStartDate,
        } as Notifications.DateTriggerInput,
      });
    }

    // Config period - 5 min prije kraja
    const configEndMinus5 = new Date(configEnd);
    configEndMinus5.setDate(configEndMinus5.getDate() + weekOffset);
    configEndMinus5.setMinutes(configEndMinus5.getMinutes() - 5);
    if (configEndMinus5 > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Konfiguracijski period',
          body: 'Još 5 minuta do kraja konfiguracijskog perioda!',
          sound: true,
        },
        trigger: {
          type: 'date',
          date: configEndMinus5,
        } as Notifications.DateTriggerInput,
      });
    }

    // Grace period - početak
    const graceStartDate = new Date(graceStart);
    graceStartDate.setDate(graceStartDate.getDate() + weekOffset);
    if (graceStartDate > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏱️ Fer period',
          body: 'Fer period ručnog upisivanja je počeo!',
          sound: true,
        },
        trigger: {
          type: 'date',
          date: graceStartDate,
        } as Notifications.DateTriggerInput,
      });
    }

    // Grace period - 5 min prije kraja
    const graceEndMinus5 = new Date(graceEnd);
    graceEndMinus5.setDate(graceEndMinus5.getDate() + weekOffset);
    graceEndMinus5.setMinutes(graceEndMinus5.getMinutes() - 5);
    if (graceEndMinus5 > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Fer period',
          body: 'Još 5 minuta fer perioda!',
          sound: true,
        },
        trigger: {
          type: 'date',
          date: graceEndMinus5,
        } as Notifications.DateTriggerInput,
      });
    }

    // Manual period - početak (ali samo ako nije unutar grace perioda)
    const manualStartDate = new Date(manualStart);
    manualStartDate.setDate(manualStartDate.getDate() + weekOffset);
    if (manualStartDate > now && manualStartDate.getTime() !== graceStartDate.getTime()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '✍️ Ručno upisivanje',
          body: 'Ručno upisivanje/ispisivanje pozicija je počelo!',
          sound: true,
        },
        trigger: {
          type: 'date',
          date: manualStartDate,
        } as Notifications.DateTriggerInput,
      });
    }

    // Manual period - 5 min prije kraja
    const manualEndMinus5 = new Date(manualEnd);
    manualEndMinus5.setDate(manualEndMinus5.getDate() + weekOffset);
    manualEndMinus5.setMinutes(manualEndMinus5.getMinutes() - 5);
    if (manualEndMinus5 > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Ručno upisivanje/ispisivanje',
          body: 'Još 5 minuta za besplatno ispisivanje pozicija!',
          sound: true,
        },
        trigger: {
          type: 'date',
          date: manualEndMinus5,
        } as Notifications.DateTriggerInput,
      });
    }
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  console.log(`✅ Notifikacije za periode su zakazane (${scheduled.length} notifikacija)`);
}

/**
 * Otkaži sve notifikacije
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('🔕 Sve notifikacije su otkazane');
}

/**
 * Prikaži trenutno zakazane notifikacije (za debug)
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return await Notifications.getAllScheduledNotificationsAsync();
}
