import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  RefreshControl,
  Platform,
  Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Exhibition,
  ExhibitionCreateData,
  ExhibitionUpdateData,
} from '../types';
import {
  getExhibitions,
  getExhibition,
  createExhibition,
  updateExhibition,
  deleteExhibition,
} from '../api/endpoints';
import { getCurrentSystemSettings } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';

const DAYS_OF_WEEK = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];

type SortField = 'name' | 'start_date' | 'end_date';
type SortOrder = 'asc' | 'desc';

const ExhibitionsScreen: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin';
  
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [next, setNext] = useState<string | null>(null);
  const [prev, setPrev] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  
  // Filteri i sortiranje
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'upcoming' | 'finished'>('all');
  const [searchText, setSearchText] = useState('');
  const [appliedSearchText, setAppliedSearchText] = useState('');
  const [sortField, setSortField] = useState<SortField | ''>(''); // Prazan default - korisnik mora odabrati
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  
  // Temp state za filter modal (primjenjuje se tek na "Primijeni")
  const [tempStatusFilter, setTempStatusFilter] = useState<'all' | 'active' | 'upcoming' | 'finished'>('all');
  const [tempSortField, setTempSortField] = useState<SortField | ''>('');
  const [tempSortOrder, setTempSortOrder] = useState<SortOrder>('asc');
  
  // Modal states
  const [showActionModal, setShowActionModal] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedExhibition, setSelectedExhibition] = useState<Exhibition | null>(null);
  
  // Date/Time Picker states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEventStartTimePicker, setShowEventStartTimePicker] = useState(false);
  const [showEventEndTimePicker, setShowEventEndTimePicker] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState<ExhibitionCreateData>({
    name: '',
    number_of_positions: 1,
    start_date: new Date().toISOString(),
    end_date: new Date().toISOString(),
    open_on: [],
    rules: '',
    is_special_event: false,
    event_start_time: null,
    event_end_time: null,
  });
  
  const [workdays, setWorkdays] = useState<number[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);

  // Funkcije za filter modal
  const openFiltersModal = () => {
    setTempStatusFilter(statusFilter);
    setTempSortField(sortField);
    setTempSortOrder(sortOrder);
    setShowFiltersModal(true);
  };

  const applyFilters = () => {
    setStatusFilter(tempStatusFilter);
    setSortField(tempSortField);
    setSortOrder(tempSortOrder);
    setShowFiltersModal(false);
  };

  const cancelFilters = () => {
    setShowFiltersModal(false);
  };

  useEffect(() => {
    loadExhibitions();
    loadWorkdays();
  }, [statusFilter, sortField, sortOrder, appliedSearchText]);

  const loadWorkdays = async () => {
    try {
      const settings = await getCurrentSystemSettings();
      setWorkdays(settings.workdays);
      setSystemSettings(settings);
    } catch (error) {
      console.error('Error loading workdays:', error);
      // Fallback to Tuesday-Sunday
      setWorkdays([1, 2, 3, 4, 5, 6]);
    }
  };

  const loadExhibitions = async (pageNum: number = page) => {
    try {
      setLoading(true);
      
      // Build filters object
      const filters: any = {};
      
      // Status filter
      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }
      
      // Ordering
      if (sortField) {
        filters.ordering = sortOrder === 'asc' ? sortField : `-${sortField}`;
      }
      
      const data = await getExhibitions(pageNum, filters);
      console.log('📦 Exhibitions data:', data);
      console.log('📦 Data type:', typeof data);
      console.log('📦 Is array:', Array.isArray(data));
      
      // Extract results from paginated response
      let exhibitionsList = Array.isArray(data) ? data : (data.results || []);
      
      // Frontend filtering za search text (backend ne podržava partial text search)
      if (appliedSearchText.trim()) {
        const search = appliedSearchText.toLowerCase();
        exhibitionsList = exhibitionsList.filter((ex: Exhibition) =>
          ex.name.toLowerCase().includes(search) ||
          ex.rules.toLowerCase().includes(search)
        );
      }
      
      setExhibitions(exhibitionsList);
      
      // Set pagination data
      if (!Array.isArray(data)) {
        setNext(data.next || null);
        setPrev(data.previous || null);
        setCount(data.count || 0);
      }
    } catch (error) {
      console.error('❌ Error loading exhibitions:', error);
      Alert.alert('Greška', 'Neuspješno učitavanje izložbi');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadExhibitions();
    setRefreshing(false);
  }, []);

  const handleExhibitionPress = async (exhibition: Exhibition) => {
    if (!isAdmin) {
      // Guard treba učitati sve detalje (uključujući pravila)
      try {
        const fullExhibition = await getExhibition(exhibition.id);
        setSelectedExhibition(fullExhibition);
        setDetailsModalVisible(true);
      } catch (error) {
        console.error('Error loading exhibition details:', error);
        Alert.alert('Greška', 'Neuspješno učitavanje detalja izložbe');
      }
    } else {
      // Admin dobiva opcije - može koristiti postojeće podatke
      setSelectedExhibition(exhibition);
      setShowActionModal(true);
    }
  };

  // Helper: Postavlja vrijeme automatski prema danu u tjednu i SystemSettings
  const getTimeForDate = (date: string, isStart: boolean): string => {
    if (!systemSettings) return date;
    
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    let time: string;
    if (isStart) {
      time = isWeekend ? systemSettings.weekend_morning_start : systemSettings.weekday_morning_start;
    } else {
      time = isWeekend ? systemSettings.weekend_afternoon_end : systemSettings.weekday_afternoon_end;
    }
    
    // Kombinuj datum sa vremenom iz settings
    const dateStr = dateObj.toISOString().split('T')[0];
    return `${dateStr}T${time}`;
  };

  const openCreateModal = () => {
    setFormData({
      name: '',
      number_of_positions: 1,
      start_date: new Date().toISOString(),
      end_date: new Date().toISOString(),
      open_on: [...workdays], // Default to workdays
      rules: '',
      is_special_event: false,
      event_start_time: null,
      event_end_time: null,
    });
    setCreateModalVisible(true);
  };

  const openEditModal = (exhibition: Exhibition) => {
    const now = new Date();
    const hasStarted = now > new Date(exhibition.start_date);
    const hasEnded = now > new Date(exhibition.end_date);
    
    setFormData({
      name: exhibition.name,
      number_of_positions: exhibition.number_of_positions,
      start_date: exhibition.start_date,
      end_date: exhibition.end_date,
      open_on: [...exhibition.open_on],
      rules: exhibition.rules,
      is_special_event: exhibition.is_special_event,
      event_start_time: exhibition.event_start_time,
      event_end_time: exhibition.event_end_time,
    });
    setEditModalVisible(true);
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Greška', 'Ime izložbe je obavezno');
      return;
    }

    if (formData.open_on.length === 0) {
      Alert.alert('Greška', 'Molimo odaberite barem jedan dan u tjednu');
      return;
    }

    if (formData.is_special_event) {
      if (!formData.event_start_time || !formData.event_end_time) {
        Alert.alert('Greška', 'Vrijeme početka i kraja događaja su obavezni za poseban događaj');
        return;
      }
    }

    try {
      await createExhibition(formData);
      setCreateModalVisible(false);
      Alert.alert('Uspjeh', 'Izložba je uspješno kreirana');
      loadExhibitions();
    } catch (error: any) {
      console.error('Error creating exhibition:', error);
      Alert.alert('Greška', error.response?.data?.detail || 'Neuspješno kreiranje izložbe');
    }
  };

  const handleEdit = async () => {
    console.log('🔵 handleEdit called');
    console.log('🔵 selectedExhibition:', selectedExhibition);
    console.log('🔵 formData:', formData);
    
    if (!selectedExhibition) {
      console.log('❌ No selected exhibition');
      return;
    }
    
    const now = new Date();
    const originalStartDate = new Date(selectedExhibition.start_date);
    const originalEndDate = new Date(selectedExhibition.end_date);
    const newStartDate = new Date(formData.start_date);
    const newEndDate = new Date(formData.end_date);
    
    console.log('🔵 now:', now);
    console.log('🔵 originalStartDate:', originalStartDate);
    console.log('🔵 newStartDate:', newStartDate);
    console.log('🔵 originalEndDate:', originalEndDate);
    console.log('🔵 newEndDate:', newEndDate);
    
    // Validacija: Ne smije se mijenjati datum početka ako je izložba već počela
    const hasExhibitionStarted = now > originalStartDate;
    const isStartDateChanged = newStartDate.getTime() !== originalStartDate.getTime();
    
    if (hasExhibitionStarted && isStartDateChanged) {
      console.log('❌ Cannot change start date - exhibition already started');
      Alert.alert('Greška', 'Ne možete mijenjati datum početka jer je izložba već počela');
      return;
    }
    
    // Validacija: Ako je izložba završila, ne može se produljivati
    const hasExhibitionEnded = now > originalEndDate;
    if (hasExhibitionEnded) {
      console.log('❌ Exhibition has ended - cannot be edited');
      Alert.alert('Greška', 'Izložba je završila i ne može se uređivati');
      return;
    }
    
    // Validacija: Datum kraja ne smije biti u prošlosti
    if (newEndDate < now) {
      console.log('❌ End date is in the past');
      Alert.alert('Greška', 'Datum kraja ne može biti u prošlosti');
      return;
    }

    if (!formData.name?.trim()) {
      Alert.alert('Greška', 'Ime izložbe je obavezno');
      return;
    }

    if (formData.is_special_event) {
      if (!formData.event_start_time || !formData.event_end_time) {
        console.log('❌ Special event missing times');
        Alert.alert('Greška', 'Vrijeme početka i kraja događaja su obavezni za poseban događaj');
        return;
      }
    }

    try {
      console.log('🔵 Calling updateExhibition API...');
      await updateExhibition(selectedExhibition.id, formData);
      console.log('✅ Update successful');
      setEditModalVisible(false);
      Alert.alert('Uspjeh', 'Izložba je uspješno ažurirana');
      loadExhibitions();
    } catch (error: any) {
      console.error('❌ Error updating exhibition:', error);
      console.error('❌ Error response:', error.response?.data);
      Alert.alert('Greška', error.response?.data?.detail || 'Neuspješno ažuriranje izložbe');
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      'Potvrda',
      'Jeste li sigurni da želite obrisati ovu izložbu?',
      [
        {
          text: 'Odustani',
          style: 'cancel',
        },
        {
          text: 'Obriši',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExhibition(id);
              Alert.alert('Uspjeh', 'Izložba je uspješno obrisana');
              loadExhibitions();
            } catch (error: any) {
              console.error('Error deleting exhibition:', error);
              Alert.alert('Greška', error.response?.data?.detail || 'Neuspješno brisanje izložbe');
            }
          },
        },
      ]
    );
  };

  // Filter i sort funkcije
  const getFilteredAndSortedExhibitions = () => {
    let filtered = [...exhibitions];

    // Primijeni status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(ex => ex.status === statusFilter);
    }

    // Primijeni search
    if (appliedSearchText.trim()) {
      const search = appliedSearchText.toLowerCase();
      filtered = filtered.filter(ex =>
        ex.name.toLowerCase().includes(search) ||
        ex.rules.toLowerCase().includes(search)
      );
    }

    // Primijeni sort samo ako je postavljen
    if (sortField) {
      filtered.sort((a, b) => {
        let compareValue = 0;
        
        if (sortField === 'name') {
          compareValue = a.name.localeCompare(b.name, 'hr');
        } else if (sortField === 'start_date') {
          compareValue = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        } else if (sortField === 'end_date') {
          compareValue = new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
        }
        
        return sortOrder === 'asc' ? compareValue : -compareValue;
      });
    }

    return filtered;
  };

  const filteredExhibitions = getFilteredAndSortedExhibitions();

  const toggleDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      open_on: prev.open_on.includes(day)
        ? prev.open_on.filter(d => d !== day)
        : [...prev.open_on, day].sort((a, b) => a - b),
    }));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('hr-HR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('hr-HR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderExhibitionCard = ({ item }: { item: Exhibition }) => {
    return (
      <TouchableOpacity
        style={[
          styles.card,
          item.status === 'active' ? styles.cardActive : styles.cardInactive,
        ]}
        onPress={() => handleExhibitionPress(item)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <View style={[
            styles.statusBadge,
            item.status === 'active' ? styles.statusActive :
            item.status === 'upcoming' ? styles.statusUpcoming :
            styles.statusFinished
          ]}>
            <Text style={styles.statusText}>
              {item.status === 'active' ? 'Aktivna' :
               item.status === 'upcoming' ? 'Nadolazeća' :
               'Završena'}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardInfo}>
            📅 {formatDate(item.start_date)} - {formatDate(item.end_date)}
          </Text>
          <Text style={styles.cardInfo}>
            Broj pozicija po smjeni: {item.number_of_positions}
          </Text>
          <Text style={styles.cardInfo}>
            Dani: {item.open_on.map(d => DAYS_OF_WEEK[d]).join(', ')}
          </Text>
          {item.is_special_event && (
            <Text style={styles.cardInfo}>
              ⭐ Poseban događaj
            </Text>
          )}
          {!isAdmin && (
            <Text style={styles.hintText}>
              👉 Pravila i važne obavijesti
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetailsModal = () => {
    if (!selectedExhibition) return null;

    return (
      <Modal
        visible={detailsModalVisible}
        animationType="slide"
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📋 Pravila za {selectedExhibition.name}</Text>
            <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.detailSection}>
              {selectedExhibition.rules && selectedExhibition.rules.trim() ? (
                <Text style={styles.rulesText}>{selectedExhibition.rules}</Text>
              ) : (
                <Text style={styles.rulesTextEmpty}>
                  Nema definiranih pravila za ovu izložbu.
                </Text>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const renderFormModal = (visible: boolean, onClose: () => void, onSubmit: () => void, title: string, isEditMode: boolean = false) => {
    const now = new Date();
    const hasStarted = isEditMode && selectedExhibition ? now > new Date(selectedExhibition.start_date) : false;
    const hasEnded = isEditMode && selectedExhibition ? now > new Date(selectedExhibition.end_date) : false;
    
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Naziv izložbe *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Unesite naziv izložbe"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Broj pozicija po danu *</Text>
              <TextInput
                style={styles.input}
                value={formData.number_of_positions.toString()}
                onChangeText={(text) =>
                  setFormData({ ...formData, number_of_positions: parseInt(text) || 1 })
                }
                keyboardType="numeric"
                placeholder="1"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Dani u tjednu *</Text>
              <View style={styles.daysContainer}>
                {DAYS_OF_WEEK.map((day, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayButton,
                      formData.open_on.includes(index) && styles.dayButtonSelected,
                    ]}
                    onPress={() => toggleDay(index)}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        formData.open_on.includes(index) && styles.dayButtonTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date Pickeri - Vrijeme se automatski postavlja */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Datum početka *</Text>
              {hasStarted && (
                <Text style={styles.helperTextWarning}>
                  Izložba je počela - datum početka se ne može mijenjati
                </Text>
              )}
              <Text style={styles.helperText}>
                Vrijeme: {systemSettings ? (new Date(formData.start_date).getDay() === 0 || new Date(formData.start_date).getDay() === 6 ? systemSettings.weekend_morning_start : systemSettings.weekday_morning_start) : 'učitavanje...'}
              </Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={new Date(formData.start_date).toISOString().split('T')[0]}
                  onChange={(e) => {
                    if (!hasStarted) {
                      const dateWithTime = getTimeForDate(new Date(e.target.value).toISOString(), true);
                      setFormData({ ...formData, start_date: dateWithTime });
                    }
                  }}
                  disabled={hasStarted}
                  style={{
                    padding: 14,
                    fontSize: 16,
                    borderRadius: 8,
                    border: '1px solid #839958',
                    backgroundColor: hasStarted ? '#D3968C' : '#F7F4D5',
                    color: '#839958',
                    cursor: hasStarted ? 'not-allowed' : 'pointer',
                    opacity: hasStarted ? 0.6 : 1,
                  }}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Text style={styles.dateButtonText}>
                      📅 {new Date(formData.start_date).toLocaleDateString('hr-HR')}
                    </Text>
                  </TouchableOpacity>
                  {showStartDatePicker && (
                    <DateTimePicker
                      value={new Date(formData.start_date)}
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowStartDatePicker(false);
                        if (selectedDate) {
                          const dateWithTime = getTimeForDate(selectedDate.toISOString(), true);
                          setFormData({ ...formData, start_date: dateWithTime });
                        }
                      }}
                    />
                  )}
                </>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Datum kraja *</Text>
              <Text style={styles.helperText}>
                Vrijeme: {systemSettings ? (new Date(formData.end_date).getDay() === 0 || new Date(formData.end_date).getDay() === 6 ? systemSettings.weekend_afternoon_end : systemSettings.weekday_afternoon_end) : 'učitavanje...'}
              </Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={new Date(formData.end_date).toISOString().split('T')[0]}
                  onChange={(e) => {
                    const dateWithTime = getTimeForDate(new Date(e.target.value).toISOString(), false);
                    setFormData({ ...formData, end_date: dateWithTime });
                  }}
                  style={{
                    padding: 14,
                    fontSize: 16,
                    borderRadius: 8,
                    border: '1px solid #839958',
                    backgroundColor: '#F7F4D5',
                    color: '#839958',
                  }}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Text style={styles.dateButtonText}>
                      📅 {new Date(formData.end_date).toLocaleDateString('hr-HR')}
                    </Text>
                  </TouchableOpacity>
                  {showEndDatePicker && (
                    <DateTimePicker
                      value={new Date(formData.end_date)}
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowEndDatePicker(false);
                        if (selectedDate) {
                          const dateWithTime = getTimeForDate(selectedDate.toISOString(), false);
                          setFormData({ ...formData, end_date: dateWithTime });
                        }
                      }}
                    />
                  )}
                </>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Pravila</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.rules}
                onChangeText={(text) => setFormData({ ...formData, rules: text })}
                placeholder="Unesite pravila izložbe"
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.formGroup}>
              <TouchableOpacity
                style={[styles.checkboxContainer, isEditMode && styles.checkboxDisabled]}
                onPress={() => !isEditMode && setFormData({ ...formData, is_special_event: !formData.is_special_event })}
                disabled={isEditMode}
              >
                <View style={[styles.checkbox, formData.is_special_event && styles.checkboxChecked, isEditMode && styles.checkboxDisabled]}>
                  {formData.is_special_event && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <Text style={[styles.checkboxLabel, isEditMode && styles.disabledText]}>Poseban događaj {isEditMode && '(ne može se mijenjati)'}</Text>
              </TouchableOpacity>
            </View>

            {formData.is_special_event && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Vrijeme početka događaja *</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="time"
                      value={formData.event_start_time || ''}
                      onChange={(e) => setFormData({ ...formData, event_start_time: e.target.value })}
                      style={{
                        padding: 14,
                        fontSize: 16,
                        borderRadius: 8,
                        border: '1px solid #839958',
                        backgroundColor: '#F7F4D5',
                        color: '#839958',
                      }}
                    />
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowEventStartTimePicker(true)}
                      >
                        <Text style={styles.dateButtonText}>
                          🕐 {formData.event_start_time || 'Odaberi vrijeme'}
                        </Text>
                      </TouchableOpacity>
                      {showEventStartTimePicker && (
                        <DateTimePicker
                          value={formData.event_start_time ? new Date(`2000-01-01T${formData.event_start_time}`) : new Date()}
                          mode="time"
                          display="default"
                          onChange={(event, selectedTime) => {
                            setShowEventStartTimePicker(false);
                            if (selectedTime) {
                              const hours = selectedTime.getHours().toString().padStart(2, '0');
                              const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
                              setFormData({ ...formData, event_start_time: `${hours}:${minutes}` });
                            }
                          }}
                        />
                      )}
                    </>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Vrijeme kraja događaja *</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="time"
                      value={formData.event_end_time || ''}
                      onChange={(e) => setFormData({ ...formData, event_end_time: e.target.value })}
                      style={{
                        padding: 14,
                        fontSize: 16,
                        borderRadius: 8,
                        border: '1px solid #839958',
                        backgroundColor: '#F7F4D5',
                        color: '#839958',
                      }}
                    />
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowEventEndTimePicker(true)}
                      >
                        <Text style={styles.dateButtonText}>
                          🕐 {formData.event_end_time || 'Odaberi vrijeme'}
                        </Text>
                      </TouchableOpacity>
                      {showEventEndTimePicker && (
                        <DateTimePicker
                          value={formData.event_end_time ? new Date(`2000-01-01T${formData.event_end_time}`) : new Date()}
                          mode="time"
                          display="default"
                          onChange={(event, selectedTime) => {
                            setShowEventEndTimePicker(false);
                            if (selectedTime) {
                              const hours = selectedTime.getHours().toString().padStart(2, '0');
                              const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
                              setFormData({ ...formData, event_end_time: `${hours}:${minutes}` });
                            }
                          }}
                        />
                      )}
                    </>
                  )}
                </View>
              </>
            )}

            <TouchableOpacity style={styles.submitButton} onPress={onSubmit}>
              <Text style={styles.submitButtonText}>
                {title === 'Kreiraj izložbu' ? 'Kreiraj' : 'Spremi'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A3323" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header sa filterima - IDENTIČNO kao UsersScreen */}
      <View style={styles.header}>
        {/* Search bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Pretraži izložbe..."
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            returnKeyType="search"
            blurOnSubmit={true}
            onSubmitEditing={() => {
              setAppliedSearchText(searchText);
              Keyboard.dismiss();
            }}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(''); setAppliedSearchText(''); }}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => {
              setAppliedSearchText(searchText);
              Keyboard.dismiss();
            }}
          >
            <Text style={styles.searchButtonText}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterIconButton}
            onPress={openFiltersModal}
          >
            <Text style={styles.filterIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Active filters display */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeFilters}>
          {statusFilter !== 'all' && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>
                Status: {
                  statusFilter === 'active' ? 'Aktivne' :
                  statusFilter === 'upcoming' ? 'Nadolazeće' :
                  'Završene'
                }
              </Text>
              <TouchableOpacity onPress={() => setStatusFilter('all')}>
                <Text style={styles.filterChipClose}> ✕</Text>
              </TouchableOpacity>
            </View>
          )}
          {sortField && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>
                Sort: {
                  sortField === 'name' ? 'Ime' :
                  sortField === 'start_date' ? 'Datum početka' :
                  'Datum kraja'
                } {sortOrder === 'asc' ? '↑' : '↓'}
              </Text>
              <TouchableOpacity onPress={() => setSortField('')}>
                <Text style={styles.filterChipClose}> ✕</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Button za kreiranje izložbe */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={openCreateModal}
          >
            <Text style={styles.createButtonText}>+ Kreiraj novu izložbu</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Exhibition list */}
      <FlatList
        data={exhibitions}
        renderItem={renderExhibitionCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nema izložbi</Text>
          </View>
        }
      />

      {/* Pagination Controls */}
      {!loading && (prev || next) && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity 
            style={[styles.paginationButton, !prev && styles.paginationButtonDisabled]}
            onPress={() => {
              if (prev) {
                const newPage = Math.max(1, page - 1);
                setPage(newPage);
                loadExhibitions(newPage);
              }
            }}
            disabled={!prev}
          >
            <Text style={[styles.paginationButtonText, !prev && styles.paginationButtonTextDisabled]}>
              Prethodna
            </Text>
          </TouchableOpacity>
          
          <Text style={styles.paginationText}>Stranica {page}</Text>
          
          <TouchableOpacity 
            style={[styles.paginationButton, !next && styles.paginationButtonDisabled]}
            onPress={() => {
              if (next) {
                const newPage = page + 1;
                setPage(newPage);
                loadExhibitions(newPage);
              }
            }}
            disabled={!next}
          >
            <Text style={[styles.paginationButtonText, !next && styles.paginationButtonTextDisabled]}>
              Sljedeća
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Action Modal za admina */}
      <Modal
        visible={showActionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowActionModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActionModal(false)}
        >
          <View style={styles.actionModalContent}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setShowActionModal(false);
                setDetailsModalVisible(true);
              }}
            >
              <Text style={styles.actionButtonIcon}>👁️</Text>
              <Text style={styles.actionButtonText}>Pogledaj pravila</Text>
            </TouchableOpacity>

            {/* Uredi opcija - samo ako izložba nije završila */}
            {selectedExhibition && selectedExhibition.status !== 'finished' && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setShowActionModal(false);
                  if (selectedExhibition) {
                    openEditModal(selectedExhibition);
                  }
                }}
              >
                <Text style={styles.actionButtonIcon}>✏️</Text>
                <Text style={styles.actionButtonText}>Uredi izložbu</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonDelete]}
              onPress={() => {
                setShowActionModal(false);
                if (selectedExhibition) {
                  handleDelete(selectedExhibition.id);
                }
              }}
            >
              <Text style={styles.actionButtonIcon}>🗑️</Text>
              <Text style={styles.actionButtonTextDelete}>Obriši</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButtonCancel}
              onPress={() => setShowActionModal(false)}
            >
              <Text style={styles.actionButtonCancelText}>Odustani</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Dropdown modali za status */}
      <Modal visible={showStatusDropdown} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={() => setShowStatusDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <Text style={styles.dropdownTitle}>Status</Text>
            <ScrollView style={styles.dropdownScroll}>
              {['all', 'active', 'upcoming', 'finished'].map(status => (
                <TouchableOpacity
                  key={status}
                  style={[styles.dropdownItem, tempStatusFilter === status && styles.dropdownItemActive]}
                  onPress={() => {
                    setTempStatusFilter(status as any);
                    setShowStatusDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, tempStatusFilter === status && styles.dropdownItemTextActive]}>
                    {status === 'all' ? 'Sve izložbe' :
                     status === 'active' ? 'Aktivne' :
                     status === 'upcoming' ? 'Nadolazeće' :
                     'Završene'}
                  </Text>
                  {tempStatusFilter === status && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Dropdown modali za sort field */}
      <Modal visible={showSortDropdown} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={() => setShowSortDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <Text style={styles.dropdownTitle}>Sortiraj po</Text>
            <ScrollView style={styles.dropdownScroll}>
              {(['name', 'start_date', 'end_date'] as SortField[]).map(field => (
                <TouchableOpacity
                  key={field}
                  style={[styles.dropdownItem, tempSortField === field && styles.dropdownItemActive]}
                  onPress={() => {
                    setTempSortField(field);
                    setShowSortDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, tempSortField === field && styles.dropdownItemTextActive]}>
                    {field === 'name' ? 'Ime' :
                     field === 'start_date' ? 'Datum početka' :
                     'Datum kraja'}
                  </Text>
                  {tempSortField === field && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Dropdown modali za sort order */}
      <Modal visible={showOrderDropdown} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={() => setShowOrderDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <Text style={styles.dropdownTitle}>Redoslijed</Text>
            <TouchableOpacity
              style={[styles.dropdownItem, tempSortOrder === 'asc' && styles.dropdownItemActive]}
              onPress={() => {
                setTempSortOrder('asc');
                setShowOrderDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, tempSortOrder === 'asc' && styles.dropdownItemTextActive]}>
                ↑ Uzlazno (A-Z, 1-9)
              </Text>
              {tempSortOrder === 'asc' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownItem, tempSortOrder === 'desc' && styles.dropdownItemActive]}
              onPress={() => {
                setTempSortOrder('desc');
                setShowOrderDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, tempSortOrder === 'desc' && styles.dropdownItemTextActive]}>
                ↓ Silazno (Z-A, 9-1)
              </Text>
              {tempSortOrder === 'desc' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Filter/Sort Modal - centriran kao u UsersScreen */}
      <Modal visible={showFiltersModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.filtersModalContent}>
            <Text style={styles.modalTitle}>Filteri i sortiranje</Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* FILTERI */}
              <View style={styles.filterSection}>
                <Text style={styles.sectionTitle}>🔍 FILTERI</Text>
                
                <Text style={styles.label}>Status</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity 
                    style={styles.picker}
                    onPress={() => setShowStatusDropdown(true)}
                  >
                    <Text style={styles.pickerText}>
                      {tempStatusFilter === 'all' ? 'Sve izložbe' :
                       tempStatusFilter === 'active' ? 'Aktivne' :
                       tempStatusFilter === 'upcoming' ? 'Nadolazeće' :
                       'Završene'}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* SORTIRANJE */}
              <View style={styles.filterSection}>
                <Text style={styles.sectionTitle}>📊 SORTIRANJE</Text>
                
                <Text style={styles.label}>Sortiraj po</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity 
                    style={styles.picker}
                    onPress={() => setShowSortDropdown(true)}
                  >
                    <Text style={styles.pickerText}>
                      {tempSortField === 'name' ? 'Ime' :
                       tempSortField === 'start_date' ? 'Datum početka' :
                       'Datum kraja'}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Redoslijed</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity 
                    style={styles.picker}
                    onPress={() => setShowOrderDropdown(true)}
                  >
                    <Text style={styles.pickerText}>
                      {tempSortOrder === 'asc' ? '↑ Uzlazno (A-Z, 1-9)' : '↓ Silazno (Z-A, 9-1)'}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
            
            {/* BUTTONS - FIKSIRAN NA DNU */}
            <View style={styles.filtersModalFooter}>
              <TouchableOpacity
                style={styles.filterCancelButton}
                onPress={cancelFilters}
              >
                <Text style={styles.filterCancelButtonText}>Odustani</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyButton}
                onPress={applyFilters}
              >
                <Text style={styles.filterApplyButtonText}>✓ Primijeni</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {renderDetailsModal()}
      {renderFormModal(
        createModalVisible,
        () => setCreateModalVisible(false),
        handleCreate,
        'Kreiraj izložbu',
        false
      )}
      {renderFormModal(
        editModalVisible,
        () => setEditModalVisible(false),
        handleEdit,
        'Uredi izložbu',
        true
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4D5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#F7F4D5',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#839958',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 8,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#839958',
    borderRadius: 8,
    padding: 10,
    paddingRight: 35,
    fontSize: 15,
    backgroundColor: '#F7F4D5',
    color: '#839958',
  },
  searchButton: {
    backgroundColor: '#0A3323',
    borderRadius: 8,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 16,
  },
  clearIcon: {
    fontSize: 18,
    color: '#D3968C',
    position: 'absolute',
    right: 90,
    padding: 4,
  },
  filterIconButton: {
    backgroundColor: '#0A3323',
    borderRadius: 8,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    width: 45,
  },
  filterIcon: {
    fontSize: 20,
  },
  activeFilters: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F4D5',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#839958',
  },
  filterChipText: {
    fontSize: 13,
    color: '#839958',
    fontWeight: '500',
  },
  filterChipClose: {
    fontSize: 16,
    color: '#839958',
    fontWeight: 'bold',
  },
  createButton: {
    backgroundColor: '#0A3323',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  createButtonText: {
    color: '#839958',
    fontWeight: '700',
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
  },
  list: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#0A3323',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardActive: {
    // Bez bordere - status se vidi iz badge-a
  },
  cardInactive: {
    // Bez bordere - status se vidi iz badge-a
  },
  statusUpcoming: {
    backgroundColor: '#105666',
  },
  statusFinished: {
    backgroundColor: '#D3968C',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#839958',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#839958',
  },
  statusInactive: {
    backgroundColor: '#D3968C',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0A3323',
  },
  cardBody: {
    gap: 8,
  },
  cardInfo: {
    fontSize: 14,
    color: '#839958',
  },
  hintText: {
    fontSize: 13,
    color: '#105666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  checkboxDisabled: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#D3968C',
  },
  helperTextWarning: {
    fontSize: 13,
    color: '#D3968C',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  statsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#839958',
  },
  statsText: {
    fontSize: 13,
    color: '#105666',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#D3968C',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F7F4D5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#839958',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#839958',
  },
  closeButton: {
    fontSize: 24,
    color: '#839958',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: '#D3968C',
    marginBottom: 4,
  },
  detailLabelLarge: {
    fontSize: 16,
    color: '#839958',
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 8,
  },
  detailValue: {
    fontSize: 16,
    color: '#839958',
    fontWeight: '500',
  },
  rulesText: {
    fontSize: 15,
    color: '#839958',
    lineHeight: 24,
  },
  rulesTextEmpty: {
    fontSize: 15,
    color: '#D3968C',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  statsSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F7F4D5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#839958',
  },
  statsSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#839958',
    marginBottom: 12,
  },
  statsDetail: {
    fontSize: 14,
    color: '#D3968C',
    marginBottom: 6,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#839958',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#839958',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F7F4D5',
    color: '#839958',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#839958',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#F7F4D5',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#839958',
  },
  helperText: {
    fontSize: 14,
    color: '#D3968C',
    marginTop: 4,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#839958',
    backgroundColor: '#F7F4D5',
  },
  dayButtonSelected: {
    backgroundColor: '#0A3323',
    borderColor: '#0A3323',
  },
  dayButtonText: {
    fontSize: 14,
    color: '#D3968C',
  },
  dayButtonTextSelected: {
    color: '#839958',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#0A3323',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  submitButtonText: {
    color: '#839958',
    fontSize: 16,
    fontWeight: '600',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#839958',
    backgroundColor: '#F7F4D5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#0A3323',
    borderColor: '#0A3323',
  },
  checkboxMark: {
    color: '#839958',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#839958',
  },
  // Action Modal stilovi
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 51, 35, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionModalContent: {
    backgroundColor: '#F7F4D5',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#839958',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0A3323',
    borderRadius: 8,
    marginBottom: 10,
  },
  actionButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#839958',
    fontWeight: '500',
  },
  actionButtonDelete: {
    backgroundColor: '#D3968C',
  },
  actionButtonTextDelete: {
    fontSize: 16,
    color: '#0A3323',
    fontWeight: '500',
  },
  actionButtonCancel: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  actionButtonCancelText: {
    fontSize: 16,
    color: '#D3968C',
    fontWeight: '500',
  },
  // Filter Modal stilovi - identično kao UsersScreen
  filtersModalContent: {
    backgroundColor: '#F7F4D5',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#839958',
  },
  filterSection: {
    marginBottom: 25,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#839958',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#839958',
    marginBottom: 15,
  },
  pickerContainer: {
    marginBottom: 15,
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F7F4D5',
    borderWidth: 1,
    borderColor: '#839958',
    borderRadius: 8,
    padding: 14,
  },
  pickerText: {
    fontSize: 15,
    color: '#839958',
    fontWeight: '500',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#D3968C',
  },
  filtersModalFooter: {
    flexDirection: 'row',
    marginTop: 15,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#839958',
    gap: 10,
  },
  filterCancelButton: {
    flex: 1,
    backgroundColor: '#D3968C',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  filterCancelButtonText: {
    color: '#0A3323',
    fontWeight: '700',
    fontSize: 17,
  },
  filterApplyButton: {
    flex: 1,
    backgroundColor: '#0A3323',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  filterApplyButtonText: {
    color: '#839958',
    fontWeight: '700',
    fontSize: 17,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 51, 35, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContent: {
    backgroundColor: '#F7F4D5',
    borderRadius: 12,
    padding: 15,
    width: '80%',
    maxWidth: 350,
    maxHeight: '60%',
    borderWidth: 1,
    borderColor: '#839958',
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#839958',
    marginBottom: 15,
    textAlign: 'center',
  },
  dropdownScroll: {
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#839958',
  },
  dropdownItemActive: {
    backgroundColor: '#0A3323',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#839958',
  },
  dropdownItemTextActive: {
    color: '#839958',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#839958',
    fontWeight: 'bold',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F7F4D5',
    borderTopWidth: 1,
    borderTopColor: '#839958',
  },
  paginationButton: {
    backgroundColor: '#0A3323',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#D3968C',
  },
  paginationButtonText: {
    color: '#839958',
    fontWeight: '600',
    fontSize: 14,
  },
  paginationButtonTextDisabled: {
    color: '#0A3323',
  },
  paginationText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#839958',
  },
});

export default ExhibitionsScreen;
