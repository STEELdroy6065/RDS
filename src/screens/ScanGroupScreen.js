import React, { useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, type } from '../theme';
import { useGroups } from '../state/groups';
import { notify } from '../lib/confirm';

function friendlyJoinError(message = '') {
  if (/duplicate|unique/i.test(message)) return 'You are already a member of that group.';
  if (/invalid input syntax|uuid/i.test(message)) return 'That QR code isn’t a Synq group.';
  if (/violates foreign key|not present/i.test(message)) return 'No group found for that code.';
  return message || 'Could not join. Please try again.';
}

export default function ScanGroupScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { joinByCode } = useGroups();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);

  async function onScan({ data }) {
    if (handled.current || busy || !data) return;
    handled.current = true;
    setBusy(true);
    try {
      const id = await joinByCode(data.trim());
      navigation.replace('GroupDetail', { groupId: id });
    } catch (e) {
      setBusy(false);
      handled.current = false;
      notify({ title: 'Could not join', message: friendlyJoinError(e && e.message) });
    }
  }

  // Permission still loading.
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Permission not granted yet.
  if (!permission.granted) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <BackButton insets={insets} onPress={() => navigation.goBack()} />
        <Ionicons name="camera-outline" size={40} color={colors.muted} />
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permSub}>
          Allow camera access to scan a group’s QR code and join.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={({ pressed }) => [styles.permBtn, pressed && styles.pressed]}
        >
          <Text style={styles.permBtnText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={busy ? undefined : onScan}
      />

      {/* Dim overlay + scan frame */}
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.hint}>
          {busy ? 'Joining…' : 'Point at a group’s QR code'}
        </Text>
        {busy ? <ActivityIndicator color="#FFFFFF" style={{ marginTop: spacing.md }} /> : null}
      </View>

      <BackButton insets={insets} onPress={() => navigation.goBack()} light />
    </View>
  );
}

function BackButton({ insets, onPress, light }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={[
        styles.backBtn,
        { top: insets.top + spacing.sm },
        light && styles.backBtnLight,
      ]}
    >
      <Ionicons name="chevron-back" size={22} color={light ? '#FFFFFF' : colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'transparent',
  },
  hint: {
    ...type.bodyStrong,
    color: '#FFFFFF',
    marginTop: spacing.xl,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  backBtn: {
    position: 'absolute',
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnLight: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  permTitle: { ...type.heading, color: colors.ink, marginTop: spacing.sm },
  permSub: { ...type.body, color: colors.muted, textAlign: 'center' },
  permBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  permBtnText: { ...type.bodyStrong, color: colors.onPrimary },
  pressed: { opacity: 0.85 },
});
