import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { setStatusBarStyle } from 'expo-status-bar';

// Set the status bar icon style ('light' | 'dark') while a screen is focused.
// Lets dark-header screens (Home, Profile) use light icons without affecting
// the light-background tabs.
export function useStatusBar(style) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style, true);
    }, [style])
  );
}
