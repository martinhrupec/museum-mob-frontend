import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { crossAlert } from './alert';
import { SystemSettings, AssignmentPosition } from '../types';

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
 * Schedule notifikaciju 2 sata prije prve smjene svakog dana
 */
export async function scheduleShiftNotifications(
  assignments: AssignmentPosition[]
): Promise<void> {
  const now = new Date();

  // Grupiraj assignmente po datumu i nađi najraniji start_time po danu
  const earliestByDate = new Map<string, AssignmentPosition>();

  for (const ap of assignments) {
    if (!ap.is_taken || !ap.guard) continue;

    const date = ap.position.date;
    const existing = earliestByDate.get(date);

    if (!existing || ap.position.start_time < existing.position.start_time) {
      earliestByDate.set(date, ap);
    }
  }

  for (const [date, ap] of earliestByDate) {
    const [h, m, s] = ap.position.start_time.split(':').map(Number);
    const shiftDate = new Date(date);
    shiftDate.setHours(h, m, s || 0, 0);

    // 2 sata prije smjene
    const notifyDate = new Date(shiftDate.getTime() - 2 * 60 * 60 * 1000);

    if (notifyDate > now) {
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🏛️ Smjena za 2 sata',
          body: `Vaša smjena na "${ap.position.exhibition_name}" počinje u ${timeStr}.`,
          sound: 'default',
        },
        trigger: {
          type: 'date',
          date: notifyDate,
        } as Notifications.DateTriggerInput,
      });
    }
  }
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
          sound: 'default',
        },
        trigger: {
          type: 'date',
          date: configStartDate,
        } as Notifications.DateTriggerInput,
      });
    }

    // Config period - 30 min prije kraja
    const configEndMinus30 = new Date(configEnd);
    configEndMinus30.setDate(configEndMinus30.getDate() + weekOffset);
    configEndMinus30.setMinutes(configEndMinus30.getMinutes() - 30);
    if (configEndMinus30 > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Konfiguracijski period',
          body: 'Uskoro završava konfiguracijski period!',
          sound: 'default',
        },
        trigger: {
          type: 'date',
          date: configEndMinus30,
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
          sound: 'default',
        },
        trigger: {
          type: 'date',
          date: graceStartDate,
        } as Notifications.DateTriggerInput,
      });
    }

    // Grace period - 30 min prije kraja
    const graceEndMinus30 = new Date(graceEnd);
    graceEndMinus30.setDate(graceEndMinus30.getDate() + weekOffset);
    graceEndMinus30.setMinutes(graceEndMinus30.getMinutes() - 30);
    if (graceEndMinus30 > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Fer period',
          body: 'Uskoro završava fer period!',
          sound: 'default',
        },
        trigger: {
          type: 'date',
          date: graceEndMinus30,
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
          sound: 'default',
        },
        trigger: {
          type: 'date',
          date: manualStartDate,
        } as Notifications.DateTriggerInput,
      });
    }

    // Manual period - 30 min prije kraja
    const manualEndMinus30 = new Date(manualEnd);
    manualEndMinus30.setDate(manualEndMinus30.getDate() + weekOffset);
    manualEndMinus30.setMinutes(manualEndMinus30.getMinutes() - 30);
    if (manualEndMinus30 > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Ručno upisivanje/ispisivanje',
          body: 'Uskoro završava period ručnog upisivanja/ispisivanja!',
          sound: 'default',
        },
        trigger: {
          type: 'date',
          date: manualEndMinus30,
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
