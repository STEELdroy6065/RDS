import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import RootNavigator from './src/navigation/RootNavigator';
import SplashScreen from './src/screens/onboarding/SplashScreen';
import { SessionProvider } from './src/state/session';
import { GroupsProvider } from './src/state/groups';
import { VotesProvider } from './src/state/votes';
import { AttendanceProvider } from './src/state/attendance';
import { NotificationsProvider } from './src/state/notifications';

export default function App() {
  // Preload the icon font so glyphs render on first paint (otherwise icons
  // show as blank squares on some devices).
  const [fontsLoaded] = useFonts(Ionicons.font);

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <SplashScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SessionProvider>
        <GroupsProvider>
          <VotesProvider>
            <AttendanceProvider>
              <NotificationsProvider>
                <RootNavigator />
              </NotificationsProvider>
            </AttendanceProvider>
          </VotesProvider>
        </GroupsProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
