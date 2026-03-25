import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

interface BulkCancelModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (startDate: string, endDate: string) => Promise<void>;
  loading?: boolean;
}

const formatDateForDisplay = (date: Date): string => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

const formatDateForApi = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function BulkCancelModal({
  visible,
  onClose,
  onConfirm,
  loading = false,
}: BulkCancelModalProps) {
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const handleStartDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }
    if (selectedDate) {
      setStartDate(selectedDate);
      // Ako je end date prije start date, postavi ga na isti dan
      if (endDate < selectedDate) {
        setEndDate(selectedDate);
      }
    }
  };

  const handleEndDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndPicker(false);
    }
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  const handleConfirm = async () => {
    const startStr = formatDateForApi(startDate);
    const endStr = formatDateForApi(endDate);
    await onConfirm(startStr, endStr);
  };

  const isValid = endDate >= startDate;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={() => {}}>
          {/* Title */}
          <Text style={styles.title}>Otkaži više smjena</Text>
          <Text style={styles.description}>
            Odaberi raspon datuma za otkazivanje svih tvojih smjena.
          </Text>

          {/* Start Date */}
          <View style={styles.dateSection}>
            <Text style={styles.dateLabel}>Od datuma:</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={formatDateForApi(startDate)}
                min={formatDateForApi(new Date())}
                onChange={(e) => {
                  const d = new Date(e.target.value + 'T00:00:00');
                  if (!isNaN(d.getTime())) {
                    setStartDate(d);
                    if (endDate < d) setEndDate(d);
                  }
                }}
                disabled={loading}
                style={{
                  padding: 14,
                  borderRadius: 8,
                  backgroundColor: '#0A3323',
                  color: '#A6C27A',
                  border: 'none',
                  fontSize: 16,
                  textAlign: 'center' as const,
                }}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowStartPicker(true)}
                  disabled={loading}
                >
                  <Text style={styles.dateButtonText}>{formatDateForDisplay(startDate)}</Text>
                </TouchableOpacity>
                {showStartPicker && (
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleStartDateChange}
                    minimumDate={new Date()}
                  />
                )}
              </>
            )}
          </View>

          {/* End Date */}
          <View style={styles.dateSection}>
            <Text style={styles.dateLabel}>Do datuma:</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={formatDateForApi(endDate)}
                min={formatDateForApi(startDate)}
                onChange={(e) => {
                  const d = new Date(e.target.value + 'T00:00:00');
                  if (!isNaN(d.getTime())) setEndDate(d);
                }}
                disabled={loading}
                style={{
                  padding: 14,
                  borderRadius: 8,
                  backgroundColor: '#0A3323',
                  color: '#A6C27A',
                  border: 'none',
                  fontSize: 16,
                  textAlign: 'center' as const,
                }}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowEndPicker(true)}
                  disabled={loading}
                >
                  <Text style={styles.dateButtonText}>{formatDateForDisplay(endDate)}</Text>
                </TouchableOpacity>
                {showEndPicker && (
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleEndDateChange}
                    minimumDate={startDate}
                  />
                )}
              </>
            )}
          </View>

          {/* Validation message */}
          {!isValid && (
            <Text style={styles.errorText}>
              Krajnji datum mora biti jednak ili veći od početnog.
            </Text>
          )}

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Odustani</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmButton, (!isValid || loading) && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={!isValid || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>Potvrdi</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 51, 35, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#F7F4D5',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 340,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#A6C27A',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0A3323',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#0A3323',
    textAlign: 'center',
    marginBottom: 20,
  },
  dateSection: {
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0A3323',
    marginBottom: 8,
  },
  dateButton: {
    backgroundColor: '#0A3323',
    padding: 14,
    borderRadius: 8,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#A6C27A',
    textAlign: 'center',
  },
  errorText: {
    color: '#D3968C',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#A6C27A',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#0A3323',
    fontSize: 15,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#0A3323',
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#D3968C',
  },
  confirmButtonText: {
    color: '#A6C27A',
    fontSize: 15,
    fontWeight: '600',
  },
});
