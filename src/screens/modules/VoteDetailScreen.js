import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Avatar from '../../components/Avatar';
import Header from '../../components/Header';
import Pulse from '../../components/Pulse';
import { colors, spacing, radius, type } from '../../theme';
import { useSession } from '../../state/session';
import { useGroups } from '../../state/groups';
import { useVotes } from '../../state/votes';
import { confirm, notify } from '../../lib/confirm';
import {
  totalVotes,
  countForOption,
  percentForOption,
  votersForOption,
  choiceOf,
  isCreator,
  canCloseVote,
  canCreateVote,
  canVote,
  canSeeResults,
  statusLabel,
} from '../../state/voteRules';

export default function VoteDetailScreen({ route, navigation }) {
  const { voteId, groupName } = route.params;
  const { user } = useSession();
  const { roleForGroup } = useGroups();
  const { getVote, refreshVote, castVote, closeVote, deleteVote } = useVotes();

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    refreshVote(voteId).finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [voteId, refreshVote]);

  const vote = getVote(voteId);

  async function handleCast(optionId) {
    try {
      await castVote(voteId, optionId, user);
    } catch (e) {
      notify({ title: 'Could not save your vote', message: e && e.message });
    }
  }

  if (!vote) {
    return (
      <Screen>
        <Header title="Vote" subtitle={groupName} onBack={() => navigation.goBack()} />
        <View style={styles.missing}>
          {loaded ? (
            <Text style={styles.missingText}>This vote is no longer available.</Text>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
      </Screen>
    );
  }

  const open = canVote(vote);
  const mine = choiceOf(vote, user.id);
  const seeResults = canSeeResults(vote, user.id);
  const creator = isCreator(vote, user.id);
  const mayClose = canCloseVote(vote, user.id);
  const mayDelete = creator || canCreateVote(roleForGroup(vote.groupId));
  const total = totalVotes(vote);
  const label = statusLabel(vote);

  function onDelete() {
    confirm({
      title: 'Delete this vote?',
      message: 'This removes the vote and all cast votes with it. This can’t be undone.',
      confirmLabel: 'Delete vote',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteVote(vote.id);
          navigation.goBack();
        } catch (e) {
          notify({ title: 'Could not delete the vote', message: e && e.message });
        }
      },
    });
  }

  function onClose() {
    confirm({
      title: 'Close this vote?',
      message:
        'Results and voter names become visible to everyone, and no more votes can be cast. This can’t be undone.',
      confirmLabel: 'Close vote',
      destructive: true,
      onConfirm: async () => {
        try {
          await closeVote(vote.id);
        } catch (e) {
          notify({ title: 'Could not close the vote', message: e && e.message });
        }
      },
    });
  }

  return (
    <Screen>
      <Header title="Vote" subtitle={groupName} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.card}>
          {/* Status + meta */}
          <StatusRow label={label} vote={vote} total={total} seeResults={seeResults} />

          <Text style={styles.question}>{vote.question}</Text>

          <View style={styles.creatorRow}>
            <Avatar name={vote.createdByName} size={22} />
            <Text style={styles.creatorText}>
              {creator ? 'You' : vote.createdByName} · {vote.createdAt}
            </Text>
          </View>

          {/* Concealed banner (open + hidden + not creator) */}
          {!seeResults ? (
            <HiddenBanner total={total} />
          ) : null}

          {/* Creator-preview note (open + hidden + creator) */}
          {seeResults && vote.visibility === 'hidden' && open ? (
            <View style={styles.previewNote}>
              <Ionicons name="eye" size={15} color={colors.primary} />
              <Text style={styles.previewNoteText}>
                Only you can see these results while the vote is hidden.
              </Text>
            </View>
          ) : null}

          {/* Options */}
          <View style={styles.options}>
            {vote.options.map((opt) => (
              <OptionRow
                key={opt.id}
                vote={vote}
                option={opt}
                selected={mine === opt.id}
                open={open}
                seeResults={seeResults}
                total={total}
                currentUserId={user.id}
                onPress={() => open && handleCast(opt.id)}
              />
            ))}
          </View>

          {/* Footer hint */}
          <Text style={styles.hint}>
            {!open
              ? 'This vote is closed. Final results are shown above.'
              : mine
              ? 'Tap another option to change your vote.'
              : 'Tap an option to cast your vote.'}
          </Text>
        </Card>

        {/* Close action — creator only, open only */}
        {mayClose ? (
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closePressed]}
          >
            <Ionicons name="lock-closed" size={18} color={colors.ink} />
            <Text style={styles.closeText}>Close vote</Text>
          </Pressable>
        ) : null}

        {!open ? (
          <View style={styles.closedBanner}>
            <Ionicons name="checkmark-done" size={16} color={colors.inkSoft} />
            <Text style={styles.closedBannerText}>
              Closed · results are final and visible to everyone.
            </Text>
          </View>
        ) : null}

        {/* Delete — creator or group Admin/Captain, open or closed */}
        {mayDelete ? (
          <Pressable
            onPress={onDelete}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.closePressed]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.accent} />
            <Text style={styles.deleteText}>Delete vote</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function StatusRow({ label, total, seeResults }) {
  const tone =
    label === 'Live'
      ? { bg: colors.accentSoft, fg: colors.accent, icon: 'radio' }
      : label === 'Hidden'
      ? { bg: colors.primarySoft, fg: colors.primary, icon: 'eye-off' }
      : { bg: colors.surfaceAlt, fg: colors.inkSoft, icon: 'lock-closed' };

  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
        {label === 'Live' ? (
          <Pulse color={tone.fg} size={8} />
        ) : (
          <Ionicons name={tone.icon} size={12} color={tone.fg} />
        )}
        <Text style={[styles.statusText, { color: tone.fg }]}>
          {label.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.totalText}>
        {seeResults
          ? `${total} ${total === 1 ? 'vote' : 'votes'}`
          : `${total} voted`}
      </Text>
    </View>
  );
}

function HiddenBanner({ total }) {
  return (
    <View style={styles.hiddenBanner}>
      <View style={styles.hiddenIcon}>
        <Ionicons name="eye-off" size={18} color={colors.primary} />
      </View>
      <View style={styles.hiddenBody}>
        <Text style={styles.hiddenTitle}>Voting in progress</Text>
        <Text style={styles.hiddenSub}>
          {total} {total === 1 ? 'person has' : 'people have'} voted. Counts and
          names stay hidden until the creator closes this vote.
        </Text>
      </View>
    </View>
  );
}

function OptionRow({
  vote,
  option,
  selected,
  open,
  seeResults,
  total,
  currentUserId,
  onPress,
}) {
  const count = countForOption(vote, option.id);
  const pct = percentForOption(vote, option.id);
  const voters = seeResults ? votersForOption(vote, option.id) : [];

  return (
    <Pressable
      onPress={onPress}
      disabled={!open}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && open && styles.optionPressed,
      ]}
    >
      {/* Fill bar — only when results are visible */}
      {seeResults ? (
        <View
          style={[
            styles.fill,
            {
              width: `${pct}%`,
              backgroundColor: selected ? colors.primarySoft : colors.surfaceAlt,
            },
          ]}
        />
      ) : null}

      <View style={styles.optionRow}>
        <View style={styles.optionLeft}>
          <View style={[styles.radio, selected && styles.radioOn]}>
            {selected ? (
              <Ionicons name="checkmark" size={13} color={colors.onPrimary} />
            ) : null}
          </View>
          <Text style={[styles.optionLabel, selected && styles.optionLabelOn]}>
            {option.label}
          </Text>
        </View>

        {seeResults ? (
          <View style={styles.optionRight}>
            <Text style={styles.count}>{count}</Text>
            <Text style={[styles.pct, selected && styles.pctOn]}>{pct}%</Text>
          </View>
        ) : selected ? (
          <Text style={styles.yourPick}>Your pick</Text>
        ) : null}
      </View>

      {/* Named voters under the option */}
      {seeResults ? (
        <View style={styles.voters}>
          {voters.length === 0 ? (
            <Text style={styles.noVoters}>No votes yet</Text>
          ) : (
            voters.map((v) => (
              <View key={v.userId} style={styles.voterChip}>
                <Avatar name={v.name} size={18} />
                <Text style={styles.voterName}>
                  {v.userId === currentUserId ? 'You' : v.name}
                </Text>
              </View>
            ))
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  missing: { padding: spacing.xl, alignItems: 'center' },
  missingText: { ...type.body, color: colors.muted },
  card: { padding: spacing.xl },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  statusText: { ...type.label, fontSize: 10, marginLeft: 5 },
  totalText: { ...type.caption, color: colors.muted },
  question: {
    ...type.title,
    fontSize: 20,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  creatorText: {
    ...type.caption,
    color: colors.muted,
    marginLeft: spacing.sm,
  },
  previewNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  previewNoteText: {
    ...type.caption,
    color: colors.primaryDark,
    marginLeft: spacing.sm,
    flex: 1,
  },
  hiddenBanner: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  hiddenIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenBody: { flex: 1, marginLeft: spacing.md },
  hiddenTitle: { ...type.bodyStrong, color: colors.ink },
  hiddenSub: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: 3,
    lineHeight: 18,
  },
  options: { gap: spacing.md },
  option: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingBottom: 2,
  },
  optionSelected: { borderColor: colors.primary },
  optionPressed: { opacity: 0.85 },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  optionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    backgroundColor: colors.surface,
  },
  radioOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionLabel: { ...type.body, color: colors.inkSoft, flexShrink: 1 },
  optionLabelOn: { ...type.bodyStrong, color: colors.ink },
  optionRight: { flexDirection: 'row', alignItems: 'baseline' },
  count: { ...type.caption, color: colors.muted, marginRight: 6 },
  pct: { ...type.bodyStrong, color: colors.muted },
  pctOn: { color: colors.primary },
  yourPick: { ...type.caption, color: colors.primary, fontWeight: '700' },
  voters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: 2,
  },
  noVoters: { ...type.caption, color: colors.muted, fontStyle: 'italic' },
  voterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingLeft: 3,
    paddingRight: spacing.sm + 2,
    paddingVertical: 3,
  },
  voterName: {
    ...type.caption,
    fontSize: 12,
    color: colors.inkSoft,
    marginLeft: 5,
  },
  hint: {
    ...type.caption,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.lg,
  },
  closePressed: { opacity: 0.85 },
  closeText: {
    ...type.bodyStrong,
    color: colors.ink,
    marginLeft: spacing.sm,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
  },
  deleteText: {
    ...type.bodyStrong,
    color: colors.accent,
    marginLeft: spacing.sm,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  closedBannerText: {
    ...type.caption,
    color: colors.inkSoft,
    marginLeft: spacing.sm,
  },
});
