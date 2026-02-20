import { AssignmentPosition, SystemSettings } from '../types';

/**
 * Grupira pozicije po danima
 */
export const groupPositionsByDate = (positions: AssignmentPosition[]) => {
  const grouped: Record<string, AssignmentPosition[]> = {};
  
  positions.forEach(pos => {
    const date = pos.position.date;
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(pos);
  });
  
  return grouped;
};

/**
 * Određuje da li je pozicija ujutro ili popodne na osnovu system settings
 */
export const getShiftType = (
  startTime: string,
  date: string,
  systemSettings: SystemSettings
): 'morning' | 'afternoon' => {
  // Provjeri da li je vikend (subota = 6, nedjelja = 0)
  const dayOfWeek = new Date(date).getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  const morningEnd = isWeekend 
    ? systemSettings.weekend_morning_end 
    : systemSettings.weekday_morning_end;
  
  // Usporedi vremena (format HH:mm:ss)
  return startTime < morningEnd ? 'morning' : 'afternoon';
};

/**
 * Grupira pozicije po smjenama (jutro/popodne)
 */
export const groupPositionsByShift = (
  positions: AssignmentPosition[],
  date: string,
  systemSettings: SystemSettings
) => {
  const morning: AssignmentPosition[] = [];
  const afternoon: AssignmentPosition[] = [];
  
  positions.forEach(pos => {
    const shift = getShiftType(pos.position.start_time, date, systemSettings);
    if (shift === 'morning') {
      morning.push(pos);
    } else {
      afternoon.push(pos);
    }
  });
  
  return { morning, afternoon };
};

/**
 * Filtrira pozicije na normalne i special events
 */
export const separateSpecialEvents = (positions: AssignmentPosition[]) => {
  const regular: AssignmentPosition[] = [];
  const special: AssignmentPosition[] = [];
  
  positions.forEach(pos => {
    if (pos.position.is_special_event) {
      special.push(pos);
    } else {
      regular.push(pos);
    }
  });
  
  return { regular, special };
};

/**
 * Formatira datum u hrvatski format (npr. "17.2. utorak")
 */
export const formatDateWithDay = (dateString: string): string => {
  const date = new Date(dateString);
  const days = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota'];
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = date.getMonth() + 1;
  
  return `${day}.${month}. ${dayName}`;
};

/**
 * Sortira pozicije po izložbi i vremenu
 */
export const sortPositions = (positions: AssignmentPosition[]): AssignmentPosition[] => {
  return [...positions].sort((a, b) => {
    // Prvo sortiraj po imenu izložbe
    const exhibitionCompare = a.position.exhibition_name.localeCompare(b.position.exhibition_name);
    if (exhibitionCompare !== 0) return exhibitionCompare;
    
    // Onda po vremenu
    return a.position.start_time.localeCompare(b.position.start_time);
  });
};

/**
 * Generira sve datume u tjednu od početnog do krajnjeg datuma
 */
export const getAllDatesInWeek = (weekStart: string, weekEnd: string): string[] => {
  const dates: string[] = [];
  const start = new Date(weekStart);
  const end = new Date(weekEnd);
  
  const current = new Date(start);
  while (current <= end) {
    // Format YYYY-MM-DD
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
};

/**
 * Provjerava da li je dan radni dan
 * Backend koristi: 0=ponedjeljak, 1=utorak, 2=srijeda, 3=četvrtak, 4=petak, 5=subota, 6=nedjelja
 * JavaScript date.getDay() koristi: 0=nedjelja, 1=ponedjeljak, 2=utorak, 3=srijeda, 4=četvrtak, 5=petak, 6=subota
 */
export const isWorkingDay = (dateString: string, workdays: number[]): boolean => {
  const date = new Date(dateString);
  const jsDayOfWeek = date.getDay(); // 0=nedjelja, 1=pon, 2=uto...
  
  // Konvertuj iz JS formata u backend format
  const backendDayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
  
  return workdays.includes(backendDayOfWeek);
};
