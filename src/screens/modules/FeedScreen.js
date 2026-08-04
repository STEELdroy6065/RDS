import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Avatar from '../../components/Avatar';
import Badge from '../../components/Badge';
import Header from '../../components/Header';
import { colors, spacing, type } from '../../theme';
import { feedByGroup } from '../../data/mock';

const TYPE_TONE = {
  Announcement: 'accent',
  Event: 'primary',
  Update: 'info',
};

export default function FeedScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const posts = feedByGroup[groupId] || [];

  return (
    <Screen>
      <Header
        title="Feed"
        subtitle={groupName}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {posts.map((p) => (
          <Card key={p.id} style={styles.post}>
            <View style={styles.head}>
              <Avatar name={p.author} size={38} />
              <View style={styles.headBody}>
                <Text style={styles.author}>{p.author}</Text>
                <Text style={styles.time}>{p.time} ago</Text>
              </View>
              <Badge label={p.type} tone={TYPE_TONE[p.type] || 'neutral'} />
            </View>
            <Text style={styles.text}>{p.text}</Text>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  post: {
    marginBottom: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headBody: {
    flex: 1,
    marginLeft: spacing.md,
  },
  author: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  time: {
    ...type.caption,
    color: colors.muted,
    marginTop: 1,
  },
  text: {
    ...type.body,
    color: colors.inkSoft,
    lineHeight: 21,
  },
});
