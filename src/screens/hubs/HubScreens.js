import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import Avatar from '../../components/Avatar';
import { useStatusBar } from '../../components/useStatusBar';
import { colors, spacing, radius, type } from '../../theme';
import { useSession } from '../../state/session';
import { useGroups } from '../../state/groups';
import { useHomeSignals } from '../../lib/homeSignals';

// A shared "list of your groups" hub used by the Attend / Chat / Record tabs.
// Each mode routes a row to the right destination and shows a fitting subline.
function HubList({ navigation, mode, kicker, title, empty }) {
  useStatusBar('dark');
  const { user } = useSession();
  const { groups } = useGroups();
  const { statusByGroup } = useHomeSignals(groups);

  function open(g) {
    if (g.role === 'Guardian') {
      navigation.navigate('GuardianGroup', { groupId: g.id, groupName: g.name });
      return;
    }
    if (mode === 'chat') navigation.navigate('Feed', { groupId: g.id, groupName: g.name });
    else if (mode === 'attend') navigation.navigate('Attendance', { groupId: g.id, groupName: g.name });
    else if (mode === 'record')
      navigation.navigate('RecordDetail', {
        groupId: g.id,
        groupName: g.name,
        studentId: user.id,
        studentName: user.name,
      });
  }

  function subline(g) {
    const s = statusByGroup[g.id];
    if (mode === 'chat') return (s && s.text) || 'No new messages';
    if (mode === 'attend') {
      if (s && s.attendanceDue) return 'Attendance due';
      if (s && s.attendanceUnresolved) return 'No roll yet today';
      return 'Roll marked';
    }
    return 'View your record';
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.title}>{title}</Text>

        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="albums-outline" size={30} color={colors.muted} />
            <Text style={styles.emptyText}>{empty}</Text>
          </View>
        ) : (
          groups.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => open(g)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Avatar emoji={g.emoji} name={g.name} size={46} />
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>{g.name}</Text>
                <Text style={styles.sub} numberOfLines={1}>{subline(g)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

export function AttendHubScreen({ navigation }) {
  return (
    <HubList
      navigation={navigation}
      mode="attend"
      kicker="ATTENDANCE"
      title="Take the roll"
      empty="Join a group to see its attendance."
    />
  );
}

export function ChatHubScreen({ navigation }) {
  return (
    <HubList
      navigation={navigation}
      mode="chat"
      kicker="CHATS"
      title="Your groups"
      empty="Join a group to start chatting."
    />
  );
}

export function RecordHubScreen({ navigation }) {
  return (
    <HubList
      navigation={navigation}
      mode="record"
      kicker="PARTICIPATION"
      title="Your record"
      empty="Your record builds as you attend."
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  kicker: { ...type.monoLabel, fontSize: 11, letterSpacing: 1.2, color: colors.muted },
  title: { ...type.display, fontSize: 28, color: colors.ink, marginTop: 6, marginBottom: spacing.lg },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyText: { ...type.body, color: colors.muted, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  body: { flex: 1, marginLeft: spacing.md, marginRight: spacing.sm },
  name: { ...type.heading, color: colors.ink },
  sub: { ...type.caption, color: colors.muted, marginTop: 3 },
});
