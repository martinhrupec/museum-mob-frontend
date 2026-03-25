import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { ActionInfo, getActionModalTitle } from '../utils/positionActions';
import { AssignmentPosition, PositionAction } from '../types';

interface PositionActionsModalProps {
  visible: boolean;
  position: AssignmentPosition | null;
  actions: ActionInfo[];
  onClose: () => void;
  onActionSelect: (action: PositionAction) => void;
}

export default function PositionActionsModal({
  visible,
  position,
  actions,
  onClose,
  onActionSelect,
}: PositionActionsModalProps) {
  if (!position) return null;

  const title = getActionModalTitle(position);

  const handleActionPress = (actionInfo: ActionInfo) => {
    if (actionInfo.disabled && actionInfo.disabledMessage) {
      // Za disabled akcije (npr. dvoboj), prikaži poruku
      onActionSelect(actionInfo.action);
    } else if (!actionInfo.disabled) {
      onActionSelect(actionInfo.action);
    }
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
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {position.guard && (
              <Text style={styles.subtitle}>
                Trenutno: {position.guard.full_name}
              </Text>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            {actions.length === 0 ? (
              <Text style={styles.noActions}>Nema dostupnih akcija</Text>
            ) : (
              actions.map((actionInfo, index) => (
                <TouchableOpacity
                  key={actionInfo.action}
                  style={[
                    styles.actionButton,
                    { backgroundColor: actionInfo.color },
                    actionInfo.disabled && styles.actionButtonDisabled,
                    index === actions.length - 1 && styles.lastActionButton,
                  ]}
                  onPress={() => handleActionPress(actionInfo)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionButtonText}>{actionInfo.label}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Cancel button */}
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Zatvori</Text>
          </TouchableOpacity>
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
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0A3323',
    textAlign: 'center',
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 14,
    color: '#0A3323',
    marginTop: 4,
  },
  actionsContainer: {
    gap: 10,
  },
  actionButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  lastActionButton: {
    marginBottom: 0,
  },
  actionButtonText: {
    color: '#F7F4D5',
    fontSize: 15,
    fontWeight: '600',
  },
  noActions: {
    textAlign: 'center',
    color: '#0A3323',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#A6C27A',
  },
  cancelButtonText: {
    color: '#D3968C',
    fontSize: 15,
    fontWeight: '600',
  },
});
