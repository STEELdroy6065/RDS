import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Pulse from '../components/Pulse';
import { useStatusBar } from '../components/useStatusBar';
import { colors, spacing, radius, type } from '../theme';
import { alerts } from '../data/mock';

const KIND_META = {
  vote: { icon: 'bar-chart-outline', bg: colors.primarySoft, fg: colors.primary },
  announcement: { icon: 'megaphone-outline', bg: colors.accentSoft, fg: colors.accent },
  attendance: { icon: 'checkmark-done-outline', bg: colors.successSoft, fg: colors.success },
};

export default function AlertsScreen() {
  useStatusBar('light');
  const unread = alerts.filter((a) => a.unread).length;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <Text style={styles.title}>Alerts</Text>
          {unread > 0 ? (
            <View style={styles.badge}>
              <Pulse color={colors.onPrimary} size={7} />
              <Text style={styles.badgeText}>{unread} new</Text>
            </View>
          ) : null}
        </View>

        {alerts.map((a, i) => {
          const meta = KIND_META[a.kind] || KIND_META.announcement;
          return (
            <View
              key={a.id}
              style={[styles.row, i < alerts.length - 1 && styles.rowBorder]}
            >
              <View style={[styles.icon, { backgroundColor: meta.bg }]}>
                <Ionicons name={meta.icon} size={18} color={meta.fg} />
              </View>
              <View style={styles.body}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {a.title}
                </Text>
                <Text style={styles.itemBody} numberOfLines={1}>
                  {a.body}
                </Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.time}>{a.time}</Text>
                {a.unread ? <Pulse color={colors.accent} size={7} style={styles.dot} /> : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...type.display, color: colors.ink },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  badgeText: { ...type.label, fontSize: 10, color: colors.onPrimary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, marginLeft: spacing.md, marginRight: spacing.sm },
  itemTitle: { ...type.bodyStrong, color: colors.ink },
  itemBody: { ...type.caption, color: colors.muted, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 6 },
  time: { ...type.caption, color: colors.muted, fontSize: 11 },
  dot: {},
});
