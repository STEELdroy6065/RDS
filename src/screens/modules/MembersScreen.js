import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Avatar from '../../components/Avatar';
import Badge from '../../components/Badge';
import Header from '../../components/Header';
import { colors, spacing, type } from '../../theme';
import { useGroups } from '../../state/groups';

const LEAD_ROLES = ['Coach', 'Advisor', 'Captain', 'Organizer', 'Lead', 'Admin'];

export default function MembersScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const { membersForGroup } = useGroups();
  const members = membersForGroup(groupId);

  return (
    <Screen>
      <Header
        title="Members"
        subtitle={groupName}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.count}>
          {members.length} {members.length === 1 ? 'person' : 'people'}
        </Text>
        <Card padded={false}>
          {members.map((m, i) => (
            <View
              key={m.id}
              style={[
                styles.row,
                i < members.length - 1 && styles.rowBorder,
              ]}
            >
              <Avatar name={m.name} size={42} />
              <Text style={styles.name}>{m.name}</Text>
              <Badge
                label={m.role}
                tone={LEAD_ROLES.includes(m.role) ? 'primary' : 'neutral'}
              />
            </View>
          ))}
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
  count: {
    ...type.label,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  name: {
    ...type.bodyStrong,
    color: colors.ink,
    flex: 1,
    marginLeft: spacing.md,
  },
});
