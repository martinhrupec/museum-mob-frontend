import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { crossAlert } from '../utils/alert';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '../store/authStore';
import { getCurrentSystemSettings, updateSystemSettings, getAllNonWorkingDays, createNonWorkingDay } from '../api/endpoints';
import { SystemSettings, NonWorkingDay } from '../types';

const DAYS_OF_WEEK = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];

const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function SystemSettingsScreen() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Edit state (samo za admin)
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<SystemSettings>>({});
  
  // Non-working days state
  const [nonWorkingDays, setNonWorkingDays] = useState<NonWorkingDay[]>([]);
  const [nonWorkingDaysLoading, setNonWorkingDaysLoading] = useState(false);
  
  // Create non-working day modal state
  const [showCreateNwdModal, setShowCreateNwdModal] = useState(false);
  const [nwdDate, setNwdDate] = useState(new Date());
  const [showNwdDatePicker, setShowNwdDatePicker] = useState(false);
  const [nwdReason, setNwdReason] = useState('');
  const [nwdIsFullDay, setNwdIsFullDay] = useState(true);
  const [nwdShift, setNwdShift] = useState<'MORNING' | 'AFTERNOON'>('MORNING');
  const [creatingNwd, setCreatingNwd] = useState(false);

  useEffect(() => {
    loadSettings();
    loadNonWorkingDays();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getCurrentSystemSettings();
      setSettings(data);
    } catch (error: any) {
      console.error('Error loading system settings:', error);
      crossAlert('Greška', 'Nije moguće učitati postavke sustava');
    } finally {
      setLoading(false);
    }
  };

  const loadNonWorkingDays = async () => {
    try {
      setNonWorkingDaysLoading(true);
      const data = await getAllNonWorkingDays({ in_future: true });
      setNonWorkingDays(data);
    } catch (error: any) {
      console.error('Error loading non-working days:', error);
    } finally {
      setNonWorkingDaysLoading(false);
    }
  };

  const formatNwdDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('hr-HR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getShiftLabel = (nwd: NonWorkingDay): string => {
    if (nwd.is_full_day) return 'cijeli dan';
    return nwd.non_working_shift === 'MORNING' ? 'jutro' : 'popodne';
  };

  const resetNwdForm = () => {
    setNwdDate(new Date());
    setNwdReason('');
    setNwdIsFullDay(true);
    setNwdShift('MORNING');
  };

  const handleCreateNwd = async () => {
    if (!nwdReason.trim()) {
      crossAlert('Greška', 'Unesite razlog');
      return;
    }

    try {
      setCreatingNwd(true);
      const dateStr = formatDateLocal(nwdDate);
      
      const data: any = {
        date: dateStr,
        is_full_day: nwdIsFullDay,
        reason: nwdReason.trim(),
      };
      
      if (!nwdIsFullDay) {
        data.non_working_shift = nwdShift;
      }
      
      await createNonWorkingDay(data);
      
      setShowCreateNwdModal(false);
      resetNwdForm();
      loadNonWorkingDays();
      crossAlert('Uspjeh', 'Neradni dan je uspješno dodan');
    } catch (error: any) {
      console.error('Error creating non-working day:', error);
      crossAlert('Greška', error.response?.data?.detail || 'Nije moguće dodati neradni dan');
    } finally {
      setCreatingNwd(false);
    }
  };

  const handleEdit = () => {
    if (!settings) return;
    setEditData({
      workdays: [...settings.workdays],
      points_life_weeks: settings.points_life_weeks,
      award_for_position_completion: settings.award_for_position_completion,
      award_for_sunday_position_completion: settings.award_for_sunday_position_completion,
      award_for_jumping_in_on_cancelled_position: settings.award_for_jumping_in_on_cancelled_position,
      penalty_for_being_late_with_notification: settings.penalty_for_being_late_with_notification,
      penalty_for_being_late_without_notification: settings.penalty_for_being_late_without_notification,
      penalty_for_position_cancellation_on_the_position_day: settings.penalty_for_position_cancellation_on_the_position_day,
      penalty_for_position_cancellation_before_the_position_day: settings.penalty_for_position_cancellation_before_the_position_day,
      penalty_for_assigning_less_then_minimal_positions: settings.penalty_for_assigning_less_then_minimal_positions,
      hourly_rate: settings.hourly_rate,
      weekday_morning_start: settings.weekday_morning_start,
      weekday_morning_end: settings.weekday_morning_end,
      weekday_afternoon_start: settings.weekday_afternoon_start,
      weekday_afternoon_end: settings.weekday_afternoon_end,
      weekend_morning_start: settings.weekend_morning_start,
      weekend_morning_end: settings.weekend_morning_end,
      weekend_afternoon_start: settings.weekend_afternoon_start,
      weekend_afternoon_end: settings.weekend_afternoon_end,
    });
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!settings || saving) return;

    try {
      setSaving(true);
      console.log('=== SAVING SYSTEM SETTINGS ===');
      console.log('Edit data being sent:', JSON.stringify(editData, null, 2));
      const updated = await updateSystemSettings(settings.id, editData);
      console.log('Updated data received:', JSON.stringify(updated, null, 2));
      setSettings(updated);
      setEditMode(false);
      crossAlert('Uspjeh', 'Postavke sustava su ažurirane');
    } catch (error: any) {
      console.error('Error updating system settings:', error);
      crossAlert('Greška', error.response?.data?.detail || 'Nije moguće ažurirati postavke');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setEditData({});
  };

  const toggleWorkday = (day: number) => {
    const currentWorkdays = editData.workdays || [];
    if (currentWorkdays.includes(day)) {
      setEditData({
        ...editData,
        workdays: currentWorkdays.filter(d => d !== day),
      });
    } else {
      setEditData({
        ...editData,
        workdays: [...currentWorkdays, day].sort((a, b) => a - b),
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0A3323" />
      </View>
    );
  }

  if (!settings) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Nema dostupnih postavki</Text>
      </View>
    );
  }

  const displayData = editMode ? editData : settings;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps='handled'>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Postavke sustava</Text>
          {isAdmin && !editMode && (
            <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
              <Text style={styles.editButtonText}>✏️ Uredi</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Radni dani */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Radni dani</Text>
          <View style={styles.workdaysContainer}>
            {DAYS_OF_WEEK.map((dayLabel, index) => {
              const isSelected = (displayData.workdays || settings.workdays).includes(index);
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayButton,
                    isSelected && styles.dayButtonActive,
                  ]}
                  onPress={() => editMode && toggleWorkday(index)}
                  disabled={!editMode}
                >
                  <Text
                    style={[
                      styles.dayButtonText,
                      isSelected && styles.dayButtonTextActive,
                    ]}
                  >
                    {dayLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Konfiguracijski period */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Konfiguracijski period</Text>
          
          <Text style={styles.subsectionTitle}>Početak:</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Dan u tjednu:</Text>
            <Text style={styles.value}>{DAYS_OF_WEEK[settings.timing_windows.config.start.day]}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Vrijeme:</Text>
            <Text style={styles.value}>{settings.timing_windows.config.start.time}</Text>
          </View>
          
          <Text style={styles.subsectionTitle}>Kraj:</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Dan u tjednu:</Text>
            <Text style={styles.value}>{DAYS_OF_WEEK[settings.timing_windows.config.end.day]}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Vrijeme:</Text>
            <Text style={styles.value}>{settings.timing_windows.config.end.time}</Text>
          </View>
        </View>

        {/* Automatska dodjela */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤖 Automatska dodjela pozicija</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Dan u tjednu:</Text>
            <Text style={styles.value}>{DAYS_OF_WEEK[settings.day_for_assignments]}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Vrijeme:</Text>
            <Text style={styles.value}>{settings.time_of_assignments}</Text>
          </View>
        </View>

        {/* Ručno upisivanje */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ručno upisivanje pozicija</Text>
          
          <Text style={styles.subsectionTitle}>Početak:</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Dan u tjednu:</Text>
            <Text style={styles.value}>{DAYS_OF_WEEK[settings.timing_windows.manual_assignment.start.day]}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Vrijeme:</Text>
            <Text style={styles.value}>{settings.timing_windows.manual_assignment.start.time}</Text>
          </View>
          
          <Text style={styles.subsectionTitle}>Kraj:</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Dan u tjednu:</Text>
            <Text style={styles.value}>{DAYS_OF_WEEK[settings.timing_windows.manual_assignment.end.day]}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Vrijeme:</Text>
            <Text style={styles.value}>{settings.timing_windows.manual_assignment.end.time}</Text>
          </View>
        </View>

        {/* Grace period (Fer period ručnog upisivanja) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fer period ručnog upisivanja</Text>
          
          <Text style={styles.subsectionTitle}>Početak:</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Dan u tjednu:</Text>
            <Text style={styles.value}>{DAYS_OF_WEEK[settings.timing_windows.grace_period.start.day]}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Vrijeme:</Text>
            <Text style={styles.value}>{settings.timing_windows.grace_period.start.time}</Text>
          </View>
          
          <Text style={styles.subsectionTitle}>Kraj:</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Dan u tjednu:</Text>
            <Text style={styles.value}>{DAYS_OF_WEEK[settings.timing_windows.grace_period.end.day]}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Vrijeme:</Text>
            <Text style={styles.value}>{settings.timing_windows.grace_period.end.time}</Text>
          </View>
        </View>

        {/* Vrijeme života bodova */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vrijeme života bodova</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Broj tjedana:</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={String(displayData.points_life_weeks ?? settings.points_life_weeks)}
                onChangeText={(text) => setEditData({ ...editData, points_life_weeks: parseInt(text) || 0 })}
                keyboardType="numeric"
              />
            ) : (
              <Text style={styles.value}>{settings.points_life_weeks}</Text>
            )}
          </View>
        </View>

        {/* Nagrade */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nagrade</Text>
          
          <View style={styles.row}>
            <Text style={styles.label}>Završena pozicija:</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={displayData.award_for_position_completion ?? settings.award_for_position_completion}
                onChangeText={(text) => setEditData({ ...editData, award_for_position_completion: text })}
                keyboardType="decimal-pad"
              />
            ) : (
              <Text style={styles.value}>{settings.award_for_position_completion}</Text>
            )}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Završena nedjeljna pozicija:</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={displayData.award_for_sunday_position_completion ?? settings.award_for_sunday_position_completion}
                onChangeText={(text) => setEditData({ ...editData, award_for_sunday_position_completion: text })}
                keyboardType="decimal-pad"
              />
            ) : (
              <Text style={styles.value}>{settings.award_for_sunday_position_completion}</Text>
            )}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Prihvaćanje otkazane pozicije:</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={displayData.award_for_jumping_in_on_cancelled_position ?? settings.award_for_jumping_in_on_cancelled_position}
                onChangeText={(text) => setEditData({ ...editData, award_for_jumping_in_on_cancelled_position: text })}
                keyboardType="decimal-pad"
              />
            ) : (
              <Text style={styles.value}>{settings.award_for_jumping_in_on_cancelled_position}</Text>
            )}
          </View>
        </View>

        {/* Kazne */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kazne</Text>
          
          <View style={styles.row}>
            <Text style={styles.label}>Zakašnjenje s obavijesti:</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={displayData.penalty_for_being_late_with_notification ?? settings.penalty_for_being_late_with_notification}
                onChangeText={(text) => setEditData({ ...editData, penalty_for_being_late_with_notification: text })}
                keyboardType="decimal-pad"
              />
            ) : (
              <Text style={styles.value}>{settings.penalty_for_being_late_with_notification}</Text>
            )}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Zakašnjenje bez obavijesti:</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={displayData.penalty_for_being_late_without_notification ?? settings.penalty_for_being_late_without_notification}
                onChangeText={(text) => setEditData({ ...editData, penalty_for_being_late_without_notification: text })}
                keyboardType="decimal-pad"
              />
            ) : (
              <Text style={styles.value}>{settings.penalty_for_being_late_without_notification}</Text>
            )}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Otkazivanje na dan:</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={displayData.penalty_for_position_cancellation_on_the_position_day ?? settings.penalty_for_position_cancellation_on_the_position_day}
                onChangeText={(text) => setEditData({ ...editData, penalty_for_position_cancellation_on_the_position_day: text })}
                keyboardType="decimal-pad"
              />
            ) : (
              <Text style={styles.value}>{settings.penalty_for_position_cancellation_on_the_position_day}</Text>
            )}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Otkazivanje unaprijed:</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={displayData.penalty_for_position_cancellation_before_the_position_day ?? settings.penalty_for_position_cancellation_before_the_position_day}
                onChangeText={(text) => setEditData({ ...editData, penalty_for_position_cancellation_before_the_position_day: text })}
                keyboardType="decimal-pad"
              />
            ) : (
              <Text style={styles.value}>{settings.penalty_for_position_cancellation_before_the_position_day}</Text>
            )}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Premalo pozicija:</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={displayData.penalty_for_assigning_less_then_minimal_positions ?? settings.penalty_for_assigning_less_then_minimal_positions}
                onChangeText={(text) => setEditData({ ...editData, penalty_for_assigning_less_then_minimal_positions: text })}
                keyboardType="decimal-pad"
              />
            ) : (
              <Text style={styles.value}>{settings.penalty_for_assigning_less_then_minimal_positions}</Text>
            )}
          </View>
        </View>

        {/* Satnica */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Satnica</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Satnica (EUR):</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={displayData.hourly_rate ?? settings.hourly_rate}
                onChangeText={(text) => setEditData({ ...editData, hourly_rate: text })}
                keyboardType="decimal-pad"
              />
            ) : (
              <Text style={styles.value}>{settings.hourly_rate} €</Text>
            )}
          </View>
        </View>

        {/* Smjene - Radni dan */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Smjene - Radni dan</Text>
          
          <Text style={styles.subsectionTitle}>Jutarnja smjena</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Početak:</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={displayData.weekday_morning_start ?? settings.weekday_morning_start}
                onChangeText={(text) => setEditData({ ...editData, weekday_morning_start: text })}
                placeholder="HH:MM:SS"
              />
            ) : (
              <Text style={styles.value}>{settings.weekday_morning_start}</Text>
            )}
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Kraj:</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={displayData.weekday_morning_end ?? settings.weekday_morning_end}
                onChangeText={(text) => setEditData({ ...editData, weekday_morning_end: text })}
                placeholder="HH:MM:SS"
              />
            ) : (
              <Text style={styles.value}>{settings.weekday_morning_end}</Text>
            )}
          </View>

          <Text style={styles.subsectionTitle}>Popodnevna smjena</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Početak:</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={displayData.weekday_afternoon_start ?? settings.weekday_afternoon_start}
                onChangeText={(text) => setEditData({ ...editData, weekday_afternoon_start: text })}
                placeholder="HH:MM:SS"
              />
            ) : (
              <Text style={styles.value}>{settings.weekday_afternoon_start}</Text>
            )}
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Kraj:</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={displayData.weekday_afternoon_end ?? settings.weekday_afternoon_end}
                onChangeText={(text) => setEditData({ ...editData, weekday_afternoon_end: text })}
                placeholder="HH:MM:SS"
              />
            ) : (
              <Text style={styles.value}>{settings.weekday_afternoon_end}</Text>
            )}
          </View>
        </View>

        {/* Smjene - Vikend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Smjene - Vikend</Text>
          
          <Text style={styles.subsectionTitle}>Jutarnja smjena</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Početak:</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={displayData.weekend_morning_start ?? settings.weekend_morning_start}
                onChangeText={(text) => setEditData({ ...editData, weekend_morning_start: text })}
                placeholder="HH:MM:SS"
              />
            ) : (
              <Text style={styles.value}>{settings.weekend_morning_start}</Text>
            )}
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Kraj:</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={displayData.weekend_morning_end ?? settings.weekend_morning_end}
                onChangeText={(text) => setEditData({ ...editData, weekend_morning_end: text })}
                placeholder="HH:MM:SS"
              />
            ) : (
              <Text style={styles.value}>{settings.weekend_morning_end}</Text>
            )}
          </View>

          <Text style={styles.subsectionTitle}>Popodnevna smjena</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Početak:</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={displayData.weekend_afternoon_start ?? settings.weekend_afternoon_start}
                onChangeText={(text) => setEditData({ ...editData, weekend_afternoon_start: text })}
                placeholder="HH:MM:SS"
              />
            ) : (
              <Text style={styles.value}>{settings.weekend_afternoon_start}</Text>
            )}
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Kraj:</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={displayData.weekend_afternoon_end ?? settings.weekend_afternoon_end}
                onChangeText={(text) => setEditData({ ...editData, weekend_afternoon_end: text })}
                placeholder="HH:MM:SS"
              />
            ) : (
              <Text style={styles.value}>{settings.weekend_afternoon_end}</Text>
            )}
          </View>
        </View>

        {/* Neradni dani */}
        <View style={styles.section}>
          <View style={styles.nwdHeader}>
            <Text style={styles.sectionTitle}>Neradni dani</Text>
            {isAdmin && (
              <TouchableOpacity
                style={styles.addNwdButton}
                onPress={() => setShowCreateNwdModal(true)}
              >
                <Text style={styles.addNwdButtonText}>+ Dodaj</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {nonWorkingDaysLoading ? (
            <ActivityIndicator size="small" color="#0A3323" />
          ) : nonWorkingDays.length === 0 ? (
            <Text style={styles.emptyNwdText}>Nema budućih neradnih dana</Text>
          ) : (
            nonWorkingDays.map((nwd) => (
              <View key={nwd.id} style={styles.nwdItem}>
                <View style={styles.nwdInfo}>
                  <Text style={styles.nwdDate}>{formatNwdDate(nwd.date)}</Text>
                  <Text style={styles.nwdShift}>{getShiftLabel(nwd)}</Text>
                </View>
                <Text style={styles.nwdReason}>{nwd.reason}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Create Non-Working Day Modal */}
      <Modal visible={showCreateNwdModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Dodaj neradni dan</Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>Datum *</Text>
              {Platform.OS === 'web' ? (
                <View style={{ position: 'relative' }}>
                  <TouchableOpacity style={styles.datePickerButton} onPress={() => {}}>
                    <Text style={styles.datePickerButtonText}>
                      {nwdDate.toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </Text>
                    <Text style={styles.datePickerArrow}>📅</Text>
                  </TouchableOpacity>
                  <input
                    type="date"
                    value={formatDateLocal(nwdDate)}
                    min={formatDateLocal(new Date())}
                    onChange={(e) => {
                      const d = new Date(e.target.value + 'T00:00:00');
                      if (!isNaN(d.getTime())) setNwdDate(d);
                    }}
                    style={{
                      position: 'absolute',
                      top: 0, left: 0, bottom: 0, right: 0,
                      opacity: 0,
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => setShowNwdDatePicker(true)}
                  >
                    <Text style={styles.datePickerButtonText}>
                      {nwdDate.toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </Text>
                    <Text style={styles.datePickerArrow}>📅</Text>
                  </TouchableOpacity>

                  {showNwdDatePicker && (
                    <DateTimePicker
                      value={nwdDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      minimumDate={new Date()}
                      onChange={(event, selectedDate) => {
                        setShowNwdDatePicker(Platform.OS === 'ios');
                        if (selectedDate) {
                          setNwdDate(selectedDate);
                        }
                      }}
                    />
                  )}
                </>
              )}
              
              <Text style={styles.modalLabel}>Razlog *</Text>
              <TextInput
                style={styles.modalInput}
                value={nwdReason}
                onChangeText={setNwdReason}
                placeholder="npr. Sigurnosne vježbe"
                placeholderTextColor="#A6C27A"
                autoComplete="off"
                autoCorrect={false}
              />
              
              <Text style={styles.modalLabel}>Cijeli dan?</Text>
              <View style={styles.switchRow}>
                <TouchableOpacity
                  style={[styles.switchButton, nwdIsFullDay && styles.switchButtonActive]}
                  onPress={() => setNwdIsFullDay(true)}
                >
                  <Text style={[styles.switchButtonText, nwdIsFullDay && styles.switchButtonTextActive]}>
                    Da
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.switchButton, !nwdIsFullDay && styles.switchButtonActive]}
                  onPress={() => setNwdIsFullDay(false)}
                >
                  <Text style={[styles.switchButtonText, !nwdIsFullDay && styles.switchButtonTextActive]}>
                    Ne
                  </Text>
                </TouchableOpacity>
              </View>
              
              {!nwdIsFullDay && (
                <>
                  <Text style={styles.modalLabel}>Period dana</Text>
                  <View style={styles.switchRow}>
                    <TouchableOpacity
                      style={[styles.switchButton, nwdShift === 'MORNING' && styles.switchButtonActive]}
                      onPress={() => setNwdShift('MORNING')}
                    >
                      <Text style={[styles.switchButtonText, nwdShift === 'MORNING' && styles.switchButtonTextActive]}>
                        Jutro
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.switchButton, nwdShift === 'AFTERNOON' && styles.switchButtonActive]}
                      onPress={() => setNwdShift('AFTERNOON')}
                    >
                      <Text style={[styles.switchButtonText, nwdShift === 'AFTERNOON' && styles.switchButtonTextActive]}>
                        Popodne
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => { setShowCreateNwdModal(false); resetNwdForm(); }}
              >
                <Text style={styles.modalCancelButtonText}>Odustani</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, creatingNwd && styles.buttonDisabled]}
                onPress={handleCreateNwd}
                disabled={creatingNwd}
              >
                {creatingNwd ? (
                  <ActivityIndicator size="small" color="#A6C27A" />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>Dodaj</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Action buttons za admin edit mode */}
      {isAdmin && editMode && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.footerButton, styles.cancelButton]}
            onPress={handleCancel}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Odustani</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.footerButton, styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>{saving ? 'Spremanje...' : '✓ Spremi'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4D5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F4D5',
  },
  errorText: {
    fontSize: 16,
    color: '#0A3323',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0A3323',
  },
  editButton: {
    backgroundColor: '#0A3323',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#A6C27A',
    fontWeight: '600',
    fontSize: 15,
  },
  section: {
    backgroundColor: '#A6C27A',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A3323',
    marginBottom: 15,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A3323',
    marginTop: 10,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
    color: '#0A3323',
    flex: 1,
  },
  value: {
    fontSize: 15,
    color: '#0A3323',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#0A3323',
    borderRadius: 6,
    padding: 8,
    fontSize: 15,
    backgroundColor: '#F7F4D5',
    color: '#0A3323',
    textAlign: 'right',
  },
  workdaysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    flex: 1,
    minWidth: 45,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0A3323',
    alignItems: 'center',
    backgroundColor: '#F7F4D5',
  },
  dayButtonActive: {
    backgroundColor: '#0A3323',
    borderColor: '#0A3323',
  },
  dayButtonText: {
    fontSize: 14,
    color: '#D3968C',
    fontWeight: '600',
  },
  dayButtonTextActive: {
    color: '#A6C27A',
  },
  footer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#A6C27A',
    borderTopWidth: 1,
    borderTopColor: '#0A3323',
    gap: 10,
  },
  footerButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F7F4D5',
  },
  cancelButtonText: {
    color: '#0A3323',
    fontWeight: '600',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#0A3323',
    borderWidth: 1,
    borderColor: '#0A3323',
  },
  saveButtonDisabled: {
    backgroundColor: '#D3968C',
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#A6C27A',
    fontWeight: '600',
    fontSize: 16,
  },
  // Non-working days styles
  nwdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  addNwdButton: {
    backgroundColor: '#0A3323',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0A3323',
  },
  addNwdButtonText: {
    color: '#A6C27A',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyNwdText: {
    color: '#0A3323',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 10,
  },
  nwdItem: {
    backgroundColor: '#F7F4D5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#105666',
  },
  nwdInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nwdDate: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A3323',
  },
  nwdShift: {
    fontSize: 14,
    color: '#105666',
    fontStyle: 'italic',
  },
  nwdReason: {
    fontSize: 14,
    color: '#0A3323',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 51, 35, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#F7F4D5',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#A6C27A',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A3323',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0A3323',
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#A6C27A',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#0A3323',
    color: '#A6C27A',
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A6C27A',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#0A3323',
  },
  datePickerButtonText: {
    fontSize: 15,
    color: '#A6C27A',
  },
  datePickerArrow: {
    fontSize: 18,
  },
  switchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  switchButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A6C27A',
    alignItems: 'center',
    backgroundColor: '#F7F4D5',
  },
  switchButtonActive: {
    backgroundColor: '#0A3323',
    borderColor: '#A6C27A',
  },
  switchButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D3968C',
  },
  switchButtonTextActive: {
    color: '#A6C27A',
  },
  modalFooter: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F7F4D5',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A6C27A',
  },
  modalCancelButtonText: {
    color: '#0A3323',
    fontWeight: '600',
    fontSize: 16,
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: '#0A3323',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSubmitButtonText: {
    color: '#A6C27A',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
