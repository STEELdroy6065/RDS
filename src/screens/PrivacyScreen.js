import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Header from '../components/Header';
import { colors, spacing, radius, type } from '../theme';

const COLLECTED = [
  { icon: 'person-outline', label: 'Your name and email', detail: 'So you can log in and others can see who posted or voted.' },
  { icon: 'people-outline', label: 'Your group memberships', detail: 'Which groups you belong to and your role in each.' },
  { icon: 'chatbubbles-outline', label: 'Your posts', detail: 'What you share in a group’s feed.' },
  { icon: 'bar-chart-outline', label: 'Your votes', detail: 'Which option you picked in a group poll — visible per the poll’s settings.' },
  { icon: 'calendar-outline', label: 'Attendance records', detail: 'Whether you were marked present, and check-ins for your groups.' },
];

export default function PrivacyScreen({ navigation }) {
  return (
    <Screen>
      <Header title="Privacy" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Your data, in plain language</Text>
        <Text style={styles.intro}>
          Synq only collects what it needs to run your groups. We don’t sell your
          data or use it for advertising. Here’s exactly what’s stored:
        </Text>

        <Card padded={false} style={styles.list}>
          {COLLECTED.map((item, i) => (
            <View
              key={item.label}
              style={[styles.row, i < COLLECTED.length - 1 && styles.rowBorder]}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={item.icon} size={18} color={colors.primary} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowDetail}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </Card>

        <Text style={styles.sectionTitle}>How it’s used</Text>
        <Text style={styles.para}>
          Your information is used only to make the app work — showing you your
          groups, letting you post and vote, and keeping attendance. Other
          members can see what you’d expect them to: your name, your posts, and
          your votes and attendance according to each group’s settings.
        </Text>

        <Text style={styles.sectionTitle}>Who can see what</Text>
        <Text style={styles.para}>
          Data is scoped to your groups. People who aren’t in a group can’t see
          that group’s posts, votes, or attendance. Group Admins and Captains
          can moderate content (for example, removing a reported post).
        </Text>

        <Text style={styles.sectionTitle}>Your control</Text>
        <Text style={styles.para}>
          You can log out any time from your Profile. This is an early version of
          Synq; this notice explains current behavior in plain terms and isn’t a
          formal legal agreement.
        </Text>

        <Text style={styles.footer}>Synq · Privacy notice</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: { ...type.title, color: colors.ink, marginBottom: spacing.sm },
  intro: { ...type.body, color: colors.inkSoft, lineHeight: 22, marginBottom: spacing.xl },
  list: { marginBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, marginLeft: spacing.md },
  rowLabel: { ...type.bodyStrong, color: colors.ink },
  rowDetail: { ...type.caption, color: colors.muted, marginTop: 2, lineHeight: 18 },
  sectionTitle: { ...type.heading, color: colors.ink, marginBottom: spacing.sm },
  para: {
    ...type.body,
    color: colors.inkSoft,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  footer: {
    ...type.caption,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
