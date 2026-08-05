import { Alert, Platform } from 'react-native';

// Cross-platform dialogs. React Native's Alert.alert is a no-op on
// react-native-web, so on web we fall back to the browser's native
// window.confirm / window.alert.

export function confirm({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
}) {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== 'undefined' && window.confirm(text)) {
      onConfirm && onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    {
      text: confirmLabel,
      style: destructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
}

export function notify({ title, message, dismissLabel = 'Done', onDismiss }) {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== 'undefined') window.alert(text);
    onDismiss && onDismiss();
    return;
  }

  Alert.alert(title, message, [{ text: dismissLabel, onPress: onDismiss }]);
}
