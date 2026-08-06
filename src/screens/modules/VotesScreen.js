import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Header from '../../components/Header';
import Pulse from '../../components/Pulse';
import { colors, spacing, radius, type, shadow } from '../../theme';
import { useSession } from '../../state/session';
import { useGroups } from '../../state/groups';
import { useVotes } from '../../state/votes';
import {
  totalVotes,
  statusLabel,
  canCreateVote,
  canSeeResults,
  choiceOf,
  countForOption,
} from '../../state/voteRules';

const STATUS_TONE = {
  Live: { bg: colors.accentSoft, fg: colors.accent, icon: 'radio' },
  Hidden: { bg: colors.primarySoft, fg: colors.primary, icon: 'eye-off' },
  Closed: { bg: colors.surfaceAlt, fg: colors.inkSoft, icon: 'lock-closed' },
};

export default function VotesScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const { user } = useSession();
  const { roleForGroup } = useGroups();
  const { votesForGroup, refreshGroup } = useVotes();

  const role = roleForGroup(groupId);
  const mayCreate = canCreateVote(role);
  const votes = votesForGroup(groupId);

  const [refreshing, setRefreshing] = useState(false);

  // Reload whenever this screen comes into focus (e.g. returning from creating
  // or voting), so the list reflects the latest server state.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setRefreshing(true);
      refreshGroup(groupId).finally(() => active && setRefreshing(false));
      return () => {
        active = false;
      };
    }, [groupId, refreshGroup])
  );

  return (
    <Screen>
      <Header title="Votes" subtitle={groupName} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refreshGroup(groupId)}
            tintColor={colors.primary}
          />
        }
      >
        {/* Create action — only Captains/Admins ever see this. */}
        {mayCreate ? (
          <Pressable
            onPress={() => navigation.navigate('NewVote', { groupId, groupName })}
            style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
          >
            <View style={styles.plusCircle}>
              <Ionicons name="add" size={22} color={colors.onPrimary} />
            </View>
            <View style={styles.newBtnBody}>
              <Text style={styles.newBtnTitle}>New vote</Text>
              <Text style={styles.newBtnSub}>You can create votes as {role}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        ) : (
          <View style={styles.memberNote}>
            <Ionicons name="information-circle" size={16} color={colors.muted} />
            <Text style={styles.memberNoteText}>
              Only Captains and Admins can create votes.
            </Text>
          </View>
        )}

        {votes.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {refreshing ? 'Loading votes…' : 'No votes yet'}
            </Text>
            {!refreshing ? (
              <Text style={styles.emptySub}>
                {mayCreate
                  ? 'Create the first vote for this group.'
                  : 'Nothing to vote on right now.'}
              </Text>
            ) : null}
          </Card>
        ) : (
          votes.map((vote) => (
            <VoteListCard
              key={vote.id}
              vote={vote}
              userId={user.id}
              onPress={() =>
                navigation.navigate('VoteDetail', { voteId: vote.id, groupName })
              }
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function VoteListCard({ vote, userId, onPress }) {
  const label = statusLabel(vote);
  const tone = STATUS_TONE[label];
  const total = totalVotes(vote);
  const showResults = canSeeResults(vote, userId);
  const myChoice = choiceOf(vote, userId);

  // Leading option, only computed when this user may see results.
  let leading = null;
  if (showResults && total > 0) {
    leading = vote.options.reduce((best, o) =>
      countForOption(vote, o.id) > countForOption(vote, best.id) ? o : best
    );
  }

  return (
    <Card onPress={onPress} style={styles.voteCard}>
      <View style={styles.voteTop}>
        <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
          {label === 'Live' ? (
            <Pulse color={tone.fg} size={7} />
          ) : (
            <Ionicons name={tone.icon} size={11} color={tone.fg} />
          )}
          <Text style={[styles.statusText, { color: tone.fg }]}>
            {label.toUpperCase()}
          </Text>
        </View>
        {myChoice ? (
          <View style={styles.votedTag}>
            <Ionicons name="checkmark-circle" size={13} color={colors.success} />
            <Text style={styles.votedText}>You voted</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.question}>{vote.question}</Text>

      <View style={styles.voteMeta}>
        <Ionicons name="people-outline" size={14} color={colors.muted} />
        <Text style={styles.metaText}>
          {showResults
            ? `${total} ${total === 1 ? 'vote' : 'votes'}`
            : `${total} ${total === 1 ? 'person has' : 'people have'} voted`}
        </Text>
        {leading ? (
          <>
            <View style={styles.dot} />
            <Text style={styles.metaText} numberOfLines={1}>
              Leading: {leading.label}
            </Text>
          </>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  pressed: { opacity: 0.7 },
  plusCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  newBtnBody: { flex: 1, marginLeft: spacing.md },
  newBtnTitle: { ...type.bodyStrong, color: colors.ink },
  newBtnSub: { ...type.caption, color: colors.muted, marginTop: 1 },
  memberNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  memberNoteText: {
    ...type.caption,
    color: colors.inkSoft,
    marginLeft: spacing.sm,
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyTitle: { ...type.heading, color: colors.ink },
  emptySub: { ...type.caption, color: colors.muted, marginTop: 4 },
  voteCard: { marginBottom: spacing.md },
  voteTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  statusText: {
    ...type.label,
    fontSize: 10,
    marginLeft: 4,
  },
  votedTag: { flexDirection: 'row', alignItems: 'center' },
  votedText: {
    ...type.caption,
    color: colors.success,
    fontWeight: '600',
    marginLeft: 4,
  },
  question: {
    ...type.heading,
    fontSize: 18,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  voteMeta: { flexDirection: 'row', alignItems: 'center' },
  metaText: {
    ...type.caption,
    color: colors.muted,
    marginLeft: 5,
    flexShrink: 1,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.muted,
    marginHorizontal: spacing.sm,
  },
});
