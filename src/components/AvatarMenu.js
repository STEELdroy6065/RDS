import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from './Avatar';
import { colors, spacing, radius, type, shadow } from '../theme';

// Dropdown anchored to the top-right, opened by tapping the header avatar.
// Collects the account actions that used to live on the Profile tab.
export default function AvatarMenu({ visible, onClose, name, email, avatarColor, items }) {
  const insets = useSafeAreaInsets();

  function pick(item) {
    onClose();
    // Let the menu dismiss before navigating / showing a confirm dialog.
    setTimeout(() => item.onPress && item.onPress(), 0);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.menu, { top: insets.top + 52 }]}
          onPress={() => {}}
        >
          <View style={styles.header}>
            <Avatar name={name} size={40} color={avatarColor} />
            <View style={styles.headerText}>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              {email ? <Text style={styles.email} numberOfLines={1}>{email}</Text> : null}
            </View>
          </View>

          <View style={styles.divider} />

          {items.map((item, i) => (
            <Pressable
              key={item.id}
              onPress={() => pick(item)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Ionicons
                name={item.icon}
                size={19}
                color={item.danger ? colors.accent : colors.inkSoft}
              />
              <Text style={[styles.label, item.danger && { color: colors.accent }]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  menu: {
    position: 'absolute',
    right: spacing.lg,
    width: 240,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    ...shadow.raised,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  name: { ...type.bodyStrong, color: colors.ink },
  email: { ...type.caption, color: colors.muted, marginTop: 1 },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  label: { ...type.body, color: colors.ink },
});
