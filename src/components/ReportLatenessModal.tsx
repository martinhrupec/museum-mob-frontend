import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { AssignmentPosition } from '../types';
import { getActionModalTitle } from '../utils/positionActions';

interface ReportLatenessModalProps {
  visible: boolean;
  position: AssignmentPosition | null;
  onClose: () => void;
  onConfirm: (estimatedDelayMinutes?: number) => Promise<void>;
  loading?: boolean;
}

export default function ReportLatenessModal({
  visible,
  position,
  onClose,
  onConfirm,
  loading = false,
}: ReportLatenessModalProps) {
  const [delayMinutes, setDelayMinutes] = useState('');

  if (!position) return null;

  const title = getActionModalTitle(position);

  const handleConfirm = async () => {
    const minutes = delayMinutes.trim() ? parseInt(delayMinutes, 10) : undefined;
    await onConfirm(minutes);
  };

  const handleDelayChange = (text: string) => {
    // Dozvoli samo brojke
    const numericText = text.replace(/[^0-9]/g, '');
    setDelayMinutes(numericText);
  };

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
          <Text style={styles.title}>Prijavi kašnjenje</Text>
          <Text style={styles.positionInfo}>{title}</Text>

          {/* Description */}
          <Text style={styles.description}>
            Prijavi svoje kašnjenje kako bi sustav mogao obavijestiti nadređene
            i eventualno pronaći zamjenu.
          </Text>

          {/* Delay input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>
              Procijenjeno kašnjenje (opcionalno):
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={delayMinutes}
                onChangeText={handleDelayChange}
                placeholder="15"
                keyboardType="number-pad"
                maxLength={3}
                editable={!loading}
              />
              <Text style={styles.inputSuffix}>minuta</Text>
            </View>
          </View>

          {/* Warning */}
          <View style={styles.warningContainer}>
            <Text style={styles.warningText}>
              ⚠️ Prijava kašnjenja će rezultirati kaznenim bodovima.
            </Text>
          </View>

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
              style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>Prijavi</Text>
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
    borderColor: '#839958',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0A3323',
    textAlign: 'center',
    marginBottom: 4,
  },
  positionInfo: {
    fontSize: 14,
    color: '#839958',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  description: {
    fontSize: 14,
    color: '#839958',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0A3323',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#0A3323',
    padding: 14,
    borderRadius: 8,
    fontSize: 16,
    color: '#839958',
  },
  inputSuffix: {
    marginLeft: 12,
    fontSize: 14,
    color: '#839958',
  },
  warningContainer: {
    backgroundColor: '#D3968C',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  warningText: {
    fontSize: 13,
    color: '#F7F4D5',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#839958',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#839958',
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
    color: '#839958',
    fontSize: 15,
    fontWeight: '600',
  },
});
