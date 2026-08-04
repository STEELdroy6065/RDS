import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Header from '../../components/Header';
import { colors, spacing, radius, type } from '../../theme';
import { pollByGroup } from '../../data/mock';

export default function VotesScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const seed = pollByGroup[groupId] || pollByGroup.g1;

  // Local, in-memory poll state — copied from the mock seed.
  const [options, setOptions] = useState(() =>
    seed.options.map((o) => ({ ...o }))
  );
  const [selected, setSelected] = useState(null);

  const total = options.reduce((sum, o) => sum + o.votes, 0);

  function vote(optionId) {
    if (optionId === selected) return; // already your pick
    setOptions((prev) =>
      prev.map((o) => {
        if (o.id === optionId) return { ...o, votes: o.votes + 1 };
        if (o.id === selected) return { ...o, votes: Math.max(0, o.votes - 1) };
        return o;
      })
    );
    setSelected(optionId);
  }

  return (
    <Screen>
      <Header
        title="Votes"
        subtitle={groupName}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.poll}>
          <View style={styles.pollHead}>
            <View style={styles.liveTag}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE POLL</Text>
            </View>
            <Text style={styles.totalText}>
              {total} {total === 1 ? 'vote' : 'votes'}
            </Text>
          </View>

          <Text style={styles.question}>{seed.question}</Text>

          <View style={styles.options}>
            {options.map((o) => {
              const pct = total === 0 ? 0 : Math.round((o.votes / total) * 100);
              const isSelected = selected === o.id;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => vote(o.id)}
                  style={({ pressed }) => [
                    styles.option,
                    isSelected && styles.optionSelected,
                    pressed && styles.optionPressed,
                  ]}
                >
                  {/* Fill bar reflects live percentage */}
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${pct}%`,
                        backgroundColor: isSelected
                          ? colors.primarySoft
                          : colors.surfaceAlt,
                      },
                    ]}
                  />
                  <View style={styles.optionRow}>
                    <View style={styles.optionLeft}>
                      <View
                        style={[
                          styles.radio,
                          isSelected && styles.radioOn,
                        ]}
                      >
                        {isSelected ? (
                          <Ionicons
                            name="checkmark"
                            size={13}
                            color={colors.onPrimary}
                          />
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.optionLabel,
                          isSelected && styles.optionLabelOn,
                        ]}
                      >
                        {o.label}
                      </Text>
                    </View>
                    <Text
                      style={[styles.pct, isSelected && styles.pctOn]}
                    >
                      {pct}%
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.hint}>
            {selected
              ? 'Tap another option to change your vote'
              : 'Tap an option to cast your vote'}
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  poll: {
    padding: spacing.xl,
  },
  pollHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginRight: 6,
  },
  liveText: {
    ...type.label,
    fontSize: 10,
    color: colors.accent,
  },
  totalText: {
    ...type.caption,
    color: colors.muted,
  },
  question: {
    ...type.title,
    fontSize: 20,
    color: colors.ink,
    marginBottom: spacing.xl,
  },
  options: {
    gap: spacing.md,
  },
  option: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    justifyContent: 'center',
    minHeight: 52,
  },
  optionSelected: {
    borderColor: colors.primary,
  },
  optionPressed: {
    opacity: 0.85,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
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
  radioOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionLabel: {
    ...type.body,
    color: colors.inkSoft,
  },
  optionLabelOn: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  pct: {
    ...type.bodyStrong,
    color: colors.muted,
  },
  pctOn: {
    color: colors.primary,
  },
  hint: {
    ...type.caption,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
