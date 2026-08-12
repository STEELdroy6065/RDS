import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SplashScreen from '../screens/onboarding/SplashScreen';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import AuthScreen from '../screens/onboarding/AuthScreen';
import ForgotPasswordScreen from '../screens/onboarding/ForgotPasswordScreen';
import SetNewPasswordScreen from '../screens/onboarding/SetNewPasswordScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import HomeScreen from '../screens/HomeScreen';
import AlertsScreen from '../screens/AlertsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
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
import LeaveScreen from '../screens/modules/LeaveScreen';
import RecordScreen from '../screens/modules/RecordScreen';
import WeekScreen from '../screens/modules/WeekScreen';
import DigestScreen from '../screens/modules/DigestScreen';
import GuardianGroupScreen from '../screens/modules/GuardianGroupScreen';
import GuardiansScreen from '../screens/modules/GuardiansScreen';
import ReportedPostsScreen from '../screens/modules/ReportedPostsScreen';
import MediaLinksScreen from '../screens/modules/MediaLinksScreen';
import GroupPermissionsScreen from '../screens/modules/GroupPermissionsScreen';
import GroupRail from '../components/GroupRail';

import { colors } from '../theme';
import { useSession } from '../state/session';

const MainStack = createNativeStackNavigator();
const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.ink,
    border: colors.border,
    primary: colors.primary,
  },
};

// The three top-level views live in their own stack so the group rail stays
// mounted across them. Home is the default; Alerts is reached via the bell and
// Profile via the avatar menu (no bottom tab bar).
function MainStackScreens() {
  return (
    <MainStack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
    >
      <MainStack.Screen name="Home" component={HomeScreen} />
      <MainStack.Screen name="Alerts" component={AlertsScreen} />
      <MainStack.Screen name="Profile" component={ProfileScreen} />
    </MainStack.Navigator>
  );
}

// Discord-style shell: persistent group rail on the left, the main content
// (Home / Alerts / Profile) on the right.
function MainShell() {
  return (
    <View style={styles.shell}>
      <GroupRail />
      <View style={styles.shellContent}>
        <MainStackScreens />
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
            <Stack.Screen name="Main" component={MainShell} />
            <Stack.Screen name="NewGroup" component={NewGroupScreen} />
            <Stack.Screen name="ScanGroup" component={ScanGroupScreen} />
            <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
            <Stack.Screen name="Feed" component={FeedScreen} />
            <Stack.Screen name="ReportedPosts" component={ReportedPostsScreen} />
            <Stack.Screen name="MediaLinks" component={MediaLinksScreen} />
            <Stack.Screen name="GroupPermissions" component={GroupPermissionsScreen} />
            <Stack.Screen name="Votes" component={VotesScreen} />
            <Stack.Screen name="VoteDetail" component={VoteDetailScreen} />
            <Stack.Screen name="NewVote" component={NewVoteScreen} />
            <Stack.Screen name="Members" component={MembersScreen} />
            <Stack.Screen name="Attendance" component={AttendanceScreen} />
            <Stack.Screen name="MarkAttendance" component={MarkAttendanceScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="Leave" component={LeaveScreen} />
            <Stack.Screen name="Record" component={RecordScreen} />
            <Stack.Screen name="Week" component={WeekScreen} />
            <Stack.Screen name="Digest" component={DigestScreen} />
            <Stack.Screen name="GuardianGroup" component={GuardianGroupScreen} />
            <Stack.Screen name="Guardians" component={GuardiansScreen} />
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
