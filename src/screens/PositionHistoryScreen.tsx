import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '../store/authStore';
import {
  getMonthlySnapshot,
  getMyWorkHistory,
  getMonthlyEarningsSummary,
  createPositionHistoryManual,
  getCurrentSystemSettings,
  getGuards,
  getExhibitions,
  createPosition,
  deletePosition,
} from '../api/endpoints';
import {
  MonthlySnapshot,
  MonthlySnapshotPosition,
  GuardWorkHistoryResponse,
  MonthlyEarningsSummaryResponse,
  MonthlyEarningsGuard,
  SystemSettings,
  GuardProfile,
  Exhibition,
} from '../types';
import {
  groupPositionsByDate,
  groupPositionsByShift,
  separateSpecialEvents,
  formatDateWithDay,
  sortPositions,
  getAllDatesInWeek,
  isWorkingDay,
} from '../utils/scheduleHelpers';

// Mjeseci na hrvatskom
const MONTHS = [
  { value: 1, label: 'Siječanj' },
  { value: 2, label: 'Veljača' },
  { value: 3, label: 'Ožujak' },
  { value: 4, label: 'Travanj' },
  { value: 5, label: 'Svibanj' },
  { value: 6, label: 'Lipanj' },
  { value: 7, label: 'Srpanj' },
  { value: 8, label: 'Kolovoz' },
  { value: 9, label: 'Rujan' },
  { value: 10, label: 'Listopad' },
  { value: 11, label: 'Studeni' },
  { value: 12, label: 'Prosinac' },
];

// Generiraj godine (trenutna godina +/- 2)
const generateYears = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear - 2; y <= currentYear + 1; y++) {
    years.push({ value: y, label: y.toString() });
  }
  return years;
};

const YEARS = generateYears();

type FilterMode = 'selection' | 'results';
type GuardFilter = 'all' | 'me' | number; // 'me' samo za guard usere, number je ID čuvara

export default function PositionHistoryScreen() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  
  // System settings
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  
  // Stanje za filtriranje
  const [mode, setMode] = useState<FilterMode>('selection');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [guardFilter, setGuardFilter] = useState<GuardFilter>(isAdmin ? 'all' : 'me');
  
  // Lista čuvara za admin
  const [guards, setGuards] = useState<GuardProfile[]>([]);
  const [guardsLoading, setGuardsLoading] = useState(false);
  
  // Rezultati
  const [snapshot, setSnapshot] = useState<MonthlySnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  
  // Modal za guardrovu zaradu
  const [earningsModalVisible, setEarningsModalVisible] = useState(false);
  const [earningsMonth, setEarningsMonth] = useState(new Date().getMonth() + 1);
  const [earningsYear, setEarningsYear] = useState(new Date().getFullYear());
  const [earningsData, setEarningsData] = useState<GuardWorkHistoryResponse | null>(null);
  const [earningsLoading, setEarningsLoading] = useState(false);
  
  // Modal za admin monthly earnings summary
  const [adminEarningsModalVisible, setAdminEarningsModalVisible] = useState(false);
  const [adminEarningsMonth, setAdminEarningsMonth] = useState(new Date().getMonth() + 1);
  const [adminEarningsYear, setAdminEarningsYear] = useState(new Date().getFullYear());
  const [adminEarningsData, setAdminEarningsData] = useState<MonthlyEarningsSummaryResponse | null>(null);
  const [adminEarningsLoading, setAdminEarningsLoading] = useState(false);
  const [adminEarningsStep, setAdminEarningsStep] = useState<'selection' | 'results'>('selection');
  
  // Modal za admin position action
  const [positionActionModalVisible, setPositionActionModalVisible] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<MonthlySnapshotPosition | null>(null);
  const [selectedGuardForAssign, setSelectedGuardForAssign] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Create position modal state
  const [createPositionModalVisible, setCreatePositionModalVisible] = useState(false);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [exhibitionsLoading, setExhibitionsLoading] = useState(false);
  const [createPosExhibitionId, setCreatePosExhibitionId] = useState<number | null>(null);
  const [createPosDate, setCreatePosDate] = useState(new Date());
  const [showCreatePosDatePicker, setShowCreatePosDatePicker] = useState(false);
  const [createPosTimeStart, setCreatePosTimeStart] = useState('');
  const [createPosTimeEnd, setCreatePosTimeEnd] = useState('');
  const [createPosShift, setCreatePosShift] = useState<'morning' | 'afternoon'>('morning');
  const [creatingPosition, setCreatingPosition] = useState(false);
  const [showExhibitionDropdown, setShowExhibitionDropdown] = useState(false);
  
  // Delete position state
  const [deletingPositionId, setDeletingPositionId] = useState<number | null>(null);
  
  // Dohvati settings i garde na mount
  useEffect(() => {
    loadSettings();
    if (isAdmin) {
      loadGuards();
      loadExhibitions();
    }
  }, [isAdmin]);
  
  const loadSettings = async () => {
    try {
      setSettingsLoading(true);
      const data = await getCurrentSystemSettings();
      setSettings(data);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setSettingsLoading(false);
    }
  };
  
  const loadGuards = async () => {
    try {
      setGuardsLoading(true);
      const data = await getGuards();
      console.log('Loaded guards:', data);
      console.log('First guard:', data[0]);
      setGuards(data);
    } catch (error) {
      console.error('Error loading guards:', error);
    } finally {
      setGuardsLoading(false);
    }
  };
  
  const loadExhibitions = async () => {
    try {
      setExhibitionsLoading(true);
      const data = await getExhibitions();
      // Handle paginated response
      const exhibitionsList = Array.isArray(data) ? data : (data.results || []);
      setExhibitions(exhibitionsList);
    } catch (error) {
      console.error('Error loading exhibitions:', error);
      setExhibitions([]);
    } finally {
      setExhibitionsLoading(false);
    }
  };
  
  const resetCreatePositionForm = () => {
    setCreatePosExhibitionId(null);
    setCreatePosDate(new Date());
    setCreatePosTimeStart('');
    setCreatePosTimeEnd('');
    setCreatePosShift('morning');
    setShowExhibitionDropdown(false);
  };
  
  const getSelectedExhibition = (): Exhibition | undefined => {
    if (!Array.isArray(exhibitions)) return undefined;
    return exhibitions.find(e => e.id === createPosExhibitionId);
  };
  
  const handleCreatePosition = async () => {
    if (!createPosExhibitionId) {
      Alert.alert('Greška', 'Morate odabrati izložbu.');
      return;
    }
    
    const selectedExhibition = getSelectedExhibition();
    if (!selectedExhibition) {
      Alert.alert('Greška', 'Odabrana izložba nije pronađena.');
      return;
    }
    
    let startTime: string;
    let endTime: string;
    
    if (selectedExhibition.is_special_event) {
      // Special event: use manual time inputs
      if (!createPosTimeStart || !createPosTimeEnd) {
        Alert.alert('Greška', 'Morate unijeti vrijeme početka i završetka.');
        return;
      }
      startTime = createPosTimeStart;
      endTime = createPosTimeEnd;
    } else {
      // Regular exhibition: use shift and system settings
      if (!settings) {
        Alert.alert('Greška', 'Sistemske postavke nisu učitane.');
        return;
      }
      
      // Check if date is weekend
      const dayOfWeek = createPosDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (createPosShift === 'morning') {
        startTime = isWeekend ? settings.weekend_morning_start : settings.weekday_morning_start;
        endTime = isWeekend ? settings.weekend_morning_end : settings.weekday_morning_end;
      } else {
        startTime = isWeekend ? settings.weekend_afternoon_start : settings.weekday_afternoon_start;
        endTime = isWeekend ? settings.weekend_afternoon_end : settings.weekday_afternoon_end;
      }
    }
    
    try {
      setCreatingPosition(true);
      
      const dateStr = createPosDate.toISOString().split('T')[0];
      
      await createPosition({
        exhibition_id: createPosExhibitionId,
        date: dateStr,
        start_time: startTime,
        end_time: endTime,
      });
      
      Alert.alert('Uspjeh', 'Pozicija je uspješno kreirana.');
      setCreatePositionModalVisible(false);
      resetCreatePositionForm();
      
      // Refresh snapshot if in results mode
      if (mode === 'results') {
        fetchSnapshot();
      }
    } catch (error: any) {
      console.error('Error creating position:', error);
      Alert.alert(
        'Greška',
        error.response?.data?.error || error.response?.data?.detail || 'Došlo je do greške pri kreiranju pozicije.'
      );
    } finally {
      setCreatingPosition(false);
    }
  };
  
  const handleDeletePosition = (positionId: number) => {
    Alert.alert(
      'Potvrda',
      'Jeste li sigurni da želite obrisati ovu poziciju?',
      [
        { text: 'Odustani', style: 'cancel' },
        {
          text: 'Obriši',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingPositionId(positionId);
              await deletePosition(positionId);
              Alert.alert('Uspjeh', 'Pozicija je uspješno obrisana.');
              
              // Refresh snapshot
              if (mode === 'results') {
                fetchSnapshot();
              }
            } catch (error: any) {
              console.error('Error deleting position:', error);
              Alert.alert(
                'Greška',
                error.response?.data?.error || error.response?.data?.detail || 'Došlo je do greške pri brisanju pozicije.'
              );
            } finally {
              setDeletingPositionId(null);
            }
          },
        },
      ]
    );
  };
  
  // Dohvati monthly snapshot
  const fetchSnapshot = async () => {
    try {
      setSnapshotLoading(true);
      
      let guardId: 'all' | number = 'all';
      if (guardFilter === 'me' && user?.role === 'guard') {
        // Za guard usere koji žele vidjeti samo sebe
        const guardUser = user as any;
        guardId = guardUser.guard_profile?.id ?? 'all';
      } else if (typeof guardFilter === 'number') {
        guardId = guardFilter;
      }
      
      const data = await getMonthlySnapshot(selectedYear, selectedMonth, guardId);
      setSnapshot(data);
      setMode('results');
    } catch (error: any) {
      console.error('Error fetching snapshot:', error);
      Alert.alert(
        'Greška',
        error.response?.data?.error || error.response?.data?.detail || 'Došlo je do greške pri dohvaćanju podataka.'
      );
    } finally {
      setSnapshotLoading(false);
    }
  };
  
  // Guard: dohvati svoju zaradu
  const fetchMyWorkHistory = async () => {
    try {
      setEarningsLoading(true);
      const data = await getMyWorkHistory(earningsYear, earningsMonth);
      setEarningsData(data);
    } catch (error: any) {
      console.error('Error fetching work history:', error);
      Alert.alert(
        'Greška',
        error.response?.data?.error || error.response?.data?.detail || 'Došlo je do greške pri dohvaćanju podataka.'
      );
    } finally {
      setEarningsLoading(false);
    }
  };
  
  // Admin: dohvati monthly earnings summary
  const fetchAdminEarnings = async () => {
    try {
      setAdminEarningsLoading(true);
      const data = await getMonthlyEarningsSummary({
        month: adminEarningsMonth,
        year: adminEarningsYear,
      });
      setAdminEarningsData(data);
      setAdminEarningsStep('results');
    } catch (error: any) {
      console.error('Error fetching admin earnings:', error);
      Alert.alert(
        'Greška',
        error.response?.data?.error || error.response?.data?.detail || 'Došlo je do greške pri dohvaćanju podataka.'
      );
    } finally {
      setAdminEarningsLoading(false);
    }
  };
  
  // Admin: handle position click
  const handlePositionPress = useCallback((position: MonthlySnapshotPosition) => {
    if (!isAdmin) return;
    
    setSelectedPosition(position);
    setSelectedGuardForAssign(null);
    setPositionActionModalVisible(true);
  }, [isAdmin]);
  
  // Admin: izvrši akciju na poziciji
  const handlePositionAction = async (action: 'ASSIGNED' | 'CANCELED') => {
    if (!selectedPosition) return;
    
    try {
      setActionLoading(true);
      
      let guardId: number;
      
      if (action === 'ASSIGNED') {
        if (!selectedGuardForAssign) {
          Alert.alert('Greška', 'Morate odabrati čuvara.');
          return;
        }
        guardId = selectedGuardForAssign;
      } else {
        // CANCELED - uzmi čuvara s pozicije
        if (!selectedPosition.guard) {
          Alert.alert('Greška', 'Pozicija nema dodijeljenog čuvara za otkazivanje.');
          return;
        }
        guardId = selectedPosition.guard.id;
      }
      
      await createPositionHistoryManual({
        position_id: selectedPosition.position.id,
        guard_id: guardId,
        action,
      });
      
      setPositionActionModalVisible(false);
      
      Alert.alert(
        'Uspjeh',
        action === 'ASSIGNED' 
          ? 'Čuvar je uspješno upisan na poziciju.'
          : 'Pozicija je uspješno otkazana.'
      );
      
      // Refresh podataka
      await fetchSnapshot();
      
    } catch (error: any) {
      console.error('Position action error:', error);
      Alert.alert(
        'Greška',
        error.response?.data?.error || error.response?.data?.detail || 'Došlo je do greške.'
      );
    } finally {
      setActionLoading(false);
    }
  };
  
  // Resetiraj na selection mode
  const resetToSelection = () => {
    setMode('selection');
    setSnapshot(null);
  };
  
  // Render selection mode
  const renderSelectionMode = () => (
    <View style={styles.selectionContainer}>
      <Text style={styles.sectionTitle}>Odaberi period i filter</Text>
      
      {/* Mjesec picker */}
      <View style={styles.pickerContainer}>
        <Text style={styles.pickerLabel}>Mjesec:</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedMonth}
            onValueChange={(value) => setSelectedMonth(value)}
            style={styles.picker}
          >
            {MONTHS.map((m) => (
              <Picker.Item key={m.value} label={m.label} value={m.value} color="#839958" />
            ))}
          </Picker>
        </View>
      </View>
      
      {/* Godina picker */}
      <View style={styles.pickerContainer}>
        <Text style={styles.pickerLabel}>Godina:</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedYear}
            onValueChange={(value) => setSelectedYear(value)}
            style={styles.picker}
          >
            {YEARS.map((y) => (
              <Picker.Item key={y.value} label={y.label} value={y.value} color="#839958" />
            ))}
          </Picker>
        </View>
      </View>
      
      {/* Guard filter */}
      <View style={styles.pickerContainer}>
        <Text style={styles.pickerLabel}>Čuvar:</Text>
        <View style={styles.pickerWrapper}>
          {isAdmin ? (
            <Picker
              selectedValue={guardFilter}
              onValueChange={(value) => setGuardFilter(value)}
              style={styles.picker}
              enabled={!guardsLoading}
            >
              <Picker.Item label="Svi čuvari" value="all" color="#839958" />
              {guards.map((g) => (
                <Picker.Item 
                  key={g.id} 
                  label={g.full_name || g.username || `Guard ${g.id}`} 
                  value={g.id}
                  color="#839958"
                />
              ))}
            </Picker>
          ) : (
            <Picker
              selectedValue={guardFilter}
              onValueChange={(value) => setGuardFilter(value)}
              style={styles.picker}
            >
              <Picker.Item label="Svi čuvari" value="all" color="#839958" />
              <Picker.Item label="Samo ja" value="me" color="#839958" />
            </Picker>
          )}
        </View>
      </View>
      
      {/* Potvrdi gumb */}
      <TouchableOpacity
        style={styles.confirmButton}
        onPress={fetchSnapshot}
        disabled={snapshotLoading || settingsLoading}
      >
        {snapshotLoading ? (
          <ActivityIndicator color="#839958" />
        ) : (
          <Text style={styles.confirmButtonText}>Potvrdi</Text>
        )}
      </TouchableOpacity>
    </View>
  );
  
  // Render results mode
  const renderResultsMode = () => {
    if (!snapshot || !settings) return null;
    
    // Adaptiraj positions za groupPositionsByDate (treba AssignmentPosition format)
    const adaptedPositions = snapshot.positions.map(pos => ({
      position: pos.position,
      guard: pos.guard,
      is_taken: pos.is_taken,
      last_action: pos.last_action,
      last_action_time: pos.last_action_time,
    }));
    
    const { regular, special } = separateSpecialEvents(adaptedPositions as any);
    const positionsByDate = groupPositionsByDate(regular as any);
    const allDates = getAllDatesInWeek(snapshot.period_start, snapshot.period_end);
    
    // Filtriraj radne dane - za monthlyView uključi sve dane koji imaju pozicije ili su radni
    const datesWithPositions = allDates.filter(date => {
      const hasPositions = positionsByDate[date] && positionsByDate[date].length > 0;
      const isWorking = isWorkingDay(date, settings.workdays);
      return hasPositions || isWorking;
    });
    
    // Mapiranje za pronalaženje originalne pozicije s position_history_id
    const originalPositionsMap = new Map<number, MonthlySnapshotPosition>();
    snapshot.positions.forEach(pos => {
      originalPositionsMap.set(pos.position.id, pos);
    });
    
    return (
      <View style={styles.resultsContainer}>
        {/* Header s info i natrag gumbom */}
        <View style={styles.resultsHeader}>
          <TouchableOpacity style={styles.backButton} onPress={resetToSelection}>
            <Text style={styles.backButtonText}>← Natrag</Text>
          </TouchableOpacity>
          
          <View style={styles.periodInfo}>
            <Text style={styles.periodText}>
              {MONTHS.find(m => m.value === snapshot.month)?.label} {snapshot.year}
            </Text>
            <Text style={styles.positionCount}>
              Ukupno pozicija: {snapshot.total_positions}
            </Text>
          </View>
        </View>
        
        {/* Action buttons */}
        <View style={styles.actionButtonsRow}>
          {!isAdmin && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setEarningsMonth(selectedMonth);
                setEarningsYear(selectedYear);
                setEarningsData(null);
                setEarningsModalVisible(true);
              }}
            >
              <Text style={styles.actionButtonText}>💰 Izračunaj zaradu</Text>
            </TouchableOpacity>
          )}
          
          {isAdmin && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.adminActionButton]}
                onPress={() => {
                  setAdminEarningsMonth(selectedMonth);
                  setAdminEarningsYear(selectedYear);
                  setAdminEarningsData(null);
                  setAdminEarningsStep('selection');
                  setAdminEarningsModalVisible(true);
                }}
              >
                <Text style={styles.actionButtonText}>📊 Mjesečni presjek isplata</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.createPositionButton]}
                onPress={() => {
                  resetCreatePositionForm();
                  setCreatePositionModalVisible(true);
                }}
              >
                <Text style={styles.actionButtonText}>➕ Kreiraj poziciju</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        
        {/* Refresh */}
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchSnapshot}
          disabled={snapshotLoading}
        >
          <Text style={styles.refreshButtonText}>🔄 Osvježi</Text>
        </TouchableOpacity>
        
        {/* Grid s pozicijama */}
        <ScrollView style={styles.scheduleScroll}>
          <View style={styles.daysGrid}>
            {datesWithPositions.map(date => {
              const dayPositions = positionsByDate[date] || [];
              const { morning, afternoon } = groupPositionsByShift(dayPositions as any, date, settings);
              
              if (morning.length === 0 && afternoon.length === 0) {
                return null;
              }
              
              return (
                <View key={date} style={styles.dayCard}>
                  <Text style={styles.dayHeader}>{formatDateWithDay(date)}</Text>
                  
                  {/* Jutarnje smjene */}
                  {morning.length > 0 && (
                    <View style={styles.shiftSection}>
                      <Text style={styles.shiftLabel}>Jutro</Text>
                      {sortPositions(morning as any).map(pos => {
                        const originalPos = originalPositionsMap.get(pos.position.id);
                        return (
                          <TouchableOpacity
                            key={pos.position.id}
                            style={[
                              styles.positionItem,
                              !pos.is_taken && styles.positionEmpty,
                              isAdmin && styles.adminClickable,
                            ]}
                            onPress={() => originalPos && handlePositionPress(originalPos)}
                            disabled={!isAdmin}
                          >
                            <View style={styles.positionContent}>
                              <View style={styles.positionInfo}>
                                <Text style={styles.positionExhibition}>{pos.position.exhibition_name}</Text>
                                <Text style={styles.positionTime}>
                                  {pos.position.start_time.substring(0, 5)} - {pos.position.end_time.substring(0, 5)}
                                </Text>
                                <Text style={styles.positionGuard}>
                                  {pos.guard ? pos.guard.full_name : '[Prazno]'}
                                </Text>
                              </View>
                              {isAdmin && (
                                <TouchableOpacity
                                  style={styles.deletePositionButton}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleDeletePosition(pos.position.id);
                                  }}
                                  disabled={deletingPositionId === pos.position.id}
                                >
                                  {deletingPositionId === pos.position.id ? (
                                    <ActivityIndicator size="small" color="#839958" />
                                  ) : (
                                    <Text style={styles.deletePositionButtonText}>🗑️</Text>
                                  )}
                                </TouchableOpacity>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                  
                  {/* Popodnevne smjene */}
                  {afternoon.length > 0 && (
                    <View style={styles.shiftSection}>
                      <Text style={styles.shiftLabel}>Popodne</Text>
                      {sortPositions(afternoon as any).map(pos => {
                        const originalPos = originalPositionsMap.get(pos.position.id);
                        return (
                          <TouchableOpacity
                            key={pos.position.id}
                            style={[
                              styles.positionItem,
                              !pos.is_taken && styles.positionEmpty,
                              isAdmin && styles.adminClickable,
                            ]}
                            onPress={() => originalPos && handlePositionPress(originalPos)}
                            disabled={!isAdmin}
                          >
                            <View style={styles.positionContent}>
                              <View style={styles.positionInfo}>
                                <Text style={styles.positionExhibition}>{pos.position.exhibition_name}</Text>
                                <Text style={styles.positionTime}>
                                  {pos.position.start_time.substring(0, 5)} - {pos.position.end_time.substring(0, 5)}
                                </Text>
                                <Text style={styles.positionGuard}>
                                  {pos.guard ? pos.guard.full_name : '[Prazno]'}
                                </Text>
                              </View>
                              {isAdmin && (
                                <TouchableOpacity
                                  style={styles.deletePositionButton}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleDeletePosition(pos.position.id);
                                  }}
                                  disabled={deletingPositionId === pos.position.id}
                                >
                                  {deletingPositionId === pos.position.id ? (
                                    <ActivityIndicator size="small" color="#839958" />
                                  ) : (
                                    <Text style={styles.deletePositionButtonText}>🗑️</Text>
                                  )}
                                </TouchableOpacity>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          
          {/* Posebni događaji */}
          {special.length > 0 && (() => {
            const specialByDate = groupPositionsByDate(special as any);
            const specialDates = Object.keys(specialByDate).sort();
            
            return (
              <View style={styles.specialEventsSection}>
                <Text style={styles.specialEventsTitle}>Posebni događaji</Text>
                <View style={styles.daysGrid}>
                  {specialDates.map(date => {
                    const daySpecialPositions = specialByDate[date];
                    
                    return (
                      <View key={date} style={styles.specialDayCard}>
                        <Text style={styles.dayHeader}>{formatDateWithDay(date)}</Text>
                        {sortPositions(daySpecialPositions as any).map(pos => {
                          const originalPos = originalPositionsMap.get(pos.position.id);
                          return (
                            <TouchableOpacity
                              key={pos.position.id}
                              style={[
                                styles.specialEventItem,
                                !pos.is_taken && styles.positionEmpty,
                                isAdmin && styles.adminClickable,
                              ]}
                              onPress={() => originalPos && handlePositionPress(originalPos)}
                              disabled={!isAdmin}
                            >
                              <View style={styles.positionContent}>
                                <View style={styles.positionInfo}>
                                  <Text style={styles.specialEventTime}>
                                    {pos.position.start_time.substring(0, 5)} - {pos.position.end_time.substring(0, 5)}
                                  </Text>
                                  <Text style={styles.positionExhibition}>{pos.position.exhibition_name}</Text>
                                  <Text style={styles.positionGuard}>
                                    {pos.guard ? pos.guard.full_name : '[Prazno]'}
                                  </Text>
                                </View>
                                {isAdmin && (
                                  <TouchableOpacity
                                    style={styles.deletePositionButton}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      handleDeletePosition(pos.position.id);
                                    }}
                                    disabled={deletingPositionId === pos.position.id}
                                  >
                                    {deletingPositionId === pos.position.id ? (
                                      <ActivityIndicator size="small" color="#839958" />
                                    ) : (
                                      <Text style={styles.deletePositionButtonText}>🗑️</Text>
                                    )}
                                  </TouchableOpacity>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })()}
        </ScrollView>
      </View>
    );
  };
  
  // Guard earnings modal
  const renderEarningsModal = () => (
    <Modal
      visible={earningsModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setEarningsModalVisible(false)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => setEarningsModalVisible(false)}>
        <Pressable style={styles.modalContent} onPress={() => {}}>
          <Text style={styles.modalTitle}>Izračunaj zaradu</Text>
          
          {!earningsData ? (
            <>
              {/* Selection */}
              <View style={styles.modalPickerContainer}>
                <Text style={styles.modalPickerLabel}>Mjesec:</Text>
                <View style={styles.modalPickerWrapper}>
                  <Picker
                    selectedValue={earningsMonth}
                    onValueChange={(value) => setEarningsMonth(value)}
                    style={styles.modalPicker}
                  >
                    {MONTHS.map((m) => (
                      <Picker.Item key={m.value} label={m.label} value={m.value} />
                    ))}
                  </Picker>
                </View>
              </View>
              
              <View style={styles.modalPickerContainer}>
                <Text style={styles.modalPickerLabel}>Godina:</Text>
                <View style={styles.modalPickerWrapper}>
                  <Picker
                    selectedValue={earningsYear}
                    onValueChange={(value) => setEarningsYear(value)}
                    style={styles.modalPicker}
                  >
                    {YEARS.map((y) => (
                      <Picker.Item key={y.value} label={y.label} value={y.value} />
                    ))}
                  </Picker>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.modalSubmitButton}
                onPress={fetchMyWorkHistory}
                disabled={earningsLoading}
              >
                {earningsLoading ? (
                  <ActivityIndicator color="#839958" />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>Izračunaj</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Results */}
              <View style={styles.earningsResults}>
                <Text style={styles.earningsResultTitle}>{earningsData.period}</Text>
                <Text style={styles.earningsResultGuard}>{earningsData.guard.full_name}</Text>
                
                <View style={styles.earningsSummary}>
                  <View style={styles.earningsSummaryItem}>
                    <Text style={styles.earningsSummaryValue}>{earningsData.summary.total_positions}</Text>
                    <Text style={styles.earningsSummaryLabel}>pozicija</Text>
                  </View>
                  <View style={styles.earningsSummaryItem}>
                    <Text style={styles.earningsSummaryValue}>{earningsData.summary.total_hours}</Text>
                    <Text style={styles.earningsSummaryLabel}>sati</Text>
                  </View>
                  <View style={styles.earningsSummaryItem}>
                    <Text style={[styles.earningsSummaryValue, styles.earningsAmount]}>
                      {earningsData.summary.total_earnings.toFixed(2)} €
                    </Text>
                    <Text style={styles.earningsSummaryLabel}>zarada</Text>
                  </View>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setEarningsData(null);
                  setEarningsModalVisible(false);
                }}
              >
                <Text style={styles.modalCloseButtonText}>Zatvori</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
  
  // Admin earnings summary modal
  const renderAdminEarningsModal = () => (
    <Modal
      visible={adminEarningsModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setAdminEarningsModalVisible(false)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => setAdminEarningsModalVisible(false)}>
        <Pressable style={styles.adminModalContent} onPress={() => {}}>
          <Text style={styles.modalTitle}>Mjesečni presjek isplata</Text>
          
          {adminEarningsStep === 'selection' ? (
            <>
              <View style={styles.modalPickerContainer}>
                <Text style={styles.modalPickerLabel}>Mjesec:</Text>
                <View style={styles.modalPickerWrapper}>
                  <Picker
                    selectedValue={adminEarningsMonth}
                    onValueChange={(value) => setAdminEarningsMonth(value)}
                    style={styles.modalPicker}
                  >
                    {MONTHS.map((m) => (
                      <Picker.Item key={m.value} label={m.label} value={m.value} />
                    ))}
                  </Picker>
                </View>
              </View>
              
              <View style={styles.modalPickerContainer}>
                <Text style={styles.modalPickerLabel}>Godina:</Text>
                <View style={styles.modalPickerWrapper}>
                  <Picker
                    selectedValue={adminEarningsYear}
                    onValueChange={(value) => setAdminEarningsYear(value)}
                    style={styles.modalPicker}
                  >
                    {YEARS.map((y) => (
                      <Picker.Item key={y.value} label={y.label} value={y.value} />
                    ))}
                  </Picker>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.modalSubmitButton}
                onPress={fetchAdminEarnings}
                disabled={adminEarningsLoading}
              >
                {adminEarningsLoading ? (
                  <ActivityIndicator color="#839958" />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>Dohvati</Text>
                )}
              </TouchableOpacity>
            </>
          ) : adminEarningsData ? (
            <ScrollView style={styles.adminEarningsScroll}>
              {/* Summary */}
              <View style={styles.adminEarningsSummary}>
                <Text style={styles.adminEarningsPeriod}>
                  {MONTHS.find(m => m.value === adminEarningsData.month)?.label} {adminEarningsData.year}
                </Text>
                <View style={styles.adminSummaryRow}>
                  <Text style={styles.adminSummaryLabel}>Ukupno čuvara:</Text>
                  <Text style={styles.adminSummaryValue}>{adminEarningsData.summary.total_guards}</Text>
                </View>
                <View style={styles.adminSummaryRow}>
                  <Text style={styles.adminSummaryLabel}>Ukupno sati:</Text>
                  <Text style={styles.adminSummaryValue}>{adminEarningsData.summary.total_hours}</Text>
                </View>
                <View style={styles.adminSummaryRow}>
                  <Text style={styles.adminSummaryLabel}>Ukupna isplata:</Text>
                  <Text style={[styles.adminSummaryValue, styles.adminTotalEarnings]}>
                    {adminEarningsData.summary.total_earnings.toFixed(2)} €
                  </Text>
                </View>
              </View>
              
              {/* Guards breakdown */}
              <Text style={styles.guardsBreakdownTitle}>Po čuvarima:</Text>
              {adminEarningsData.guards.map((guard: MonthlyEarningsGuard) => (
                <View key={guard.guard_id} style={styles.guardEarningsCard}>
                  <Text style={styles.guardName}>{guard.full_name}</Text>
                  <View style={styles.guardStats}>
                    <Text style={styles.guardHours}>{guard.total_hours} sati</Text>
                    <Text style={styles.guardEarnings}>{guard.total_earnings.toFixed(2)} €</Text>
                  </View>
                  
                  {/* Exhibitions breakdown */}
                  <View style={styles.exhibitionsBreakdown}>
                    {guard.exhibitions.map((ex) => (
                      <View key={ex.exhibition_id} style={styles.exhibitionRow}>
                        <Text style={styles.exhibitionName}>{ex.name}</Text>
                        <Text style={styles.exhibitionHours}>{ex.hours}h</Text>
                        <Text style={styles.exhibitionEarnings}>{ex.earnings.toFixed(2)} €</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
              
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setAdminEarningsData(null);
                  setAdminEarningsStep('selection');
                  setAdminEarningsModalVisible(false);
                }}
              >
                <Text style={styles.modalCloseButtonText}>Zatvori</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
  
  // Admin position action modal
  const renderPositionActionModal = () => {
    if (!selectedPosition) return null;
    
    const hasCuvar = selectedPosition.is_taken && selectedPosition.guard;
    
    return (
      <Modal
        visible={positionActionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPositionActionModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPositionActionModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {hasCuvar ? 'Akcije na poziciji' : 'Upiši čuvara'}
            </Text>
            
            <View style={styles.positionDetails}>
              <Text style={styles.positionDetailText}>
                {selectedPosition.position.exhibition_name}
              </Text>
              <Text style={styles.positionDetailText}>
                {formatDateWithDay(selectedPosition.position.date)}
              </Text>
              <Text style={styles.positionDetailText}>
                {selectedPosition.position.start_time.substring(0, 5)} - {selectedPosition.position.end_time.substring(0, 5)}
              </Text>
              {hasCuvar && (
                <Text style={styles.positionDetailGuard}>
                  Čuvar: {selectedPosition.guard?.full_name}
                </Text>
              )}
            </View>
            
            {!hasCuvar ? (
              <>
                {/* Assign cuvar */}
                <View style={styles.modalPickerContainer}>
                  <Text style={styles.modalPickerLabel}>Odaberi čuvara:</Text>
                  <View style={styles.modalPickerWrapper}>
                    <Picker
                      selectedValue={selectedGuardForAssign}
                      onValueChange={(value) => setSelectedGuardForAssign(value)}
                      style={styles.modalPicker}
                    >
                      <Picker.Item label="-- Odaberi --" value={null} />
                      {guards.map((g) => (
                        <Picker.Item 
                          key={g.id} 
                          label={g.full_name || g.username || `Guard ${g.id}`} 
                          value={g.id} 
                        />
                      ))}
                    </Picker>
                  </View>
                </View>
                
                <TouchableOpacity
                  style={[styles.modalSubmitButton, styles.assignButton]}
                  onPress={() => handlePositionAction('ASSIGNED')}
                  disabled={actionLoading || !selectedGuardForAssign}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#839958" />
                  ) : (
                    <Text style={styles.modalSubmitButtonText}>Upiši čuvara</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Cancel position */}
                <TouchableOpacity
                  style={[styles.modalSubmitButton, styles.cancelButton]}
                  onPress={() => handlePositionAction('CANCELED')}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#839958" />
                  ) : (
                    <Text style={styles.modalSubmitButtonText}>Otkaži poziciju</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
            
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setPositionActionModalVisible(false)}
              disabled={actionLoading}
            >
              <Text style={styles.modalCancelButtonText}>Odustani</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };
  
  // Create position modal
  const renderCreatePositionModal = () => {
    const selectedExhibition = getSelectedExhibition();
    const isSpecialEvent = selectedExhibition?.is_special_event ?? false;
    
    return (
      <Modal
        visible={createPositionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreatePositionModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCreatePositionModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Kreiraj poziciju</Text>
            <Text style={styles.modalSubtitle}>Za iznimne slučajeve</Text>
            
            {/* Exhibition selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Izložba:</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowExhibitionDropdown(!showExhibitionDropdown)}
              >
                <Text style={styles.dropdownButtonText}>
                  {selectedExhibition ? selectedExhibition.name : 'Odaberi izložbu'}
                </Text>
                <Text style={styles.dropdownArrow}>{showExhibitionDropdown ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              
              {showExhibitionDropdown && (
                <View style={styles.dropdownList}>
                  {exhibitionsLoading ? (
                    <ActivityIndicator size="small" color="#105666" />
                  ) : (
                    <ScrollView style={styles.dropdownScrollView} nestedScrollEnabled>
                      {Array.isArray(exhibitions) && exhibitions.map(ex => (
                        <TouchableOpacity
                          key={ex.id}
                          style={[
                            styles.dropdownItem,
                            createPosExhibitionId === ex.id && styles.dropdownItemSelected,
                          ]}
                          onPress={() => {
                            setCreatePosExhibitionId(ex.id);
                            setShowExhibitionDropdown(false);
                            // Reset time fields when exhibition changes
                            setCreatePosTimeStart('');
                            setCreatePosTimeEnd('');
                          }}
                        >
                          <Text style={[
                            styles.dropdownItemText,
                            createPosExhibitionId === ex.id && styles.dropdownItemTextSelected,
                          ]}>
                            {ex.name} {ex.is_special_event ? '(poseban događaj)' : ''}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}
            </View>
            
            {/* Date picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Datum:</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowCreatePosDatePicker(true)}
              >
                <Text style={styles.datePickerButtonText}>
                  {createPosDate.toLocaleDateString('hr-HR')}
                </Text>
              </TouchableOpacity>
              
              {showCreatePosDatePicker && (
                <DateTimePicker
                  value={createPosDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowCreatePosDatePicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      setCreatePosDate(selectedDate);
                    }
                  }}
                />
              )}
            </View>
            
            {/* Time inputs - depends on exhibition type */}
            {selectedExhibition && (
              <>
                {isSpecialEvent ? (
                  <>
                    {/* Special event: manual time inputs */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Vrijeme početka (HH:MM:SS):</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={createPosTimeStart}
                        onChangeText={setCreatePosTimeStart}
                        placeholder="09:00:00"
                        placeholderTextColor="#D3968C"
                      />
                    </View>
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Vrijeme završetka (HH:MM:SS):</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={createPosTimeEnd}
                        onChangeText={setCreatePosTimeEnd}
                        placeholder="17:00:00"
                        placeholderTextColor="#D3968C"
                      />
                    </View>
                  </>
                ) : (
                  <>
                    {/* Regular exhibition: shift picker */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Smjena:</Text>
                      <View style={styles.shiftButtons}>
                        <TouchableOpacity
                          style={[
                            styles.shiftButton,
                            createPosShift === 'morning' && styles.shiftButtonActive,
                          ]}
                          onPress={() => setCreatePosShift('morning')}
                        >
                          <Text style={[
                            styles.shiftButtonText,
                            createPosShift === 'morning' && styles.shiftButtonTextActive,
                          ]}>Jutro</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.shiftButton,
                            createPosShift === 'afternoon' && styles.shiftButtonActive,
                          ]}
                          onPress={() => setCreatePosShift('afternoon')}
                        >
                          <Text style={[
                            styles.shiftButtonText,
                            createPosShift === 'afternoon' && styles.shiftButtonTextActive,
                          ]}>Popodne</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}
              </>
            )}
            
            {/* Action buttons */}
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setCreatePositionModalVisible(false);
                  resetCreatePositionForm();
                }}
                disabled={creatingPosition}
              >
                <Text style={styles.modalCancelButtonText}>Odustani</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalConfirmButton, !createPosExhibitionId && styles.buttonDisabled]}
                onPress={handleCreatePosition}
                disabled={creatingPosition || !createPosExhibitionId}
              >
                {creatingPosition ? (
                  <ActivityIndicator size="small" color="#839958" />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>Kreiraj</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };
  
  if (settingsLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#105666" />
          <Text style={styles.loadingText}>Učitavanje...</Text>
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Povijest upisivanja</Text>
        
        {mode === 'selection' && renderSelectionMode()}
        {mode === 'results' && renderResultsMode()}
      </ScrollView>
      
      {/* Modals */}
      {renderEarningsModal()}
      {renderAdminEarningsModal()}
      {renderPositionActionModal()}
      {isAdmin && renderCreatePositionModal()}
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#839958',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#D3968C',
  },
  
  // Selection mode
  selectionContainer: {
    backgroundColor: '#0A3323',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    color: '#839958',
  },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#839958',
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#839958',
    borderRadius: 8,
    backgroundColor: '#0A3323',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  confirmButton: {
    backgroundColor: '#0A3323',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#839958',
  },
  confirmButtonText: {
    color: '#839958',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Results mode
  resultsContainer: {
    flex: 1,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#0A3323',
    borderRadius: 8,
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 14,
    color: '#839958',
  },
  periodInfo: {
    flex: 1,
  },
  periodText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#839958',
  },
  positionCount: {
    fontSize: 13,
    color: '#D3968C',
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#105666',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminActionButton: {
    backgroundColor: '#105666',
  },
  actionButtonText: {
    color: '#839958',
    fontSize: 14,
    fontWeight: '600',
  },
  refreshButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  refreshButtonText: {
    fontSize: 14,
    color: '#105666',
  },
  scheduleScroll: {
    flex: 1,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayCard: {
    width: '48%',
    backgroundColor: '#0A3323',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dayHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#839958',
    marginBottom: 10,
    textAlign: 'center',
  },
  shiftSection: {
    marginBottom: 8,
  },
  shiftLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#D3968C',
    marginBottom: 4,
  },
  positionItem: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#105666',
    marginBottom: 4,
  },
  positionEmpty: {
    backgroundColor: '#D3968C',
  },
  adminClickable: {
    borderWidth: 1,
    borderColor: '#839958',
    borderStyle: 'dashed',
  },
  positionExhibition: {
    fontSize: 12,
    fontWeight: '600',
    color: '#839958',
  },
  positionTime: {
    fontSize: 10,
    color: '#839958',
    marginTop: 2,
  },
  positionGuard: {
    fontSize: 11,
    color: '#839958',
    marginTop: 2,
  },
  specialEventsSection: {
    marginTop: 20,
  },
  specialEventsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#105666',
    marginBottom: 12,
  },
  specialDayCard: {
    width: '48%',
    backgroundColor: '#0A3323',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#105666',
  },
  specialEventItem: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#105666',
    marginBottom: 4,
  },
  specialEventTime: {
    fontSize: 10,
    color: '#839958',
    fontWeight: '500',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 51, 35, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#0A3323',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  adminModalContent: {
    backgroundColor: '#0A3323',
    borderRadius: 12,
    padding: 20,
    width: '95%',
    maxWidth: 500,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#839958',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalPickerContainer: {
    marginBottom: 16,
  },
  modalPickerLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#839958',
    marginBottom: 6,
  },
  modalPickerWrapper: {
    borderWidth: 1,
    borderColor: '#839958',
    borderRadius: 8,
    backgroundColor: '#0A3323',
    overflow: 'hidden',
  },
  modalPicker: {
    height: 50,
  },
  modalSubmitButton: {
    backgroundColor: '#0A3323',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#839958',
  },
  modalSubmitButtonText: {
    color: '#839958',
    fontSize: 15,
    fontWeight: '600',
  },
  modalCloseButton: {
    backgroundColor: '#105666',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  modalCloseButtonText: {
    color: '#839958',
    fontSize: 15,
    fontWeight: '500',
  },
  modalCancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCancelButtonText: {
    color: '#D3968C',
    fontSize: 14,
  },
  
  // Earnings results (guard)
  earningsResults: {
    alignItems: 'center',
  },
  earningsResultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#839958',
    marginBottom: 4,
  },
  earningsResultGuard: {
    fontSize: 14,
    color: '#D3968C',
    marginBottom: 16,
  },
  earningsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
  },
  earningsSummaryItem: {
    alignItems: 'center',
  },
  earningsSummaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#839958',
  },
  earningsSummaryLabel: {
    fontSize: 12,
    color: '#D3968C',
    marginTop: 4,
  },
  earningsAmount: {
    color: '#105666',
  },
  
  // Admin earnings
  adminEarningsScroll: {
    maxHeight: 500,
  },
  adminEarningsSummary: {
    backgroundColor: '#105666',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  adminEarningsPeriod: {
    fontSize: 16,
    fontWeight: '600',
    color: '#839958',
    textAlign: 'center',
    marginBottom: 12,
  },
  adminSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  adminSummaryLabel: {
    fontSize: 14,
    color: '#D3968C',
  },
  adminSummaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#839958',
  },
  adminTotalEarnings: {
    color: '#F7F4D5',
    fontSize: 16,
  },
  guardsBreakdownTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#839958',
    marginBottom: 12,
  },
  guardEarningsCard: {
    backgroundColor: '#105666',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#839958',
  },
  guardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#839958',
  },
  guardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 8,
  },
  guardHours: {
    fontSize: 13,
    color: '#D3968C',
  },
  guardEarnings: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F7F4D5',
  },
  exhibitionsBreakdown: {
    borderTopWidth: 1,
    borderTopColor: '#839958',
    paddingTop: 8,
  },
  exhibitionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  exhibitionName: {
    flex: 1,
    fontSize: 12,
    color: '#839958',
  },
  exhibitionHours: {
    fontSize: 12,
    color: '#D3968C',
    marginRight: 12,
  },
  exhibitionEarnings: {
    fontSize: 12,
    color: '#F7F4D5',
    minWidth: 60,
    textAlign: 'right',
  },
  
  // Position action modal
  positionDetails: {
    backgroundColor: '#105666',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  positionDetailText: {
    fontSize: 14,
    color: '#839958',
    marginBottom: 4,
  },
  positionDetailGuard: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F7F4D5',
    marginTop: 8,
  },
  assignButton: {
    backgroundColor: '#105666',
  },
  cancelButton: {
    backgroundColor: '#D3968C',
  },
  
  // Create position button
  createPositionButton: {
    backgroundColor: '#105666',
  },
  
  // Position content with delete button
  positionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  positionInfo: {
    flex: 1,
  },
  deletePositionButton: {
    backgroundColor: '#D3968C',
    borderRadius: 4,
    padding: 6,
    marginLeft: 8,
  },
  deletePositionButtonText: {
    fontSize: 14,
  },
  
  // Create position modal styles
  modalSubtitle: {
    fontSize: 14,
    color: '#D3968C',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
    width: '100%',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#839958',
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#105666',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#839958',
    padding: 12,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#839958',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#D3968C',
  },
  dropdownList: {
    backgroundColor: '#0A3323',
    borderWidth: 1,
    borderColor: '#839958',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
  },
  dropdownScrollView: {
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#839958',
  },
  dropdownItemSelected: {
    backgroundColor: '#105666',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#839958',
  },
  dropdownItemTextSelected: {
    color: '#F7F4D5',
    fontWeight: '600',
  },
  datePickerButton: {
    backgroundColor: '#105666',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#839958',
    padding: 12,
    alignItems: 'center',
  },
  datePickerButtonText: {
    fontSize: 16,
    color: '#839958',
  },
  timeInput: {
    backgroundColor: '#105666',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#839958',
    padding: 12,
    fontSize: 16,
    color: '#839958',
  },
  shiftButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  shiftButton: {
    flex: 1,
    backgroundColor: '#105666',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#839958',
    padding: 12,
    alignItems: 'center',
  },
  shiftButtonActive: {
    backgroundColor: '#0A3323',
    borderColor: '#839958',
  },
  shiftButtonText: {
    fontSize: 16,
    color: '#839958',
  },
  shiftButtonTextActive: {
    color: '#F7F4D5',
    fontWeight: '600',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
