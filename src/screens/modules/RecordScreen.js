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
import { colors, spacing, radius, type, monoFamily } from '../../theme';
import { useSession } from '../../state/session';
import { useGroups } from '../../state/groups';
import { buildRecord, verifyRecord, recordAsText } from '../../lib/record';
import { confirm, notify } from '../../lib/confirm';

const BAR_COLOR = {
  P: '#4FA97F',
  L: '#D69A3C',
  A: colors.accent,
  E: 'rgba(255,255,255,0.25)',
};

export default function RecordScreen({ route, navigation }) {
  const { groupId, groupName, studentId, studentName } = route.params;
  const { user } = useSession();
  const { roleForGroup } = useGroups();

  const self = studentId === user.id;
  const role = roleForGroup(groupId);
  const canVerify = (role === 'Admin' || role === 'Captain') && !self;
  const name = self ? user.name : studentName || 'Student';

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setRecord(await buildRecord(groupId, studentId, { self }));
    setLoading(false);
  }, [groupId, studentId, self]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onShare() {
    if (!record) return;
    try {
      await Share.share({ message: recordAsText({ studentName: name, groupName, record }) });
    } catch {
      /* user dismissed */
    }
  }

  function onVerify() {
    confirm({
      title: 'Verify this record?',
      message: `You're signing ${name}'s participation record for ${groupName}. Your name and today's date will be attached.`,
      confirmLabel: 'Verify',
      onConfirm: async () => {
        setVerifying(true);
        try {
          await verifyRecord({ groupId, studentId, name: user.name });
          await load();
        } catch (e) {
          notify({ title: 'Could not verify', message: (e && e.message) || 'Please try again.' });
        } finally {
          setVerifying(false);
        }
      },
    });
  }

  const r = record;

  return (
    <Screen>
      <Header title="Record" subtitle={groupName} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
      >
        <Text style={styles.kicker}>PARTICIPATION RECORD</Text>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.sub}>
          {groupName} · {new Date().getFullYear()}
        </Text>

        {!r ? (
          <ActivityIndicator color={colors.inkSoft} style={{ marginTop: spacing.xxl }} />
        ) : (
          <>
            {/* Hero card */}
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <Text style={styles.heroRate}>
                  {r.rate == null ? '—' : r.rate}
                  {r.rate == null ? '' : <Text style={styles.heroPct}>%</Text>}
                </Text>
                <Text style={styles.heroLabel}>
                  attendance{'\n'}across {r.sessions} session{r.sessions === 1 ? '' : 's'}
                </Text>
              </View>
              {r.series.length ? (
                <>
                  <View style={styles.bars}>
                    {r.series.map((d, i) => (
                      <View key={i} style={[styles.bar, { backgroundColor: BAR_COLOR[d.status] || BAR_COLOR.E }]} />
                    ))}
                  </View>
                  <View style={styles.barScale}>
                    <Text style={styles.barScaleText}>DAY 1</Text>
                    <Text style={styles.barScaleText}>DAY {r.series.length}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.heroEmpty}>No attendance recorded yet.</Text>
              )}
            </View>

            {/* Stat tiles */}
            <View style={styles.tiles}>
              <StatTile value={r.streak} label="day streak" />
              {self ? (
                <StatTile value={r.votes == null ? '—' : r.votes} label="votes cast" />
              ) : (
                <StatTile value={r.tally.P + r.tally.L} label="days present" />
              )}
              <StatTile value={r.tally.A} label="absences" />
            </View>

            {/* Verification */}
            {r.verification ? (
              <View style={styles.verified}>
                <Ionicons name="shield-checkmark" size={19} color={colors.success} style={styles.verifiedIcon} />
                <View style={styles.verifiedBody}>
                  <Text style={styles.verifiedTitle}>
                    Verified by {r.verification.verified_by_name || 'the school'},{' '}
                    {new Date(r.verification.verified_at).toLocaleDateString()}
                  </Text>
                  <Text style={styles.verifiedSub}>
                    Signed by the school. This record travels with you.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.unverified}>
                <Ionicons name="shield-outline" size={19} color={colors.muted} style={styles.verifiedIcon} />
                <View style={styles.verifiedBody}>
                  <Text style={styles.unverifiedTitle}>Not yet verified</Text>
                  <Text style={styles.verifiedSub}>
                    {canVerify
                      ? 'Sign this record so it travels with the student.'
                      : 'An Admin or Captain can sign this record.'}
                  </Text>
                </View>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable onPress={onShare} style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}>
                <Ionicons name="share-outline" size={18} color={colors.onPrimary} />
                <Text style={styles.shareText}>Share record</Text>
              </Pressable>
              {canVerify ? (
                <Pressable
                  onPress={onVerify}
                  disabled={verifying}
                  style={({ pressed }) => [styles.verifyBtn, pressed && styles.pressed]}
                >
                  {verifying ? (
                    <ActivityIndicator color={colors.ink} />
                  ) : (
                    <Ionicons name="shield-checkmark-outline" size={20} color={colors.ink} />
                  )}
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function StatTile({ value, label }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  pressed: { opacity: 0.85 },

  kicker: { ...type.monoLabel, fontSize: 11, letterSpacing: 1.2, color: colors.muted },
  name: { ...type.display, fontSize: 28, color: colors.ink, marginTop: 6 },
  sub: { ...type.body, color: colors.muted, marginTop: 4 },

  hero: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  heroRate: { fontFamily: monoFamily, fontSize: 54, fontWeight: '600', color: colors.onPrimary, letterSpacing: -2, lineHeight: 54 },
  heroPct: { fontSize: 24, color: 'rgba(255,255,255,0.7)' },
  heroLabel: { ...type.caption, color: 'rgba(255,255,255,0.7)', lineHeight: 18, paddingBottom: 6 },
  heroEmpty: { ...type.caption, color: 'rgba(255,255,255,0.6)', marginTop: spacing.lg },
  bars: { flexDirection: 'row', gap: 2, height: 26, marginTop: spacing.xl },
  bar: { flex: 1, borderRadius: 3, minWidth: 3 },
  barScale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  barScaleText: { fontFamily: monoFamily, fontSize: 10, color: 'rgba(255,255,255,0.55)' },

  tiles: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  tileValue: { fontFamily: monoFamily, fontSize: 26, fontWeight: '600', color: colors.ink, letterSpacing: -0.5 },
  tileLabel: { ...type.caption, color: colors.muted, marginTop: 3 },

  verified: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  unverified: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  verifiedIcon: { marginTop: 2 },
  verifiedBody: { flex: 1 },
  verifiedTitle: { ...type.bodyStrong, fontSize: 14, color: colors.ink },
  unverifiedTitle: { ...type.bodyStrong, fontSize: 14, color: colors.inkSoft },
  verifiedSub: { ...type.caption, color: colors.muted, marginTop: 3, lineHeight: 17 },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
  },
  shareText: { ...type.bodyStrong, fontSize: 16, color: colors.onPrimary },
  verifyBtn: {
    width: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
