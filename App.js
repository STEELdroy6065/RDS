import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { SessionProvider } from './src/state/session';
import { VotesProvider } from './src/state/votes';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SessionProvider>
        <VotesProvider>
          <RootNavigator />
        </VotesProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
