import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Share,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import Avatar from '../../components/Avatar';
import { colors, spacing, radius, type, monoFamily } from '../../theme';
import { useGroups } from '../../state/groups';
import { buildDigest, digestAsText } from '../../lib/digest';

export default function DigestScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const { membersForGroup } = useGroups();
  const members = membersForGroup(groupId);

  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setDigest(await buildDigest(groupId, members));
    setLoading(false);
  }, [groupId, members]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onShare() {
    if (!digest) return;
    try {
      await Share.share({ message: digestAsText({ groupName, digest }) });
    } catch {
      /* dismissed */
    }
  }

  const d = digest;
  const flagCount = d ? d.flags.length : 0;
  const headline =
    flagCount === 0
      ? 'A quiet week'
      : `${flagCount === 1 ? 'One student' : `${flagCount} student${flagCount === 1 ? '' : 's'}`} need${flagCount === 1 ? 's' : ''} a word`;

  return (
    <Screen>
      <Header title="Weekly digest" subtitle={groupName} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
      >
        {!d ? (
          <ActivityIndicator color={colors.inkSoft} style={{ marginTop: spacing.xxl }} />
        ) : (
          <>
            <Text style={styles.kicker}>{d.weekLabel.toUpperCase()}</Text>
            <Text style={styles.headline}>{headline}</Text>

            {/* Class attendance card */}
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <Text style={styles.heroRate}>
                  {d.classRate == null ? '—' : d.classRate}
                  {d.classRate == null ? '' : <Text style={styles.heroPct}>%</Text>}
                </Text>
                <Text style={styles.heroLabel}>
                  class attendance{'\n'}
                  {d.delta == null
                    ? `across ${d.sessions} session${d.sessions === 1 ? '' : 's'}`
                    : `${d.delta >= 0 ? 'up' : 'down'} ${Math.abs(d.delta)} pts on last week`}
                </Text>
              </View>
              {d.bars.length ? (
                <View style={styles.bars}>
                  {d.bars.map((b, i) => (
                    <View
                      key={i}
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max(12, b.rate || 0)}%`,
                          backgroundColor: (b.rate || 0) >= 85 ? '#4FA97F' : '#D69A3C',
                        },
                      ]}
                    />
                  ))}
                </View>
              ) : (
                <Text style={styles.heroEmpty}>No rolls submitted this week yet.</Text>
              )}
            </View>

            {/* Student flags */}
            {d.flags.length ? (
              <View style={styles.flags}>
                {d.flags.map((f) => (
                  <View key={f.id} style={styles.flagRow}>
                    <Avatar name={f.name} size={38} />
                    <View style={styles.flagBody}>
                      <Text style={styles.flagName}>{f.name}</Text>
                      <Text
                        style={[
                          styles.flagText,
                          { color: f.tone === 'urgent' ? colors.accent : colors.warning },
                        ]}
                      >
                        {f.text}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.okCard}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={styles.okText}>No students crossed the line this week.</Text>
              </View>
            )}

            {/* Accountability */}
            {d.accountability ? (
              <View
                style={[
                  styles.account,
                  { backgroundColor: d.accountability.tone === 'ok' ? colors.successSoft : colors.warningSoft },
                ]}
              >
                <Text style={styles.accountTitle}>{d.accountability.title}</Text>
                <Text style={styles.accountSub}>{d.accountability.sub}</Text>
              </View>
            ) : null}

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable
                onPress={() => navigation.navigate('Feed', { groupId, groupName })}
                style={({ pressed }) => [styles.msgBtn, pressed && styles.pressed]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.onPrimary} />
                <Text style={styles.msgText}>Open the group</Text>
              </Pressable>
              <Pressable onPress={onShare} style={({ pressed }) => [styles.exportBtn, pressed && styles.pressed]}>
                <Ionicons name="share-outline" size={20} color={colors.ink} />
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  pressed: { opacity: 0.85 },

  kicker: { ...type.monoLabel, fontSize: 11, letterSpacing: 1.2, color: colors.muted },
  headline: { ...type.display, fontSize: 27, color: colors.ink, marginTop: 6, lineHeight: 32 },

  hero: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  heroRate: { fontFamily: monoFamily, fontSize: 46, fontWeight: '600', color: colors.onPrimary, letterSpacing: -2, lineHeight: 46 },
  heroPct: { fontSize: 22, color: 'rgba(255,255,255,0.7)' },
  heroLabel: { ...type.caption, color: 'rgba(255,255,255,0.7)', lineHeight: 18, paddingBottom: 4 },
  heroEmpty: { ...type.caption, color: 'rgba(255,255,255,0.6)', marginTop: spacing.lg },
  bars: { flexDirection: 'row', gap: 4, height: 46, marginTop: spacing.lg, alignItems: 'flex-end' },
  bar: { flex: 1, borderRadius: 3, minHeight: 6 },

  flags: { marginTop: spacing.md, gap: spacing.sm },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  flagBody: { flex: 1 },
  flagName: { ...type.bodyStrong, color: colors.ink },
  flagText: { ...type.caption, fontWeight: '600', marginTop: 2 },

  okCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  okText: { ...type.body, color: colors.ink, flex: 1 },

  account: { borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md },
  accountTitle: { ...type.bodyStrong, fontSize: 14, color: colors.ink },
  accountSub: { ...type.caption, color: colors.inkSoft, marginTop: 4, lineHeight: 18 },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  msgBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
  },
  msgText: { ...type.bodyStrong, fontSize: 16, color: colors.onPrimary },
  exportBtn: {
    width: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
