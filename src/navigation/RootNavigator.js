import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import SplashScreen from '../screens/onboarding/SplashScreen';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import AuthScreen from '../screens/onboarding/AuthScreen';
import ForgotPasswordScreen from '../screens/onboarding/ForgotPasswordScreen';
import SetNewPasswordScreen from '../screens/onboarding/SetNewPasswordScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import HomeScreen from '../screens/HomeScreen';
import AlertsScreen from '../screens/AlertsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import NewGroupScreen from '../screens/NewGroupScreen';
import ScanGroupScreen from '../screens/ScanGroupScreen';
import FeedScreen from '../screens/modules/FeedScreen';
import VotesScreen from '../screens/modules/VotesScreen';
import VoteDetailScreen from '../screens/modules/VoteDetailScreen';
import NewVoteScreen from '../screens/modules/NewVoteScreen';
import MembersScreen from '../screens/modules/MembersScreen';
import AttendanceScreen from '../screens/modules/AttendanceScreen';
import MarkAttendanceScreen from '../screens/modules/MarkAttendanceScreen';
import ReportedPostsScreen from '../screens/modules/ReportedPostsScreen';
import GroupRail from '../components/GroupRail';
import FloatingTabBar from '../components/FloatingTabBar';

import { colors } from '../theme';
import { useSession } from '../state/session';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.ink,
    border: colors.border,
    primary: colors.primary,
  },
};

function Tabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// Discord-style shell: persistent group rail on the left, the tabbed content
// (with its floating pill bar) on the right.
function MainShell() {
  return (
    <View style={styles.shell}>
      <GroupRail />
      <View style={styles.shellContent}>
        <Tabs />
      </View>
    </View>
  );
}

export default function RootNavigator() {
  const { session, initializing, passwordRecovery } = useSession();

  // Hold on the branded splash until the persisted session is restored.
  if (initializing) return <SplashScreen />;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {passwordRecovery ? (
          // Arrived via the reset-password deep link — set a new password.
          <Stack.Screen name="SetNewPassword" component={SetNewPasswordScreen} />
        ) : session ? (
          <>
            <Stack.Screen name="Tabs" component={MainShell} />
            <Stack.Screen name="NewGroup" component={NewGroupScreen} />
            <Stack.Screen name="ScanGroup" component={ScanGroupScreen} />
            <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
            <Stack.Screen name="Feed" component={FeedScreen} />
            <Stack.Screen name="ReportedPosts" component={ReportedPostsScreen} />
            <Stack.Screen name="Votes" component={VotesScreen} />
            <Stack.Screen name="VoteDetail" component={VoteDetailScreen} />
            <Stack.Screen name="NewVote" component={NewVoteScreen} />
            <Stack.Screen name="Members" component={MembersScreen} />
            <Stack.Screen name="Attendance" component={AttendanceScreen} />
            <Stack.Screen name="MarkAttendance" component={MarkAttendanceScreen} />
            <Stack.Screen name="PrivacyNotice" component={PrivacyScreen} />
          </>
        ) : (
          <>
            {/* Unauthenticated onboarding flow. */}
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="PrivacyNotice" component={PrivacyScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  shellContent: { flex: 1 },
});
