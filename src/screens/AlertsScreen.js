import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Pulse from '../components/Pulse';
import { useStatusBar } from '../components/useStatusBar';
import { colors, spacing, radius, type } from '../theme';
import { alerts } from '../data/mock';

const KIND_META = {
  vote: { icon: 'bar-chart', bg: colors.primarySoft, fg: colors.primary },
  announcement: { icon: 'megaphone', bg: colors.accentSoft, fg: colors.accent },
  attendance: { icon: 'checkmark-done', bg: colors.successSoft, fg: colors.success },
};

export default function AlertsScreen() {
  useStatusBar('dark');
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

        {alerts.map((a) => {
          const meta = KIND_META[a.kind] || KIND_META.announcement;
          return (
            <Card key={a.id} style={styles.item} onPress={() => {}}>
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon} size={18} color={meta.fg} />
                </View>
                <View style={styles.body}>
                  <View style={styles.titleRow}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {a.title}
                    </Text>
                    {a.unread ? (
                      <Pulse color={colors.accent} size={7} style={styles.unreadPulse} />
                    ) : null}
                  </View>
                  <Text style={styles.itemBody} numberOfLines={2}>
                    {a.body}
                  </Text>
                  <Text style={styles.time}>{a.time}</Text>
                </View>
              </View>
            </Card>
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
    paddingBottom: spacing.xxl,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...type.display,
    color: colors.ink,
  },
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
  badgeText: {
    ...type.label,
    fontSize: 10,
    color: colors.onPrimary,
  },
  item: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    marginLeft: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTitle: {
    ...type.bodyStrong,
    color: colors.ink,
    flexShrink: 1,
  },
  unreadPulse: {
    marginLeft: spacing.sm,
  },
  itemBody: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: 3,
    lineHeight: 18,
  },
  time: {
    ...type.caption,
    color: colors.muted,
    marginTop: 6,
  },
});
