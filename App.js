import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { SessionProvider } from './src/state/session';
import { GroupsProvider } from './src/state/groups';
import { VotesProvider } from './src/state/votes';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SessionProvider>
        <GroupsProvider>
          <VotesProvider>
            <RootNavigator />
          </VotesProvider>
        </GroupsProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
