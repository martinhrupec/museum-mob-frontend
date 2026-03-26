import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { crossAlert } from '../utils/alert';
import { useAuthStore } from '../store/authStore';
import { 
  getCurrentSystemSettings, 
  getGuards,
  getGuardAvailableDays,
  setGuardAvailability,
  getAllGuardWorkPeriods,
  setGuardWorkPeriods,
  getAllGuardDayPreferences,
  getAllGuardExhibitionPreferences,
  setGuardDayPreferences,
  setGuardExhibitionPreferences,
  getAllNonWorkingDays,
  getExhibitionsNextWeek,
} from '../api/endpoints';
import { 
  SystemSettings, 
  GuardWorkPeriod, 
  GuardDayPreference, 
  GuardExhibitionPreference, 
  NonWorkingDay,
  Exhibition,
  GuardUser,
  GuardProfile,
} from '../types';

interface SelectedPeriod {
  day_of_week: number;
  shift_type: 'morning' | 'afternoon';
}

interface DayInfo {
  dayOfWeek: number;
  date: string;
  label: string;
  morningAvailable: boolean;
  afternoonAvailable: boolean;
  morningReason?: string;
  afternoonReason?: string;
}

interface GuardConfiguration {
  guardId: number;
  username: string;
  fullName: string;
  availability: number | null;
  workPeriods: GuardWorkPeriod[];
  dayPreferences: GuardDayPreference | null;
  exhibitionPreferences: GuardExhibitionPreference | null;
}

// Helper za dobivanje naziva dana
const getDayName = (dayOfWeek: number): string => {
  const days = ['Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota', 'Nedjelja'];
  return days[dayOfWeek] || '';
};

// Helper za formatiranje datuma
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
};

// Helper za provjeru je li trenutno u konfiguracijskom periodu
const isInConfigPeriod = (settings: SystemSettings): boolean => {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  // Konvertuj JavaScript day (0=Sun) u naš format (0=Mon)
  const adjustedDay = currentDay === 0 ? 6 : currentDay - 1;
  
  const startDay = settings.config_start_day;
  const endDay = settings.config_end_day;
  const startTime = settings.config_start_time.slice(0, 5);
  const endTime = settings.config_end_time.slice(0, 5);
  
  if (adjustedDay < startDay || adjustedDay > endDay) return false;
  if (adjustedDay === startDay && currentTime < startTime) return false;
  if (adjustedDay === endDay && currentTime > endTime) return false;
  
  return true;
};

// Helper za formatiranje config perioda iz system settings
const formatConfigPeriod = (settings: SystemSettings): string => {
  const days = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
  const startDay = days[settings.config_start_day] || '?';
  const endDay = days[settings.config_end_day] || '?';
  const startTime = settings.config_start_time?.slice(0, 5) || '00:00';
  const endTime = settings.config_end_time?.slice(0, 5) || '00:00';
  return `${startDay} ${startTime} — ${endDay} ${endTime}`;
};

// Helper za generiranje dana sljedećeg tjedna
const generateNextWeekDays = (
  settings: SystemSettings, 
  nonWorkingDays: NonWorkingDay[]
): DayInfo[] => {
  const nextWeekStart = new Date(settings.next_week_start);
  const workdays = settings.workdays;
  const days: DayInfo[] = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(nextWeekStart);
    date.setDate(nextWeekStart.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    // dayOfWeek: 0=Mon, 1=Tue, ..., 6=Sun
    const dayOfWeek = i;
    
    // Provjeri je li radni dan
    if (!workdays.includes(dayOfWeek)) continue;
    
    // Provjeri non-working days
    const nonWorkingDay = (nonWorkingDays || []).find(nwd => nwd.date === dateStr);
    
    let morningAvailable = true;
    let afternoonAvailable = true;
    let morningReason: string | undefined;
    let afternoonReason: string | undefined;
    
    if (nonWorkingDay) {
      if (nonWorkingDay.is_full_day) {
        // Cijeli dan je neradni, preskoči
        continue;
      } else {
        // Dio dana je neradni
        if (nonWorkingDay.non_working_shift === 'MORNING') {
          morningAvailable = false;
          morningReason = nonWorkingDay.reason;
        } else if (nonWorkingDay.non_working_shift === 'AFTERNOON') {
          afternoonAvailable = false;
          afternoonReason = nonWorkingDay.reason;
        }
      }
    }
    
    days.push({
      dayOfWeek,
      date: dateStr,
      label: `${getDayName(dayOfWeek)} ${formatDate(dateStr)}`,
      morningAvailable,
      afternoonAvailable,
      morningReason,
      afternoonReason,
    });
  }
  
  return days;
};

// Helper za generiranje dana za preferencije (full day non-working se izbacuju)
const generateDaysForPreferences = (
  settings: SystemSettings, 
  nonWorkingDays: NonWorkingDay[]
): DayInfo[] => {
  const nextWeekStart = new Date(settings.next_week_start);
  const workdays = settings.workdays;
  const days: DayInfo[] = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(nextWeekStart);
    date.setDate(nextWeekStart.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayOfWeek = i;
    
    if (!workdays.includes(dayOfWeek)) continue;
    
    // Samo preskoči potpuno neradne dane
    const nonWorkingDay = (nonWorkingDays || []).find(nwd => nwd.date === dateStr);
    if (nonWorkingDay && nonWorkingDay.is_full_day) continue;
    
    days.push({
      dayOfWeek,
      date: dateStr,
      label: getDayName(dayOfWeek),
      morningAvailable: true,
      afternoonAvailable: true,
    });
  }
  
  return days;
};

export default function ConfigurationScreen() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const guardUser = !isAdmin ? (user as GuardUser) : null;

  // State
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [nonWorkingDays, setNonWorkingDays] = useState<NonWorkingDay[]>([]);
  
  // Guard-specific state
  const [guardProfile, setGuardProfile] = useState<GuardProfile | null>(null);
  const [workPeriods, setWorkPeriods] = useState<GuardWorkPeriod[]>([]);
  const [dayPreferences, setDayPreferences] = useState<GuardDayPreference | null>(null);
  const [exhibitionPreferences, setExhibitionPreferences] = useState<GuardExhibitionPreference | null>(null);
  const [availableDays, setAvailableDays] = useState<number[]>([]); // Dani koje čuvar može raditi
  
  // Admin-specific state
  const [guardConfigurations, setGuardConfigurations] = useState<GuardConfiguration[]>([]);
  const [expandedGuards, setExpandedGuards] = useState<Set<number>>(new Set());
  
  // Availability state
  const [availabilityInput, setAvailabilityInput] = useState('');
  const [savingAvailability, setSavingAvailability] = useState(false);
  
  // Modal states
  const [workPeriodsModalVisible, setWorkPeriodsModalVisible] = useState(false);
  const [dayPreferencesModalVisible, setDayPreferencesModalVisible] = useState(false);
  const [exhibitionPreferencesModalVisible, setExhibitionPreferencesModalVisible] = useState(false);
  
  // Work periods modal state
  const [selectedPeriods, setSelectedPeriods] = useState<SelectedPeriod[]>([]);
  const [savingWorkPeriods, setSavingWorkPeriods] = useState(false);
  const [saveWorkPeriodsForFuture, setSaveWorkPeriodsForFuture] = useState(true);
  
  // Day preferences modal state
  const [orderedDays, setOrderedDays] = useState<number[]>([]);
  const [savingDayPrefs, setSavingDayPrefs] = useState(false);
  const [saveDayPrefsAsTemplate, setSaveDayPrefsAsTemplate] = useState(true);
  
  // Exhibition preferences modal state
  const [orderedExhibitions, setOrderedExhibitions] = useState<number[]>([]);
  const [savingExhibitionPrefs, setSavingExhibitionPrefs] = useState(false);
  const [saveExhibitionPrefsAsTemplate, setSaveExhibitionPrefsAsTemplate] = useState(true);
  
  // Derived state
  const isConfigPeriod = settings ? isInConfigPeriod(settings) : false;
  const hasAvailability = guardProfile?.availability != null && guardProfile.availability > 0;
  const isAvailabilityUpdatedThisWeek = settings && guardProfile?.availability_updated_at
    ? new Date(guardProfile.availability_updated_at) >= new Date(settings.this_week_start)
    : false;
  
  // Filtriraj radne periode za trenutnog čuvara - is_template ILI next_week_start odgovara
  // guard može biti number ili objekt {id: number}
  const getGuardIdFromWp = (wp: any) => {
    if (typeof wp.guard === 'number') return wp.guard;
    return wp.guard?.id;
  };
  
  const myWorkPeriods = (workPeriods || []).filter(
    wp => getGuardIdFromWp(wp) === guardUser?.guard_profile?.id
  );
  const validWorkPeriods = myWorkPeriods.filter(
    wp => wp.is_template || wp.next_week_start === settings?.next_week_start
  );
  const hasWorkPeriods = validWorkPeriods.length > 0;
  
  // Debug logging za derived state
  console.log('Derived: workPeriods count:', workPeriods.length, 'myWorkPeriods:', myWorkPeriods.length, 'validWorkPeriods:', validWorkPeriods.length);
  if (workPeriods.length > 0) {
    console.log('Sample work period guard field:', workPeriods[0]?.guard, 'looking for guard ID:', guardUser?.guard_profile?.id);
  }
  console.log('Derived: hasAvailability:', hasAvailability, 'hasWorkPeriods:', hasWorkPeriods);
  console.log('Derived: dayPreferences:', dayPreferences ? 'set' : 'null', 'exhibitionPreferences:', exhibitionPreferences ? 'set' : 'null');
  
  // === LOAD DATA FUNCTIONS ===
  
  const loadDataForGuard = useCallback(async () => {
    if (!guardUser?.guard_profile?.id) return;
    
    setLoading(true);
    try {
      // Settings moramo dohvatiti prvi jer ostali ovise o njemu
      const settingsData = await getCurrentSystemSettings();
      setSettings(settingsData);
      
      const results = await Promise.allSettled([
        getGuards(),
        getAllGuardWorkPeriods(),
        getAllGuardDayPreferences(),
        getAllGuardExhibitionPreferences(),
        getAllNonWorkingDays(),
        getExhibitionsNextWeek(),
        getGuardAvailableDays(guardUser.guard_profile.id),
      ]);
      
      const guardsData = results[0].status === 'fulfilled' && Array.isArray(results[0].value) ? results[0].value : [];
      const workPeriodsData = results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : [];
      const dayPrefsData = results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value : [];
      const exhibitionPrefsData = results[3].status === 'fulfilled' && Array.isArray(results[3].value) ? results[3].value : [];
      const nonWorkingData = results[4].status === 'fulfilled' && Array.isArray(results[4].value) ? results[4].value : [];
      const exhibitionsData = results[5].status === 'fulfilled' && Array.isArray(results[5].value) ? results[5].value : [];
      // Osiguraj da je availableDaysData uvijek array
      const availableDaysRaw: any = results[6].status === 'fulfilled' ? results[6].value : [];
      console.log('Available days raw response:', JSON.stringify(availableDaysRaw));
      // Ako API vraća objekt s days/available_days property, izvuci array
      let availableDaysData: number[] = [];
      if (Array.isArray(availableDaysRaw)) {
        availableDaysData = availableDaysRaw;
      } else if (availableDaysRaw && typeof availableDaysRaw === 'object') {
        // Provjeri poznate property nazive
        if (Array.isArray(availableDaysRaw.days)) {
          availableDaysData = availableDaysRaw.days;
        } else if (Array.isArray(availableDaysRaw.available_days)) {
          availableDaysData = availableDaysRaw.available_days;
        } else if (Array.isArray(availableDaysRaw.day_of_week_list)) {
          availableDaysData = availableDaysRaw.day_of_week_list;
        }
      }
      console.log('Available days parsed:', availableDaysData);
      
      // Logiranje statusa svih poziva
      console.log('API call results status:', results.map((r, i) => ({
        name: ['guards', 'workPeriods', 'dayPrefs', 'exhibitionPrefs', 'nonWorkingDays', 'exhibitions', 'availableDays'][i],
        status: r.status,
        count: r.status === 'fulfilled' && Array.isArray(r.value) ? r.value.length : (r.status === 'fulfilled' ? 'non-array' : 'failed')
      })));
      
      // Logiranje grešaka za neuspjele pozive
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          const names = ['guards', 'workPeriods', 'dayPrefs', 'exhibitionPrefs', 'nonWorkingDays', 'exhibitions', 'availableDays'];
          const errorData = r.reason?.response?.data;
          const errorMsg = typeof errorData === 'string' ? errorData : JSON.stringify(errorData) || r.reason?.message;
          console.warn(`Failed to load ${names[i]}:`, errorMsg);
        }
      });
      
      // Pronađi profil trenutnog čuvara
      const myProfile = guardsData.find((g: GuardProfile) => g.id === guardUser.guard_profile.id);
      if (myProfile) {
        setGuardProfile(myProfile);
        if (myProfile.availability != null) {
          setAvailabilityInput(String(myProfile.availability));
        }
      }
      
      // Logiranje za debug
      console.log('Guard ID:', guardUser.guard_profile.id);
      console.log('Work periods from API:', JSON.stringify(workPeriodsData.slice(0, 3)));
      console.log('Day prefs from API - count:', dayPrefsData.length, 'sample:', JSON.stringify(dayPrefsData.slice(0, 2)));
      console.log('Exhibition prefs from API - count:', exhibitionPrefsData.length, 'sample:', JSON.stringify(exhibitionPrefsData.slice(0, 2)));
      console.log('Settings next_week_start:', settingsData.next_week_start);
      
      setWorkPeriods(workPeriodsData);
      setNonWorkingDays(nonWorkingData);
      console.log('Setting availableDays state to:', availableDaysData);
      setAvailableDays(availableDaysData);
      
      if (Array.isArray(exhibitionsData)) {
        setExhibitions(exhibitionsData);
      } else {
        setExhibitions([]);
      }
      
      // Pronađi preferencije za trenutnog čuvara
      // guard može biti objekt {id: number} ili samo number
      const getGuardId = (item: any) => {
        if (typeof item.guard === 'number') return item.guard;
        return item.guard?.id;
      };
      
      const myDayPrefs = dayPrefsData.find(
        (dp: any) => getGuardId(dp) === guardUser.guard_profile.id && 
              (dp.is_template || dp.next_week_start === settingsData.next_week_start)
      );
      console.log('Found myDayPrefs:', myDayPrefs ? 'yes' : 'no', myDayPrefs);
      setDayPreferences(myDayPrefs || null);
      
      // Detaljno logiranje za exhibition prefs
      console.log('Searching for exhibition prefs for guard ID:', guardUser.guard_profile.id);
      console.log('Exhibition prefs data entries:', exhibitionPrefsData.map((ep: any) => ({
        guardId: getGuardId(ep),
        isTemplate: ep.is_template,
        nextWeekStart: ep.next_week_start,
        hasExhibitionOrder: !!ep.exhibition_order,
        exhibitionOrderLength: ep.exhibition_order?.length
      })));
      
      const myExhibitionPrefs = exhibitionPrefsData.find(
        (ep: any) => {
          const guardId = getGuardId(ep);
          const matches = guardId === guardUser.guard_profile.id &&
                          (ep.is_template || ep.next_week_start === settingsData.next_week_start);
          console.log('Checking exhibition pref:', { guardId, matches, isTemplate: ep.is_template, nextWeekStart: ep.next_week_start });
          return matches;
        }
      );
      console.log('Found myExhibitionPrefs:', myExhibitionPrefs ? 'yes' : 'no', JSON.stringify(myExhibitionPrefs));
      setExhibitionPreferences(myExhibitionPrefs || null);
    } catch (error: any) {
      console.error('Error loading settings:', error);
      crossAlert('Greška', 'Nije moguće učitati postavke sustava.');
    } finally {
      setLoading(false);
    }
  }, [guardUser?.guard_profile?.id]);
  
  const loadDataForAdmin = useCallback(async () => {
    setLoading(true);
    try {
      // Prvo dohvati settings
      const settingsData = await getCurrentSystemSettings();
      setSettings(settingsData);
      
      // Sada dohvati ostale podatke koristeći next_week_start iz settingsa
      const results = await Promise.allSettled([
        getGuards(),
        getAllGuardWorkPeriods({ next_week_start: settingsData.next_week_start }),
        getAllGuardDayPreferences({ next_week_start: settingsData.next_week_start }),
        getAllGuardExhibitionPreferences({ next_week_start: settingsData.next_week_start }),
        getAllNonWorkingDays(),
        getExhibitionsNextWeek(),
      ]);
      
      const guardsData = results[0].status === 'fulfilled' && Array.isArray(results[0].value) ? results[0].value : [];
      const workPeriodsData = results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : [];
      const dayPrefsData = results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value : [];
      const exhibitionPrefsData = results[3].status === 'fulfilled' && Array.isArray(results[3].value) ? results[3].value : [];
      const nonWorkingData = results[4].status === 'fulfilled' && Array.isArray(results[4].value) ? results[4].value : [];
      const exhibitionsData = results[5].status === 'fulfilled' && Array.isArray(results[5].value) ? results[5].value : [];
      
      // Logiranje grešaka za neuspjele pozive
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          const names = ['guards', 'workPeriods', 'dayPrefs', 'exhibitionPrefs', 'nonWorkingDays', 'exhibitions'];
          const errorData = r.reason?.response?.data;
          const errorMsg = typeof errorData === 'string' ? errorData : JSON.stringify(errorData) || r.reason?.message;
          console.warn(`Admin: Failed to load ${names[i]}:`, errorMsg, 'URL:', r.reason?.config?.url);
        }
      });
      
      setNonWorkingDays(nonWorkingData);
      if (Array.isArray(exhibitionsData)) {
        setExhibitions(exhibitionsData);
      } else {
        setExhibitions([]);
      }
      
      // Debug logiranje
      console.log('Admin: guards count:', guardsData.length);
      console.log('Admin: workPeriods count:', workPeriodsData.length);
      console.log('Admin: dayPrefs count:', dayPrefsData.length);
      console.log('Admin: exhibitionPrefs count:', exhibitionPrefsData.length);
      console.log('Admin: settings.next_week_start:', settingsData.next_week_start);
      if (workPeriodsData.length > 0) {
        console.log('Admin: sample workPeriod:', JSON.stringify(workPeriodsData[0]));
      }
      
      // Kreiraj konfiguracije za sve čuvare koji imaju postavke
      const configs: GuardConfiguration[] = [];
      
      // Helper za izvlačenje guard ID-a (može biti number ili objekt)
      const getGuardId = (item: any) => {
        if (typeof item.guard === 'number') return item.guard;
        return item.guard?.id;
      };
      
      for (const guard of guardsData) {
        // Cast to any jer API vraća nested strukturu koja nije u GuardProfile type-u
        const guardAny = guard as any;
        
        // Provjeri ima li čuvar bilo kakve podatke za next_week
        // is_template ILI next_week_start odgovara
        const guardWorkPeriods = workPeriodsData.filter(
          wp => getGuardId(wp) === guardAny.id && 
                (wp.is_template || wp.next_week_start === settingsData.next_week_start)
        );
        
        const guardDayPrefs = dayPrefsData.find(
          dp => getGuardId(dp) === guardAny.id &&
                (dp.is_template || dp.next_week_start === settingsData.next_week_start)
        );
        
        const guardExhibitionPrefs = exhibitionPrefsData.find(
          ep => getGuardId(ep) === guardAny.id &&
                (ep.is_template || ep.next_week_start === settingsData.next_week_start)
        );
        
        // Dodaj samo ako ima barem nešto postavljeno
        if (guardAny.availability || guardWorkPeriods.length > 0 || guardDayPrefs || guardExhibitionPrefs) {
          // Debug log za guard data
          console.log('Admin: building config for guard:', {
            id: guardAny.id,
            username: guardAny.username,
            full_name: guardAny.full_name,
            user_username: guardAny.user?.username,
            user_full_name: guardAny.user?.full_name,
            rawGuard: JSON.stringify(guardAny)
          });
          
          // Izvuci podatke - mogu biti direktno na guard objektu ili u nested user objektu
          const username = guardAny.username || guardAny.user?.username;
          const fullName = guardAny.full_name || guardAny.user?.full_name;
          
          // Osiguraj da imamo ime - ako nema, koristi fallback
          const displayName = fullName?.trim() || username?.trim() || `Čuvar #${guardAny.id}`;
          const displayUsername = username?.trim() || `user_${guardAny.id}`;
          
          configs.push({
            guardId: guardAny.id,
            username: displayUsername,
            fullName: displayName,
            availability: guardAny.availability || null,
            workPeriods: guardWorkPeriods,
            dayPreferences: guardDayPrefs || null,
            exhibitionPreferences: guardExhibitionPrefs || null,
          });
        }
      }
      
      setGuardConfigurations(configs);
    } catch (error) {
      console.error('Error loading admin configuration data:', error);
      crossAlert('Greška', 'Nije moguće učitati podatke konfiguracija.');
    } finally {
      setLoading(false);
    }
  }, []);
  
  const loadData = useCallback(async () => {
    if (isAdmin) {
      await loadDataForAdmin();
    } else {
      await loadDataForGuard();
    }
  }, [isAdmin, loadDataForAdmin, loadDataForGuard]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // === LEVEL 1: Availability ===
  
  const handleSaveAvailability = async () => {
    if (!guardUser?.guard_profile?.id) return;
    
    const shifts = parseInt(availabilityInput, 10);
    if (isNaN(shifts) || shifts < 1) {
      crossAlert('Greška', 'Unesite validan broj smjena (minimalno 1).');
      return;
    }
    
    setSavingAvailability(true);
    try {
      const response = await setGuardAvailability(guardUser.guard_profile.id, { available_shifts: shifts });
      // Ažuriraj guardProfile - koristi response ako ima podatke
      setGuardProfile((prev: GuardProfile | null) => ({
        ...(prev || {} as GuardProfile),
        ...response,
        availability: response?.availability ?? shifts,
        availability_updated_at: response?.availability_updated_at ?? new Date().toISOString(),
      }));
      crossAlert('Uspjeh', 'Dostupnost je uspješno postavljena.');
    } catch (error: any) {
      console.error('Error saving availability:', error);
      // Izvuci detaljnu poruku sa servera
      const errorData = error.response?.data;
      let message = 'Nije moguće spremiti dostupnost.';
      if (errorData) {
        if (typeof errorData === 'string') {
          message = errorData;
        } else if (errorData.detail) {
          message = errorData.detail;
        } else if (errorData.error) {
          message = errorData.error;
        } else if (errorData.message) {
          message = errorData.message;
        } else if (errorData.non_field_errors) {
          message = Array.isArray(errorData.non_field_errors) 
            ? errorData.non_field_errors.join('\n') 
            : errorData.non_field_errors;
        } else {
          const errors = Object.entries(errorData)
            .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
            .join('\n');
          if (errors) message = errors;
        }
      }
      crossAlert('Greška', message);
    } finally {
      setSavingAvailability(false);
    }
  };
  
  // === LEVEL 2: Work Periods Modal ===
  
  const openWorkPeriodsModal = () => {
    // Inicijaliziraj s postojećim periodima
    const existingPeriods: SelectedPeriod[] = validWorkPeriods.map(wp => ({
      day_of_week: wp.day_of_week,
      shift_type: wp.shift_type,
    }));
    setSelectedPeriods(existingPeriods);
    setWorkPeriodsModalVisible(true);
  };
  
  const togglePeriod = (dayOfWeek: number, shiftType: 'morning' | 'afternoon') => {
    setSelectedPeriods(prev => {
      const exists = prev.some(
        p => p.day_of_week === dayOfWeek && p.shift_type === shiftType
      );
      
      if (exists) {
        return prev.filter(
          p => !(p.day_of_week === dayOfWeek && p.shift_type === shiftType)
        );
      } else {
        return [...prev, { day_of_week: dayOfWeek, shift_type: shiftType }];
      }
    });
  };
  
  const isPeriodSelected = (dayOfWeek: number, shiftType: 'morning' | 'afternoon'): boolean => {
    return selectedPeriods.some(
      p => p.day_of_week === dayOfWeek && p.shift_type === shiftType
    );
  };
  
  const handleSaveWorkPeriods = async () => {
    if (!guardUser?.guard_profile?.id || !settings) return;
    
    if ((selectedPeriods || []).length === 0) {
      crossAlert('Greška', 'Morate odabrati barem jedan radni period.');
      return;
    }
    
    setSavingWorkPeriods(true);
    const payload = {
      periods: selectedPeriods,
      save_for_future_weeks: saveWorkPeriodsForFuture,
    };
    console.log('Work periods payload:', JSON.stringify(payload));
    try {
      await setGuardWorkPeriods(guardUser.guard_profile.id, payload);
      // Lokalno ažuriraj work periods umjesto loadData
      const newWorkPeriods: GuardWorkPeriod[] = (selectedPeriods || []).map((p, idx) => ({
        id: Date.now() + idx, // Privremeni ID
        guard: guardUser.guard_profile.id,
        day_of_week: p.day_of_week,
        shift_type: p.shift_type,
        is_template: saveWorkPeriodsForFuture,
        next_week_start: settings.next_week_start,
        created_at: new Date().toISOString(),
      }));
      setWorkPeriods(newWorkPeriods);
      
      // Ažuriraj availableDays nakon spremanja work periods
      try {
        const availableDaysRaw: any = await getGuardAvailableDays(guardUser.guard_profile.id);
        console.log('Available days after save - raw response:', JSON.stringify(availableDaysRaw));
        let availableDaysData: number[] = [];
        if (Array.isArray(availableDaysRaw)) {
          availableDaysData = availableDaysRaw;
        } else if (availableDaysRaw && typeof availableDaysRaw === 'object') {
          if (Array.isArray(availableDaysRaw.days)) {
            availableDaysData = availableDaysRaw.days;
          } else if (Array.isArray(availableDaysRaw.available_days)) {
            availableDaysData = availableDaysRaw.available_days;
          } else if (Array.isArray(availableDaysRaw.day_of_week_list)) {
            availableDaysData = availableDaysRaw.day_of_week_list;
          }
        }
        console.log('Setting availableDays after save to:', availableDaysData);
        setAvailableDays(availableDaysData);
      } catch (err) {
        console.warn('Failed to refresh available days:', err);
      }
      
      // Re-fetch day preferences, exhibition preferences i izložbe jer backend briše
      // preferencije kad se work periods promijene, a dostupne izložbe ovise o radnim danima
      try {
        const [dayPrefsData, exhibitionPrefsData, exhibitionsData] = await Promise.all([
          getAllGuardDayPreferences(),
          getAllGuardExhibitionPreferences(),
          getExhibitionsNextWeek(),
        ]);
        const getGuardId = (item: any) => typeof item.guard === 'number' ? item.guard : item.guard?.id;
        const myDayPrefs = (Array.isArray(dayPrefsData) ? dayPrefsData : []).find(
          (dp: any) => getGuardId(dp) === guardUser.guard_profile.id &&
                       (dp.is_template || dp.next_week_start === settings.next_week_start)
        );
        setDayPreferences(myDayPrefs || null);
        const myExhibitionPrefs = (Array.isArray(exhibitionPrefsData) ? exhibitionPrefsData : []).find(
          (ep: any) => getGuardId(ep) === guardUser.guard_profile.id &&
                       (ep.is_template || ep.next_week_start === settings.next_week_start)
        );
        setExhibitionPreferences(myExhibitionPrefs || null);
        if (Array.isArray(exhibitionsData)) {
          setExhibitions(exhibitionsData);
        }
      } catch (err) {
        console.warn('Failed to refresh preferences after saving work periods:', err);
      }

      setWorkPeriodsModalVisible(false);
      crossAlert('Uspjeh', 'Radni periodi su uspješno postavljeni.');
    } catch (error: any) {
      console.error('Error saving work periods:', error);
      console.error('Response data:', JSON.stringify(error.response?.data));
      // Izvuci detaljnu poruku sa servera
      const errorData = error.response?.data;
      let message = 'Nije moguće spremiti radne periode.';
      if (errorData) {
        if (typeof errorData === 'string') {
          message = errorData;
        } else if (errorData.detail) {
          message = errorData.detail;
        } else if (errorData.error) {
          message = errorData.error;
        } else if (errorData.message) {
          message = errorData.message;
        } else if (errorData.non_field_errors) {
          message = Array.isArray(errorData.non_field_errors) 
            ? errorData.non_field_errors.join('\n') 
            : errorData.non_field_errors;
        } else {
          // Pokušaj izvući sve validation errors
          const errors = Object.entries(errorData)
            .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
            .join('\n');
          if (errors) message = errors;
        }
      }
      crossAlert('Greška', message);
    } finally {
      setSavingWorkPeriods(false);
    }
  };
  
  // === LEVEL 3: Day Preferences Modal ===
  
  const openDayPreferencesModal = () => {
    if (!settings) return;
    
    // Koristi availableDays iz API-ja (GET /api/guards/{id}/available_days/)
    // Osiguraj da je uvijek array
    console.log('Current availableDays state:', JSON.stringify(availableDays));
    const dayNumbers = Array.isArray(availableDays) ? availableDays : [];
    console.log('Parsed dayNumbers:', dayNumbers);
    
    if (dayNumbers.length === 0) {
      crossAlert('Upozorenje', 'Nema dostupnih dana za postavljanje preferencija. Prvo postavite radne periode.');
      return;
    }
    
    // Ako ima postojeće preferencije, koristi taj redoslijed
    if (dayPreferences?.day_order) {
      const existingOrder = (dayPreferences.day_order || []).filter(d => dayNumbers.includes(d));
      const missingDays = dayNumbers.filter(d => !existingOrder.includes(d));
      setOrderedDays([...existingOrder, ...missingDays]);
    } else {
      setOrderedDays(dayNumbers);
    }
    
    setDayPreferencesModalVisible(true);
  };
  
  const moveDayUp = (index: number) => {
    if (index === 0) return;
    setOrderedDays(prev => {
      const newOrder = [...prev];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      return newOrder;
    });
  };
  
  const moveDayDown = (index: number) => {
    if (index === (orderedDays || []).length - 1) return;
    setOrderedDays(prev => {
      const newOrder = [...prev];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      return newOrder;
    });
  };
  
  const handleSaveDayPreferences = async () => {
    if (!guardUser?.guard_profile?.id || !settings) return;
    
    if ((orderedDays || []).length === 0) {
      crossAlert('Greška', 'Nema dana za spremanje.');
      return;
    }
    
    setSavingDayPrefs(true);
    try {
      await setGuardDayPreferences(guardUser.guard_profile.id, {
        day_of_week_list: orderedDays,
        save_as_template: saveDayPrefsAsTemplate,
      });
      // Lokalno ažuriraj day preferences
      setDayPreferences({
        id: Date.now(),
        guard: guardUser.guard_profile,
        day_order: orderedDays,
        is_template: saveDayPrefsAsTemplate,
        next_week_start: settings.next_week_start,
        created_at: new Date().toISOString(),
      });
      setDayPreferencesModalVisible(false);
      crossAlert('Uspjeh', 'Preferencije za dane su uspješno postavljene.');
    } catch (error: any) {
      console.error('Error saving day preferences:', error);
      // Izvuci detaljnu poruku sa servera
      const errorData = error.response?.data;
      let message = 'Nije moguće spremiti preferencije.';
      if (errorData) {
        if (typeof errorData === 'string') {
          message = errorData;
        } else if (errorData.detail) {
          message = errorData.detail;
        } else if (errorData.error) {
          message = errorData.error;
        } else if (errorData.message) {
          message = errorData.message;
        } else if (errorData.non_field_errors) {
          message = Array.isArray(errorData.non_field_errors) 
            ? errorData.non_field_errors.join('\n') 
            : errorData.non_field_errors;
        } else {
          const errors = Object.entries(errorData)
            .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
            .join('\n');
          if (errors) message = errors;
        }
      }
      crossAlert('Greška', message);
    } finally {
      setSavingDayPrefs(false);
    }
  };
  
  // === LEVEL 3: Exhibition Preferences Modal ===
  
  const openExhibitionPreferencesModal = () => {
    const activeExhibitionIds = (exhibitions || []).map(e => e.id);
    
    // Ako ima postojeće preferencije, koristi taj redoslijed
    if (exhibitionPreferences?.exhibition_order) {
      const existingOrder = (exhibitionPreferences.exhibition_order || []).filter(
        id => activeExhibitionIds.includes(id)
      );
      const missingIds = activeExhibitionIds.filter(id => !existingOrder.includes(id));
      setOrderedExhibitions([...existingOrder, ...missingIds]);
    } else {
      setOrderedExhibitions(activeExhibitionIds);
    }
    
    setExhibitionPreferencesModalVisible(true);
  };
  
  const moveExhibitionUp = (index: number) => {
    if (index === 0) return;
    setOrderedExhibitions(prev => {
      const newOrder = [...prev];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      return newOrder;
    });
  };
  
  const moveExhibitionDown = (index: number) => {
    if (index === (orderedExhibitions || []).length - 1) return;
    setOrderedExhibitions(prev => {
      const newOrder = [...prev];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      return newOrder;
    });
  };
  
  const handleSaveExhibitionPreferences = async () => {
    if (!guardUser?.guard_profile?.id || !settings) return;
    
    if ((orderedExhibitions || []).length === 0) {
      crossAlert('Greška', 'Nema izložbi za spremanje.');
      return;
    }
    
    setSavingExhibitionPrefs(true);
    try {
      await setGuardExhibitionPreferences(guardUser.guard_profile.id, {
        exhibition_ids: orderedExhibitions,
        save_as_template: saveExhibitionPrefsAsTemplate,
      });
      // Lokalno ažuriraj exhibition preferences
      setExhibitionPreferences({
        id: Date.now(),
        guard: guardUser.guard_profile,
        exhibition_order: orderedExhibitions,
        is_template: saveExhibitionPrefsAsTemplate,
        next_week_start: settings.next_week_start,
        created_at: new Date().toISOString(),
      });
      setExhibitionPreferencesModalVisible(false);
      crossAlert('Uspjeh', 'Preferencije za izložbe su uspješno postavljene.');
    } catch (error: any) {
      console.error('Error saving exhibition preferences:', error);
      // Izvuci detaljnu poruku sa servera
      const errorData = error.response?.data;
      let message = 'Nije moguće spremiti preferencije.';
      if (errorData) {
        if (typeof errorData === 'string') {
          message = errorData;
        } else if (errorData.detail) {
          message = errorData.detail;
        } else if (errorData.error) {
          message = errorData.error;
        } else if (errorData.message) {
          message = errorData.message;
        } else if (errorData.non_field_errors) {
          message = Array.isArray(errorData.non_field_errors) 
            ? errorData.non_field_errors.join('\n') 
            : errorData.non_field_errors;
        } else {
          const errors = Object.entries(errorData)
            .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
            .join('\n');
          if (errors) message = errors;
        }
      }
      crossAlert('Greška', message);
    } finally {
      setSavingExhibitionPrefs(false);
    }
  };
  
  // === RENDER HELPERS ===
  
  const renderStars = (index: number, total: number): string => {
    // Indeks 0 ima najviše zvjezdica (total), zadnji ima 1
    return '★'.repeat(total - index);
  };
  
  const getExhibitionName = (id: number): string => {
    const exhibition = (exhibitions || []).find(e => e.id === id);
    return exhibition?.name || `Izložba ${id}`;
  };
  
  // === ADMIN HELPERS ===
  
  const toggleGuardExpanded = (guardId: number) => {
    setExpandedGuards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(guardId)) {
        newSet.delete(guardId);
      } else {
        newSet.add(guardId);
      }
      return newSet;
    });
  };
  
  const renderGuardConfiguration = (config: GuardConfiguration) => {
    const isExpanded = expandedGuards.has(config.guardId);
    
    return (
      <View key={config.guardId} style={styles.guardCard}>
        <TouchableOpacity 
          style={styles.guardCardHeader}
          onPress={() => toggleGuardExpanded(config.guardId)}
        >
          <View style={styles.guardCardHeaderContent}>
            <Text style={styles.guardCardName}>{config.fullName}</Text>
            <Text style={styles.guardCardUsername}>@{config.username}</Text>
          </View>
          <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.guardCardContent}>
            {/* Dostupnost */}
            <View style={styles.adminConfigSection}>
              <Text style={styles.adminSectionTitle}>Dostupnost</Text>
              {config.availability ? (
                <Text style={styles.adminSectionValue}>{config.availability} smjena</Text>
              ) : (
                <Text style={styles.adminSectionEmpty}>Nije postavljeno</Text>
              )}
            </View>
            
            {/* Radni periodi */}
            <View style={styles.adminConfigSection}>
              <Text style={styles.adminSectionTitle}>Radni periodi</Text>
              {(config.workPeriods || []).length > 0 ? (
                <View style={styles.adminPeriodsGrid}>
                  {(() => {
                    const dayNames = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
                    const workdays = settings?.workdays || [];
                    const allDays = [...workdays].sort((a, b) => a - b);
                    
                    // Map odabranih perioda
                    const periodsMap = new Map();
                    config.workPeriods.forEach(wp => {
                      if (!periodsMap.has(wp.day_of_week)) {
                        periodsMap.set(wp.day_of_week, { morning: false, afternoon: false });
                      }
                      const dayData = periodsMap.get(wp.day_of_week);
                      if (wp.shift_type === 'morning') dayData.morning = true;
                      if (wp.shift_type === 'afternoon') dayData.afternoon = true;
                    });
                    
                    // Map neradnih dana
                    const nonWorkingShiftsMap = new Map();
                    if (settings && nonWorkingDays) {
                      const nextWeekStart = new Date(settings.next_week_start);
                      nonWorkingDays.forEach(nwd => {
                        const nwdDate = new Date(nwd.date);
                        const diffDays = Math.round((nwdDate.getTime() - nextWeekStart.getTime()) / (1000 * 60 * 60 * 24));
                        if (diffDays >= 0 && diffDays < 7) {
                          if (nwd.is_full_day) {
                            nonWorkingShiftsMap.set(diffDays, { morning: true, afternoon: true, fullDay: true });
                          } else {
                            if (!nonWorkingShiftsMap.has(diffDays)) {
                              nonWorkingShiftsMap.set(diffDays, { morning: false, afternoon: false, fullDay: false });
                            }
                            const existing = nonWorkingShiftsMap.get(diffDays);
                            if (nwd.non_working_shift === 'MORNING') existing.morning = true;
                            if (nwd.non_working_shift === 'AFTERNOON') existing.afternoon = true;
                          }
                        }
                      });
                    }
                    
                    return allDays.map(day => {
                      const isWorkday = workdays.includes(day);
                      const nonWorking = nonWorkingShiftsMap.get(day);
                      const isFullDayNonWorking = nonWorking?.fullDay;
                      
                      if (!isWorkday || isFullDayNonWorking) {
                        return (
                          <View key={day} style={styles.adminPeriodDayColumn}>
                            <Text style={[styles.adminPeriodDayName, styles.adminPeriodDayNameInactive]}>{dayNames[day]}</Text>
                          </View>
                        );
                      }
                      
                      const dayData = periodsMap.get(day) || { morning: false, afternoon: false };
                      const morningNonWorking = nonWorking?.morning;
                      const afternoonNonWorking = nonWorking?.afternoon;
                      
                      return (
                        <View key={day} style={styles.adminPeriodDayColumn}>
                          <Text style={styles.adminPeriodDayName}>{dayNames[day]}</Text>
                          {morningNonWorking ? null : (
                            <View style={[
                              styles.adminPeriodBox,
                              dayData.morning ? styles.adminPeriodBoxActive : styles.adminPeriodBoxInactive
                            ]} />
                          )}
                          {afternoonNonWorking ? null : (
                            <View style={[
                              styles.adminPeriodBox,
                              dayData.afternoon ? styles.adminPeriodBoxActive : styles.adminPeriodBoxInactive
                            ]} />
                          )}
                        </View>
                      );
                    });
                  })()}
                </View>
              ) : (
                <Text style={styles.adminSectionEmpty}>Nije postavljeno</Text>
              )}
            </View>
            
            {/* Preferencije za dane */}
            <View style={styles.adminConfigSection}>
              <Text style={styles.adminSectionTitle}>Preferencije za dane</Text>
              {config.dayPreferences?.day_order && (config.dayPreferences.day_order || []).length > 0 ? (
                (config.dayPreferences.day_order || []).map((day, idx) => (
                  <View key={day} style={styles.adminPrefItem}>
                    <Text style={styles.adminPrefStars}>
                      {renderStars(idx, (config.dayPreferences?.day_order || []).length)}
                    </Text>
                    <Text style={styles.adminPrefText}>{getDayName(day)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.adminSectionEmpty}>Nije postavljeno</Text>
              )}
            </View>
            
            {/* Preferencije za izložbe */}
            <View style={styles.adminConfigSection}>
              <Text style={styles.adminSectionTitle}>Preferencije za izložbe</Text>
              {(() => {
                const exhibitionOrder = config.exhibitionPreferences?.exhibition_order || [];
                const currentIds = (exhibitions || []).map(e => e.id);
                const isStale = currentIds.some(id => !exhibitionOrder.includes(id));
                const filteredOrder = exhibitionOrder.filter(id => currentIds.includes(id));
                if (isStale || filteredOrder.length === 0) {
                  return <Text style={styles.adminSectionEmpty}>Nije postavljeno</Text>;
                }
                return filteredOrder.map((exId, idx) => (
                  <View key={exId} style={styles.adminPrefItem}>
                    <Text style={styles.adminPrefStars}>{renderStars(idx, filteredOrder.length)}</Text>
                    <Text style={styles.adminPrefText}>{getExhibitionName(exId)}</Text>
                  </View>
                ));
              })()}
            </View>
          </View>
        )}
      </View>
    );
  };
  
  // === MAIN RENDER ===
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A3323" />
        <Text style={styles.loadingText}>Učitavanje...</Text>
      </View>
    );
  }
  
  // Admin view
  if (isAdmin) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Pregled konfiguracija čuvara</Text>
          
          {settings && (
            <Text style={styles.weekInfo}>
              Za period: {formatDate(settings.next_week_start)} - {formatDate(settings.next_week_end)}
            </Text>
          )}
          
          {(guardConfigurations || []).length > 0 ? (
            <View style={styles.guardsContainer}>
              {(guardConfigurations || []).map(renderGuardConfiguration)}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Nema postavljenih konfiguracija za sljedeći tjedan.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }
  
  // Guard view
  if (!guardUser?.guard_profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Nemate pristup konfiguraciji.</Text>
      </View>
    );
  }

  const nextWeekDays = settings ? generateNextWeekDays(settings, nonWorkingDays) : [];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Konfiguracija za sljedeći tjedan</Text>
        
        {settings && (
          <Text style={styles.weekInfo}>
            {formatDate(settings.next_week_start)} - {formatDate(settings.next_week_end)}
          </Text>
        )}
        
        {/* Config period indicator */}
        <View style={[styles.periodIndicator, isConfigPeriod ? styles.periodActive : styles.periodInactive]}>
          <Text style={styles.periodText}>
            {isConfigPeriod 
              ? '✅ Konfiguracijski period je aktivan' 
              : `⏳ Konfiguracijski period: ${settings ? formatConfigPeriod(settings) : '...'}`}
          </Text>
        </View>
        
        {/* === LEVEL 1: Availability === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Dostupnost</Text>
          <Text style={styles.sectionDescription}>
            Koliko smjena možete raditi sljedeći tjedan?
          </Text>
          
          {/* Availability status indicator */}
          {(hasAvailability || isConfigPeriod) && (
            <View style={[
              styles.availabilityStatus,
              isAvailabilityUpdatedThisWeek ? styles.availabilityStatusGreen : styles.availabilityStatusRed
            ]}>
              <Text style={styles.availabilityStatusText}>
                {isAvailabilityUpdatedThisWeek 
                  ? '✅ Dostupnost ažurirana u ovom ciklusu'
                  : '⚠️ Potrebno je ažurirati dostupnost'
                }
              </Text>
            </View>
          )}
          
          <View style={styles.availabilityRow}>
            <TextInput
              style={styles.availabilityInput}
              value={availabilityInput}
              onChangeText={setAvailabilityInput}
              keyboardType="number-pad"
              placeholder="Broj smjena"
              editable={true}
            />
            <TouchableOpacity
              style={[styles.saveButton, !isConfigPeriod && styles.buttonDisabled]}
              onPress={handleSaveAvailability}
              disabled={!isConfigPeriod || savingAvailability}
            >
              {savingAvailability ? (
                <ActivityIndicator color="#A6C27A" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {hasAvailability ? 'Ažuriraj' : 'Spremi'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          
          {hasAvailability && (
            <Text style={styles.currentValue}>
              Trenutno postavljeno: {guardProfile?.availability} smjena
            </Text>
          )}
        </View>
        
        {/* === LEVEL 2: Work Periods === */}
        {hasAvailability && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Radni periodi</Text>
            <Text style={styles.sectionDescription}>
              Odaberite dane i smjene kada možete raditi.
            </Text>
            
            {hasWorkPeriods ? (
              <>
                <View style={styles.currentPeriodsCard}>
                  <Text style={styles.cardLabel}>Trenutno postavljeni periodi:</Text>
                  <View style={styles.periodsGrid}>
                    {(() => {
                      // Grupiraj periods po danima
                      const dayNames = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
                      const workdays = settings?.workdays || [];
                      const allDays = [...workdays].sort((a, b) => a - b); // Samo radni dani, sortirani
                      
                      // Map odabranih perioda
                      const periodsMap = new Map();
                      validWorkPeriods.forEach(wp => {
                        if (!periodsMap.has(wp.day_of_week)) {
                          periodsMap.set(wp.day_of_week, { morning: false, afternoon: false });
                        }
                        const dayData = periodsMap.get(wp.day_of_week);
                        if (wp.shift_type === 'morning') dayData.morning = true;
                        if (wp.shift_type === 'afternoon') dayData.afternoon = true;
                      });
                      
                      // Map neradnih dana (po datumu) - pretvorimo u day_of_week
                      const nonWorkingShiftsMap = new Map(); // day_of_week -> { morning: boolean, afternoon: boolean }
                      if (settings && nonWorkingDays) {
                        const nextWeekStart = new Date(settings.next_week_start);
                        nonWorkingDays.forEach(nwd => {
                          const nwdDate = new Date(nwd.date);
                          const diffDays = Math.round((nwdDate.getTime() - nextWeekStart.getTime()) / (1000 * 60 * 60 * 24));
                          if (diffDays >= 0 && diffDays < 7) {
                            if (nwd.is_full_day) {
                              nonWorkingShiftsMap.set(diffDays, { morning: true, afternoon: true, fullDay: true });
                            } else {
                              if (!nonWorkingShiftsMap.has(diffDays)) {
                                nonWorkingShiftsMap.set(diffDays, { morning: false, afternoon: false, fullDay: false });
                              }
                              const existing = nonWorkingShiftsMap.get(diffDays);
                              if (nwd.non_working_shift === 'MORNING') existing.morning = true;
                              if (nwd.non_working_shift === 'AFTERNOON') existing.afternoon = true;
                            }
                          }
                        });
                      }
                      
                      return (
                        <View style={styles.periodsGridContainer}>
                          {allDays.map(day => {
                            // Provjeri je li radni dan
                            const isWorkday = workdays.includes(day);
                            const nonWorking = nonWorkingShiftsMap.get(day);
                            const isFullDayNonWorking = nonWorking?.fullDay;
                            
                            // Ako nije radni dan ili je cijeli dan neradni - ne prikazuj kockice
                            if (!isWorkday || isFullDayNonWorking) {
                              return (
                                <View key={day} style={styles.periodDayColumn}>
                                  <Text style={[styles.periodDayName, styles.periodDayNameInactive]}>{dayNames[day]}</Text>
                                </View>
                              );
                            }
                            
                            const dayData = periodsMap.get(day) || { morning: false, afternoon: false };
                            const morningNonWorking = nonWorking?.morning;
                            const afternoonNonWorking = nonWorking?.afternoon;
                            
                            return (
                              <View key={day} style={styles.periodDayColumn}>
                                <Text style={styles.periodDayName}>{dayNames[day]}</Text>
                                {/* Jutarnja smjena */}
                                {morningNonWorking ? null : (
                                  <View style={[
                                    styles.periodBox,
                                    dayData.morning ? styles.periodBoxActive : styles.periodBoxInactive
                                  ]} />
                                )}
                                {/* Popodnevna smjena */}
                                {afternoonNonWorking ? null : (
                                  <View style={[
                                    styles.periodBox,
                                    dayData.afternoon ? styles.periodBoxActive : styles.periodBoxInactive
                                  ]} />
                                )}
                              </View>
                            );
                          })}
                        </View>
                      );
                    })()}
                  </View>
                </View>
                
                <TouchableOpacity
                  style={[styles.actionButton, !isConfigPeriod && styles.buttonDisabled]}
                  onPress={openWorkPeriodsModal}
                  disabled={!isConfigPeriod}
                >
                  <Text style={styles.actionButtonText}>Promijeni radne periode</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, !isConfigPeriod && styles.buttonDisabled]}
                onPress={openWorkPeriodsModal}
                disabled={!isConfigPeriod}
              >
                <Text style={styles.actionButtonText}>Odredi dostupne periode</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* === LEVEL 3: Preferences === */}
        {hasAvailability && hasWorkPeriods && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Preferencije</Text>
            <Text style={styles.sectionDescription}>
              Poredajte dane i izložbe po vašim preferencijama.
            </Text>
            
            {/* Current preferences display */}
            <View style={styles.preferencesRow}>
              {/* Day preferences card */}
              <View style={styles.preferenceCard}>
                <Text style={styles.cardTitle}>Dani</Text>
                {dayPreferences?.day_order && (dayPreferences.day_order || []).length > 0 ? (
                  (dayPreferences.day_order || []).map((day, idx) => (
                    <View key={day} style={styles.preferenceItem}>
                      <Text style={styles.preferenceStars}>{renderStars(idx, (dayPreferences?.day_order || []).length)}</Text>
                      <Text style={styles.preferenceName}>{getDayName(day)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noPreferences}>Nije postavljeno</Text>
                )}
              </View>
              
              {/* Exhibition preferences card */}
              <View style={styles.preferenceCard}>
                <Text style={styles.cardTitle}>Izložbe</Text>
                {(() => {
                  const exhibitionOrder = exhibitionPreferences?.exhibition_order || [];
                  const currentIds = (exhibitions || []).map(e => e.id);
                  const isStale = currentIds.some(id => !exhibitionOrder.includes(id));
                  const filteredOrder = exhibitionOrder.filter(id => currentIds.includes(id));
                  if (isStale || filteredOrder.length === 0) {
                    return <Text style={styles.noPreferences}>Nije postavljeno</Text>;
                  }
                  return filteredOrder.map((exId, idx) => (
                    <View key={exId} style={styles.preferenceItem}>
                      <Text style={styles.preferenceStars}>{renderStars(idx, filteredOrder.length)}</Text>
                      <Text style={styles.preferenceName} numberOfLines={1}>{getExhibitionName(exId)}</Text>
                    </View>
                  ));
                })()}
              </View>
            </View>
            
            {/* Preference buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.prefButton, !isConfigPeriod && styles.buttonDisabled]}
                onPress={openDayPreferencesModal}
                disabled={!isConfigPeriod}
              >
                <Text style={styles.prefButtonText}>Preferencije za dane</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.prefButton, !isConfigPeriod && styles.buttonDisabled]}
                onPress={openExhibitionPreferencesModal}
                disabled={!isConfigPeriod}
              >
                <Text style={styles.prefButtonText}>Preferencije za izložbe</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
      
      {/* === WORK PERIODS MODAL === */}
      <Modal
        visible={workPeriodsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setWorkPeriodsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setWorkPeriodsModalVisible(false)}>
              <Text style={styles.modalCancel}>Odustani</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Radni periodi</Text>
            <TouchableOpacity onPress={handleSaveWorkPeriods} disabled={savingWorkPeriods}>
              {savingWorkPeriods ? (
                <ActivityIndicator size="small" color="#0A3323" />
              ) : (
                <Text style={styles.modalSave}>Potvrdi</Text>
              )}
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Odaberite smjene kada ste dostupni za rad:
            </Text>
            
            <View style={styles.daysGrid}>
              {nextWeekDays.map(day => (
                <View key={day.date} style={styles.dayCard}>
                  <Text style={styles.dayHeader}>{day.label}</Text>
                  
                  {/* Morning shift */}
                  {day.morningAvailable ? (
                    <TouchableOpacity
                      style={[
                        styles.shiftButton,
                        isPeriodSelected(day.dayOfWeek, 'morning') && styles.shiftButtonSelected
                      ]}
                      onPress={() => togglePeriod(day.dayOfWeek, 'morning')}
                    >
                      <Text style={[
                        styles.shiftButtonText,
                        isPeriodSelected(day.dayOfWeek, 'morning') && styles.shiftButtonTextSelected
                      ]}>
                        Jutarnja smjena
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.shiftUnavailable}>
                      <Text style={styles.shiftUnavailableText}>{day.morningReason || 'Nedostupno'}</Text>
                    </View>
                  )}
                  
                  {/* Afternoon shift */}
                  {day.afternoonAvailable ? (
                    <TouchableOpacity
                      style={[
                        styles.shiftButton,
                        isPeriodSelected(day.dayOfWeek, 'afternoon') && styles.shiftButtonSelected
                      ]}
                      onPress={() => togglePeriod(day.dayOfWeek, 'afternoon')}
                    >
                      <Text style={[
                        styles.shiftButtonText,
                        isPeriodSelected(day.dayOfWeek, 'afternoon') && styles.shiftButtonTextSelected
                      ]}>
                        Popodnevna smjena
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.shiftUnavailable}>
                      <Text style={styles.shiftUnavailableText}>{day.afternoonReason || 'Nedostupno'}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
            
            {/* Checkbox za spremanje za buduće tjedne */}
            <View style={styles.checkboxRow}>
              <Switch
                value={saveWorkPeriodsForFuture}
                onValueChange={setSaveWorkPeriodsForFuture}
                trackColor={{ false: '#ccc', true: '#4caf50' }}
                thumbColor={saveWorkPeriodsForFuture ? '#fff' : '#f4f3f4'}
              />
              <Text style={styles.checkboxLabel}>Spremi za buduće tjedne</Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
      
      {/* === DAY PREFERENCES MODAL === */}
      <Modal
        visible={dayPreferencesModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDayPreferencesModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setDayPreferencesModalVisible(false)}>
              <Text style={styles.modalCancel}>Odustani</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Preferencije za dane</Text>
            <TouchableOpacity onPress={handleSaveDayPreferences} disabled={savingDayPrefs}>
              {savingDayPrefs ? (
                <ActivityIndicator size="small" color="#0A3323" />
              ) : (
                <Text style={styles.modalSave}>Potvrdi</Text>
              )}
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Poredajte dane po prioritetu (najpreferaniji na vrhu):
            </Text>
            
            {(orderedDays || []).map((day, index) => (
              <View key={day} style={styles.dragItem}>
                <View style={styles.dragItemContent}>
                  <Text style={styles.dragItemRank}>#{index + 1}</Text>
                  <Text style={styles.dragItemText}>{getDayName(day)}</Text>
                </View>
                <View style={styles.dragItemButtons}>
                  <TouchableOpacity
                    style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}
                    onPress={() => moveDayUp(index)}
                    disabled={index === 0}
                  >
                    <Text style={styles.moveButtonText}>▲</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.moveButton, index === (orderedDays || []).length - 1 && styles.moveButtonDisabled]}
                    onPress={() => moveDayDown(index)}
                    disabled={index === (orderedDays || []).length - 1}
                  >
                    <Text style={styles.moveButtonText}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            
            {/* Checkbox za spremanje kao template */}
            <View style={styles.checkboxRow}>
              <Switch
                value={saveDayPrefsAsTemplate}
                onValueChange={setSaveDayPrefsAsTemplate}
                trackColor={{ false: '#ccc', true: '#4caf50' }}
                thumbColor={saveDayPrefsAsTemplate ? '#fff' : '#f4f3f4'}
              />
              <Text style={styles.checkboxLabel}>Spremi za buduće tjedne</Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
      
      {/* === EXHIBITION PREFERENCES MODAL === */}
      <Modal
        visible={exhibitionPreferencesModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setExhibitionPreferencesModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setExhibitionPreferencesModalVisible(false)}>
              <Text style={styles.modalCancel}>Odustani</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Preferencije za izložbe</Text>
            <TouchableOpacity onPress={handleSaveExhibitionPreferences} disabled={savingExhibitionPrefs}>
              {savingExhibitionPrefs ? (
                <ActivityIndicator size="small" color="#0A3323" />
              ) : (
                <Text style={styles.modalSave}>Potvrdi</Text>
              )}
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Poredajte izložbe po prioritetu (najpreferanija na vrhu):
            </Text>
            
            {(orderedExhibitions || []).map((exId, index) => (
              <View key={exId} style={styles.dragItem}>
                <View style={styles.dragItemContent}>
                  <Text style={styles.dragItemRank}>#{index + 1}</Text>
                  <Text style={styles.dragItemText} numberOfLines={1}>{getExhibitionName(exId)}</Text>
                </View>
                <View style={styles.dragItemButtons}>
                  <TouchableOpacity
                    style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}
                    onPress={() => moveExhibitionUp(index)}
                    disabled={index === 0}
                  >
                    <Text style={styles.moveButtonText}>▲</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.moveButton, index === (orderedExhibitions || []).length - 1 && styles.moveButtonDisabled]}
                    onPress={() => moveExhibitionDown(index)}
                    disabled={index === (orderedExhibitions || []).length - 1}
                  >
                    <Text style={styles.moveButtonText}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            
            {/* Checkbox za spremanje kao template */}
            <View style={styles.checkboxRow}>
              <Switch
                value={saveExhibitionPrefsAsTemplate}
                onValueChange={setSaveExhibitionPrefsAsTemplate}
                trackColor={{ false: '#ccc', true: '#4caf50' }}
                thumbColor={saveExhibitionPrefsAsTemplate ? '#fff' : '#f4f3f4'}
              />
              <Text style={styles.checkboxLabel}>Spremi za buduće tjedne</Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4D5',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F4D5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#0A3323',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0A3323',
    marginBottom: 8,
  },
  weekInfo: {
    fontSize: 16,
    color: '#0A3323',
    marginBottom: 16,
    fontWeight: '600'
  },
  periodIndicator: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  periodActive: {
    backgroundColor: '#A6C27A',
  },
  periodInactive: {
    backgroundColor: '#D3968C',
  },
  periodText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#D3968C',
    textAlign: 'center',
    marginTop: 40,
  },
  section: {
    backgroundColor: '#A6C27A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0A3323',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#0A3323',
    marginBottom: 16,
  },
  availabilityStatus: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  availabilityStatusGreen: {
    backgroundColor: '#A6C27A',
  },
  availabilityStatusRed: {
    backgroundColor: '#D3968C',
  },
  availabilityStatusText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  availabilityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  availabilityInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#A6C27A',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F7F4D5',
  },
  saveButton: {
    backgroundColor: '#0A3323',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 80,
  },
  saveButtonText: {
    color: '#A6C27A',
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#0A3323',
  },
  currentValue: {
    fontSize: 13,
    color: '#0A3323',
    marginTop: 8,
    fontStyle: 'italic',
  },
  currentPeriodsCard: {
    backgroundColor: '#105666',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F7F4D5',
    marginBottom: 8,
  },
  periodItem: {
    fontSize: 14,
    color: '#F7F4D5',
    marginBottom: 4,
  },
  periodsGrid: {
    marginTop: 8,
  },
  periodsGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  periodDayColumn: {
    alignItems: 'center',
    width: 40,
  },
  periodDayName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F7F4D5',
    marginBottom: 4,
  },
  periodBox: {
    width: 32,
    height: 16,
    borderRadius: 4,
    backgroundColor: '#D3968C',
    marginBottom: 3,
  },
  periodBoxActive: {
    backgroundColor: '#A6C27A',
  },
  periodBoxInactive: {
    backgroundColor: '#D3968C',
  },
  periodDayNameInactive: {
    color: '#D3968C',
  },
  actionButton: {
    backgroundColor: '#0A3323',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#A6C27A',
    fontWeight: '600',
    fontSize: 15,
  },
  preferencesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  preferenceCard: {
    flex: 1,
    backgroundColor: '#105666',
    borderRadius: 8,
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F7F4D5',
    marginBottom: 8,
    textAlign: 'center',
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  preferenceStars: {
    fontSize: 10,
    color: '#F7F4D5',
    marginRight: 6,
    minWidth: 30,
  },
  preferenceName: {
    fontSize: 12,
    color: '#F7F4D5',
    flex: 1,
  },
  noPreferences: {
    fontSize: 12,
    color: '#D3968C',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  prefButton: {
    flex: 1,
    backgroundColor: '#0A3323',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  prefButtonText: {
    color: '#A6C27A',
    fontWeight: '600',
    fontSize: 13,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F7F4D5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#0A3323',
    borderBottomWidth: 1,
    borderBottomColor: '#A6C27A',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#A6C27A',
  },
  modalCancel: {
    fontSize: 16,
    color: '#A6C27A',
  },
  modalSave: {
    fontSize: 16,
    color: '#A6C27A',
    fontWeight: '600',
  },
  modalContent: {
    padding: 16,
  },
  modalDescription: {
    fontSize: 14,
    color: '#0A3323',
    marginBottom: 16,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dayCard: {
    width: '48%',
    backgroundColor: '#A6C27A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
  },
  dayHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0A3323',
    marginBottom: 10,
    textAlign: 'center',
  },
  shiftButton: {
    backgroundColor: '#105666',
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  shiftButtonSelected: {
    backgroundColor: '#A6C27A',
    borderColor: '#F7F4D5',
  },
  shiftButtonText: {
    fontSize: 12,
    color: '#F7F4D5',
    textAlign: 'center',
  },
  shiftButtonTextSelected: {
    color: '#0A3323',
    fontWeight: '600',
  },
  shiftUnavailable: {
    backgroundColor: '#A6C27A',
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
  },
  shiftUnavailableText: {
    fontSize: 12,
    color: '#0A3323',
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '600',
  },
  dragItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#A6C27A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  dragItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dragItemRank: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0A3323',
    marginRight: 12,
    minWidth: 30,
  },
  dragItemText: {
    fontSize: 15,
    color: '#0A3323',
    flex: 1,
  },
  dragItemButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  moveButton: {
    backgroundColor: '#A6C27A',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moveButtonDisabled: {
    backgroundColor: '#D3968C',
  },
  moveButtonText: {
    color: '#0A3323',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Admin view styles
  guardsContainer: {
    marginTop: 16,
  },
  guardCard: {
    backgroundColor: '#A6C27A',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  guardCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#A6C27A',
    borderBottomWidth: 1,
    borderBottomColor: '#A6C27A',
  },
  guardCardHeaderContent: {
    flex: 1,
  },
  guardCardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#105666',
    marginBottom: 2,
  },
  guardCardUsername: {
    fontSize: 15,
    color: '#105666',
    fontWeight: '600'
  },
  expandIcon: {
    fontSize: 16,
    color: '#F7F4D5',
    marginLeft: 8,
  },
  guardCardContent: {
    padding: 16,
  },
  adminConfigSection: {
    marginBottom: 16,
  },
  adminSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0A3323',
    marginBottom: 8,
  },
  adminSectionValue: {
    fontSize: 14,
    color: '#0A3323',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  adminSectionEmpty: {
    fontSize: 13,
    color: '#F7F4D5',
    fontStyle: 'italic',
    fontWeight: '600',
  },
  adminSectionItem: {
    fontSize: 13,
    color: '#F7F4D5',
    marginBottom: 4,
  },
  adminPeriodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  adminPeriodDayColumn: {
    alignItems: 'center',
    width: 36,
  },
  adminPeriodDayName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0A3323',
    marginBottom: 3,
  },
  adminPeriodDayNameInactive: {
    color: '#F7F4D5',
  },
  adminPeriodBox: {
    width: 28,
    height: 14,
    borderRadius: 3,
    marginBottom: 2,
  },
  adminPeriodBoxActive: {
    backgroundColor: '#105666',
  },
  adminPeriodBoxInactive: {
    backgroundColor: '#D3968C',
  },
  adminPrefItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  adminPrefStars: {
    fontSize: 10,
    color: '#105666',
    marginRight: 8,
    minWidth: 30,
  },
  adminPrefText: {
    fontSize: 13,
    color: '#0A3323',
    flex: 1,
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    color: '#0A3323',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#105666',
    borderRadius: 8,
  },
  checkboxLabel: {
    marginLeft: 12,
    fontSize: 14,
    color: '#F7F4D5',
  },
});
