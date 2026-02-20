import { useState, useEffect } from 'react';
import { SystemSettings } from '../types';

export type PeriodType = 'config' | 'grace' | 'manual' | 'off';

export interface PeriodInfo {
  type: PeriodType;
  label: string;
  color: string;
  timeRemaining: number; // milisekundi
  nextPeriodStart?: Date;
  minimalPositions?: number; // Minimalan broj pozicija - prikažuje se samo u manual periodu
}

/**
 * Hook za praćenje trenutnog perioda i countdown timera
 */
export const usePeriodTimer = (settings: SystemSettings | null) => {
  const [periodInfo, setPeriodInfo] = useState<PeriodInfo | null>(null);

  useEffect(() => {
    if (!settings) return;

    const calculatePeriod = (): PeriodInfo => {
      const now = new Date();
      const jsDayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
      // Konverzija: System settings koristi 0=Monday, 1=Tuesday, ..., 6=Sunday
      const currentDay = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
      const currentTime = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

      // Helper funkcija za parsiranje vremena "HH:MM:SS" u sekunde
      const parseTime = (timeStr: string): number => {
        const [h, m, s] = timeStr.split(':').map(Number);
        return h * 3600 + m * 60 + s;
      };

      // Helper za kreiranje datuma za određeni dan i vrijeme u tjednu
      const getDateForDayAndTime = (settingsDay: number, timeStr: string): Date => {
        const target = new Date(now);
        // Konverzija settings day (0=Mon) u JS day (0=Sun)
        const jsTargetDay = settingsDay === 6 ? 0 : settingsDay + 1;
        const diff = jsTargetDay - jsDayOfWeek;
        target.setDate(target.getDate() + diff);
        const [h, m, s] = timeStr.split(':').map(Number);
        target.setHours(h, m, s, 0);
        return target;
      };

      // Config period
      const configStart = {
        day: settings.config_start_day,
        time: parseTime(settings.config_start_time),
        timeStr: settings.config_start_time,
      };
      const configEnd = {
        day: settings.config_end_day,
        time: parseTime(settings.config_end_time),
        timeStr: settings.config_end_time,
      };

      // Grace period
      const graceStart = {
        day: settings.grace_period_start_day,
        time: parseTime(settings.grace_period_start_time),
        timeStr: settings.grace_period_start_time,
      };
      const graceEnd = {
        day: settings.grace_period_end_day,
        time: parseTime(settings.grace_period_end_time),
        timeStr: settings.grace_period_end_time,
      };

      // Manual period
      const manualStart = {
        day: settings.manual_assignment_day,
        time: parseTime(settings.manual_assignment_time),
        timeStr: settings.manual_assignment_time,
      };
      const manualEnd = {
        day: settings.manual_assignment_end_day,
        time: parseTime(settings.manual_assignment_end_time),
        timeStr: settings.manual_assignment_end_time,
      };

      // Provjera da li smo u config periodu
      const isInConfigPeriod = (): boolean => {
        if (configStart.day <= configEnd.day) {
          // Period unutar istog tjedna (npr. Pon-Sri)
          return (
            (currentDay > configStart.day || (currentDay === configStart.day && currentTime >= configStart.time)) &&
            (currentDay < configEnd.day || (currentDay === configEnd.day && currentTime < configEnd.time))
          );
        } else {
          // Period prelazi tjedan (npr. Pet-Uto)
          return (
            currentDay > configStart.day ||
            currentDay < configEnd.day ||
            (currentDay === configStart.day && currentTime >= configStart.time) ||
            (currentDay === configEnd.day && currentTime < configEnd.time)
          );
        }
      };

      // Provjera da li smo u grace periodu
      const isInGracePeriod = (): boolean => {
        if (graceStart.day <= graceEnd.day) {
          return (
            (currentDay > graceStart.day || (currentDay === graceStart.day && currentTime >= graceStart.time)) &&
            (currentDay < graceEnd.day || (currentDay === graceEnd.day && currentTime < graceEnd.time))
          );
        } else {
          return (
            currentDay > graceStart.day ||
            currentDay < graceEnd.day ||
            (currentDay === graceStart.day && currentTime >= graceStart.time) ||
            (currentDay === graceEnd.day && currentTime < graceEnd.time)
          );
        }
      };

      // Provjera da li smo u manual periodu (ali ne u grace)
      const isInManualPeriod = (): boolean => {
        if (manualStart.day <= manualEnd.day) {
          return (
            (currentDay > manualStart.day || (currentDay === manualStart.day && currentTime >= manualStart.time)) &&
            (currentDay < manualEnd.day || (currentDay === manualEnd.day && currentTime < manualEnd.time))
          );
        } else {
          return (
            currentDay > manualStart.day ||
            currentDay < manualEnd.day ||
            (currentDay === manualStart.day && currentTime >= manualStart.time) ||
            (currentDay === manualEnd.day && currentTime < manualEnd.time)
          );
        }
      };

      // Odredimo trenutni period
      if (isInConfigPeriod()) {
        const endDate = getDateForDayAndTime(configEnd.day, configEnd.timeStr);
        if (endDate <= now) endDate.setDate(endDate.getDate() + 7); // Ako je prošao, sljedeći tjedan
        
        return {
          type: 'config',
          label: 'Konfiguracijski period traje još:',
          color: '#D3968C', // Rosy Brown
          timeRemaining: endDate.getTime() - now.getTime(),
        };
      }

      if (isInGracePeriod()) {
        const endDate = getDateForDayAndTime(graceEnd.day, graceEnd.timeStr);
        if (endDate <= now) endDate.setDate(endDate.getDate() + 7);
        
        return {
          type: 'grace',
          label: 'Fer period traje još:',
          color: '#839958', // Moss Green
          timeRemaining: endDate.getTime() - now.getTime(),
        };
      }

      if (isInManualPeriod()) {
        const endDate = getDateForDayAndTime(manualEnd.day, manualEnd.timeStr);
        if (endDate <= now) endDate.setDate(endDate.getDate() + 7);
        
        return {
          type: 'manual',
          label: 'Ispisivanje pozicija moguće još:',
          color: '#105666', // Midnight Green
          timeRemaining: endDate.getTime() - now.getTime(),
          minimalPositions: settings.minimal_number_of_positions_in_week,
        };
      }

      // Off period - čekanje sljedećeg config perioda
      const nextConfigStart = getDateForDayAndTime(configStart.day, configStart.timeStr);
      if (nextConfigStart <= now) nextConfigStart.setDate(nextConfigStart.getDate() + 7);

      return {
        type: 'off',
        label: 'Nema aktivnih rokova',
        color: '#F7F4D5', // Beige
        timeRemaining: 0,
        nextPeriodStart: nextConfigStart,
      };
    };

    // Inicijalno postavljanje
    setPeriodInfo(calculatePeriod());

    // Update svaku 1 minutu
    const interval = setInterval(() => {
      setPeriodInfo(calculatePeriod());
    }, 60000);

    return () => clearInterval(interval);
  }, [settings]);

  return periodInfo;
};

/**
 * Helper funkcija za formatiranje preostalog vremena
 */
export const formatTimeRemaining = (milliseconds: number): string => {
  if (milliseconds <= 0) return '0m';

  const totalMinutes = Math.floor(milliseconds / 1000 / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);

  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
    parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
  } else if (totalHours > 0) {
    parts.push(`${totalHours}h`);
    parts.push(`${minutes}m`);
  } else {
    parts.push(`${minutes}m`);
  }

  return parts.join(' ');
};
