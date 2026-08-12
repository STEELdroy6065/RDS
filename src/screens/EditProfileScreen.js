import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import Screen from '../components/Screen';
import Header from '../components/Header';
import Avatar from '../components/Avatar';
import { colors, spacing, radius, type } from '../theme';
import { supabase } from '../lib/supabase';
import { useSession } from '../state/session';
import { notify } from '../lib/confirm';

export default function EditProfileScreen({ navigation }) {
  const { user, updateProfile } = useSession();
  const [name, setName] = useState(user ? user.name : '');
  const [avatarUrl, setAvatarUrl] = useState(user ? user.avatarUrl : null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      notify({ title: 'Permission needed', message: 'Allow photo access to set an avatar.' });
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (res.canceled) return;
    const a = res.assets[0];
    setUploading(true);
    try {
      const ext = (a.fileName ? a.fileName.split('.').pop() : (a.mimeType || 'image/jpeg').split('/')[1]) || 'jpg';
      const path = `avatars/${user.id}/${Date.now()}.${ext}`;
      let body;
      if (Platform.OS === 'web') {
        body = await (await fetch(a.uri)).blob();
      } else {
        const base64 = await FileSystem.readAsStringAsync(a.uri, { encoding: 'base64' });
        body = decode(base64);
      }
      const { error } = await supabase.storage
        .from('attachments')
        .upload(path, body, { contentType: a.mimeType || 'image/jpeg', upsert: true });
      if (error) throw error;
      setAvatarUrl(supabase.storage.from('attachments').getPublicUrl(path).data.publicUrl);
    } catch (e) {
      notify({ title: 'Could not upload', message: (e && e.message) || 'Please try again.' });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      notify({ title: 'Name required', message: 'Please enter a display name.' });
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: trimmed, avatarUrl: avatarUrl || null });
      notify({
        title: 'Profile saved',
        message: 'Your name and photo are updated.',
        onDismiss: () => navigation.goBack(),
      });
    } catch (e) {
      setSaving(false);
      notify({ title: 'Could not save', message: (e && e.message) || 'Please try again.' });
    }
  }

  return (
    <Screen>
      <Header title="Edit profile" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarWrap}>
          <Pressable onPress={pickAvatar} style={styles.avatarPress}>
            <Avatar name={name || 'You'} uri={avatarUrl} size={96} />
            <View style={styles.avatarBadge}>
              {uploading ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Ionicons name="camera" size={16} color={colors.onPrimary} />
              )}
            </View>
          </Pressable>
          <Text style={styles.avatarHint}>Tap to change photo</Text>
          {avatarUrl ? (
            <Pressable onPress={() => setAvatarUrl(null)} hitSlop={8}>
              <Text style={styles.removePhoto}>Remove photo</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.label}>DISPLAY NAME</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="words"
          returnKeyType="done"
        />
        <Text style={styles.note}>
          This is the name other members see in groups, chat and attendance.
        </Text>

        <Pressable
          onPress={save}
          disabled={saving || uploading}
          style={({ pressed }) => [
            styles.saveBtn,
            (saving || uploading) && styles.saveDisabled,
            pressed && styles.pressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.saveText}>Save profile</Text>
          )}
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  pressed: { opacity: 0.85 },

  avatarWrap: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  avatarPress: {},
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.bg,
  },
  avatarHint: { ...type.caption, color: colors.muted },
  removePhoto: { ...type.caption, color: colors.accent, fontWeight: '600' },

  label: { ...type.monoLabel, fontSize: 10, letterSpacing: 1, color: colors.muted, marginBottom: spacing.sm },
  input: {
    ...type.body,
    color: colors.ink,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  note: { ...type.caption, color: colors.muted, marginTop: spacing.sm, lineHeight: 18 },

  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveDisabled: { backgroundColor: colors.surfaceAlt },
  saveText: { ...type.bodyStrong, fontSize: 16, color: colors.onPrimary },
});
