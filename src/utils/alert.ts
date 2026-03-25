import { Alert, Platform } from 'react-native';

type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

/**
 * Cross-platform alert that works on both native and web.
 * On native: delegates to Alert.alert
 * On web: uses window.alert / window.confirm
 */
export function crossAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[]
): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  // Web implementation
  const fullMessage = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    // Simple alert with OK button
    window.alert(fullMessage);
    const okButton = buttons?.[0];
    okButton?.onPress?.();
    return;
  }

  // Find cancel and confirm buttons
  const cancelButton = buttons.find(b => b.style === 'cancel');
  const actionButton = buttons.find(b => b.style !== 'cancel') || buttons[buttons.length - 1];

  const confirmed = window.confirm(fullMessage);
  if (confirmed) {
    actionButton?.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}
