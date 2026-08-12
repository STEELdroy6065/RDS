import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Image,
  ActivityIndicator,
  Platform,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import Avatar from '../../components/Avatar';
import { colors, spacing, radius, type, monoFamily } from '../../theme';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../state/session';
import { useGroups } from '../../state/groups';
import {
  fetchLeave,
  requestLeave,
  decideLeave,
  cancelLeave,
  fetchLeaveAudit,
} from '../../lib/leave';
import { confirm, notify } from '../../lib/confirm';

const STATUS_META = {
  pending: { label: 'PENDING', bg: colors.warningSoft, fg: colors.warning },
  approved: { label: 'APPROVED', bg: colors.successSoft, fg: colors.success },
  declined: { label: 'DECLINED', bg: colors.accentSoft, fg: colors.accent },
  cancelled: { label: 'CANCELLED', bg: colors.surfaceAlt, fg: colors.muted },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateStr(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function prettyDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return `${DAYS[dt.getDay()]} ${d} ${MONTHS[(m || 1) - 1]}`;
}

// The next 14 calendar days as pickable chips (no datetime dependency).
function nextDays(n = 14) {
  const out = [];
  const base = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d);
  }
  return out;
}

export default function LeaveScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const { user } = useSession();
  const { roleForGroup } = useGroups();
  const role = roleForGroup(groupId);
  const isModerator = role === 'Admin' || role === 'Captain';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [auditFor, setAuditFor] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await fetchLeave(groupId);
    setItems(data);
    setLoading(false);
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function decide(item, decision) {
    try {
      await decideLeave({ requestId: item.id, decision, name: user.name });
      refresh();
    } catch (e) {
      notify({ title: 'Could not update', message: (e && e.message) || 'Please try again.' });
    }
  }

  function confirmCancel(item) {
    confirm({
      title: 'Cancel this request?',
      message: 'Your pending leave request will be withdrawn.',
      confirmLabel: 'Withdraw',
      destructive: true,
      onConfirm: async () => {
        try {
          await cancelLeave(item.id);
          refresh();
        } catch (e) {
          notify({ title: 'Could not cancel', message: (e && e.message) || 'Please try again.' });
        }
      },
    });
  }

  const pending = items.filter((r) => r.status === 'pending');
  const decided = items.filter((r) => r.status !== 'pending');

  return (
    <Screen>
      <Header title="Leave" subtitle={groupName} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        <Pressable
          onPress={() => setFormOpen(true)}
          style={({ pressed }) => [styles.requestBtn, pressed && styles.pressed]}
        >
          <View style={styles.requestIcon}>
            <Ionicons name="add" size={20} color={colors.onPrimary} />
          </View>
          <View style={styles.requestBody}>
            <Text style={styles.requestTitle}>Request leave</Text>
            <Text style={styles.requestSub}>Pick a day and add a reason</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>

        {isModerator && pending.length ? (
          <>
            <Text style={styles.section}>NEEDS A DECISION · {pending.length}</Text>
            {pending.map((r) => (
              <RequestCard
                key={r.id}
                item={r}
                showName={isModerator}
                onApprove={() => decide(r, 'approved')}
                onDecline={() => decide(r, 'declined')}
                onCancel={r.user_id === user.id ? () => confirmCancel(r) : null}
                onHistory={() => setAuditFor(r)}
              />
            ))}
          </>
        ) : null}

        {!isModerator && pending.length ? (
          <>
            <Text style={styles.section}>AWAITING DECISION</Text>
            {pending.map((r) => (
              <RequestCard
                key={r.id}
                item={r}
                showName={false}
                onCancel={() => confirmCancel(r)}
                onHistory={() => setAuditFor(r)}
              />
            ))}
          </>
        ) : null}

        {decided.length ? (
          <>
            <Text style={styles.section}>
              {isModerator ? 'DECIDED' : 'YOUR HISTORY'} · {decided.length}
            </Text>
            {decided.map((r) => (
              <RequestCard
                key={r.id}
                item={r}
                showName={isModerator}
                onHistory={() => setAuditFor(r)}
              />
            ))}
          </>
        ) : null}

        {!pending.length && !decided.length ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={30} color={colors.muted} />
            <Text style={styles.emptyText}>
              {loading ? 'Loading…' : 'No leave requests yet.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <RequestModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        groupId={groupId}
        user={user}
        onDone={() => {
          setFormOpen(false);
          refresh();
        }}
      />

      <AuditModal item={auditFor} onClose={() => setAuditFor(null)} />
    </Screen>
  );
}

function RequestCard({ item, showName, onApprove, onDecline, onCancel, onHistory }) {
  const meta = STATUS_META[item.status] || STATUS_META.pending;
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        {showName ? (
          <View style={styles.cardWho}>
            <Avatar name={item.requester_name || 'Member'} size={32} />
            <Text style={styles.cardName} numberOfLines={1}>
              {item.requester_name || 'Group member'}
            </Text>
          </View>
        ) : (
          <Text style={styles.cardDate}>{prettyDate(item.date)}</Text>
        )}
        <View style={[styles.badge, { backgroundColor: meta.bg }]}>
          <Text style={[styles.badgeText, { color: meta.fg }]}>{meta.label}</Text>
        </View>
      </View>

      {showName ? <Text style={styles.cardDateInline}>{prettyDate(item.date)}</Text> : null}
      {item.reason ? <Text style={styles.cardReason}>{item.reason}</Text> : null}

      {item.attachment_url ? (
        <Image source={{ uri: item.attachment_url }} style={styles.slip} resizeMode="cover" />
      ) : null}

      {item.status !== 'pending' && item.decided_by_name ? (
        <Text style={styles.decidedBy}>
          {item.status === 'approved' ? 'Approved' : 'Declined'} by {item.decided_by_name}
        </Text>
      ) : null}

      <View style={styles.cardActions}>
        {onApprove ? (
          <Pressable onPress={onApprove} style={({ pressed }) => [styles.actBtn, styles.actApprove, pressed && styles.pressed]}>
            <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
            <Text style={styles.actApproveText}>Approve</Text>
          </Pressable>
        ) : null}
        {onDecline ? (
          <Pressable onPress={onDecline} style={({ pressed }) => [styles.actBtn, styles.actDecline, pressed && styles.pressed]}>
            <Ionicons name="close" size={16} color={colors.accent} />
            <Text style={styles.actDeclineText}>Decline</Text>
          </Pressable>
        ) : null}
        {onCancel ? (
          <Pressable onPress={onCancel} style={({ pressed }) => [styles.actBtn, styles.actGhost, pressed && styles.pressed]}>
            <Text style={styles.actGhostText}>Withdraw</Text>
          </Pressable>
        ) : null}
        {onHistory ? (
          <Pressable onPress={onHistory} style={({ pressed }) => [styles.actBtn, styles.actGhost, pressed && styles.pressed]}>
            <Ionicons name="time-outline" size={15} color={colors.inkSoft} />
            <Text style={styles.actGhostText}>History</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function RequestModal({ visible, onClose, groupId, user, onDone }) {
  const [date, setDate] = useState(() => dateStr(new Date()));
  const [reason, setReason] = useState('');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const days = nextDays(14);

  function reset() {
    setDate(dateStr(new Date()));
    setReason('');
    setPhoto(null);
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      notify({ title: 'Permission needed', message: 'Allow photo access to attach a slip.' });
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (res.canceled) return;
    const a = res.assets[0];
    setPhoto({ uri: a.uri, name: a.fileName || `slip-${Date.now()}.jpg`, mime: a.mimeType || 'image/jpeg' });
  }

  async function uploadPhoto() {
    if (!photo) return null;
    const ext = (photo.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${groupId}/${user.id}/leave-${Date.now()}.${ext}`;
    let body;
    if (Platform.OS === 'web') {
      body = await (await fetch(photo.uri)).blob();
    } else {
      const base64 = await FileSystem.readAsStringAsync(photo.uri, { encoding: 'base64' });
      body = decode(base64);
    }
    const { error } = await supabase.storage
      .from('attachments')
      .upload(path, body, { contentType: photo.mime, upsert: false });
    if (error) throw error;
    return supabase.storage.from('attachments').getPublicUrl(path).data.publicUrl;
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      const attachmentUrl = await uploadPhoto();
      await requestLeave({ groupId, date, reason: reason.trim(), name: user.name, attachmentUrl });
      reset();
      onDone();
    } catch (e) {
      notify({ title: 'Could not send request', message: (e && e.message) || 'Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Request leave</Text>

          <Text style={styles.fieldLabel}>WHICH DAY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayRow}
          >
            {days.map((d) => {
              const s = dateStr(d);
              const on = s === date;
              return (
                <Pressable
                  key={s}
                  onPress={() => setDate(s)}
                  style={[styles.dayChip, on && styles.dayChipOn]}
                >
                  <Text style={[styles.dayChipDow, on && styles.dayChipTextOn]}>{DAYS[d.getDay()]}</Text>
                  <Text style={[styles.dayChipNum, on && styles.dayChipTextOn]}>{d.getDate()}</Text>
                  <Text style={[styles.dayChipMon, on && styles.dayChipTextOn]}>{MONTHS[d.getMonth()]}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.fieldLabel}>REASON</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. clinic appointment"
            placeholderTextColor={colors.muted}
            style={styles.reasonInput}
            multiline
          />

          <Pressable onPress={pickPhoto} style={({ pressed }) => [styles.attachRow, pressed && styles.pressed]}>
            <Ionicons name={photo ? 'checkmark-circle' : 'camera-outline'} size={20} color={photo ? colors.success : colors.inkSoft} />
            <Text style={styles.attachText}>
              {photo ? 'Slip photo attached' : 'Attach a photo of a slip (optional)'}
            </Text>
            {photo ? (
              <Pressable onPress={() => setPhoto(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </Pressable>

          <View style={styles.sheetActions}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.sheetBtn, styles.sheetCancel, pressed && styles.pressed]}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [styles.sheetBtn, styles.sheetSubmit, pressed && styles.pressed]}
            >
              {busy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.sheetSubmitText}>Send request</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AuditModal({ item, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!item) return;
      let active = true;
      setLoading(true);
      fetchLeaveAudit(item.id).then((r) => {
        if (active) {
          setRows(r);
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }, [item])
  );

  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.auditBackdrop} onPress={onClose}>
        <Pressable style={styles.auditCard} onPress={() => {}}>
          <Text style={styles.auditTitle}>History</Text>
          {loading ? (
            <ActivityIndicator color={colors.inkSoft} style={{ marginVertical: spacing.lg }} />
          ) : rows.length === 0 ? (
            <Text style={styles.auditEmpty}>No history recorded.</Text>
          ) : (
            rows.map((r, i) => (
              <View key={r.id} style={[styles.auditRow, i < rows.length - 1 && styles.auditRowBorder]}>
                <View style={[styles.auditDot, { backgroundColor: (STATUS_META[r.action] || STATUS_META.pending).fg }]} />
                <View style={styles.auditBody}>
                  <Text style={styles.auditAction}>
                    {r.action.charAt(0).toUpperCase() + r.action.slice(1)}
                    {r.actor_name ? ` · ${r.actor_name}` : ''}
                  </Text>
                  {r.note ? <Text style={styles.auditNote}>{r.note}</Text> : null}
                  <Text style={styles.auditTime}>{new Date(r.created_at).toLocaleString()}</Text>
                </View>
              </View>
            ))
          )}
          <Pressable onPress={onClose} style={({ pressed }) => [styles.auditClose, pressed && styles.pressed]}>
            <Text style={styles.auditCloseText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  pressed: { opacity: 0.85 },

  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  requestIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestBody: { flex: 1, marginLeft: spacing.md },
  requestTitle: { ...type.bodyStrong, color: colors.ink },
  requestSub: { ...type.caption, color: colors.muted, marginTop: 1 },

  section: {
    ...type.monoLabel,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.muted,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardWho: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  cardName: { ...type.bodyStrong, color: colors.ink, flex: 1 },
  cardDate: { fontFamily: monoFamily, fontSize: 14, fontWeight: '600', color: colors.ink },
  cardDateInline: { fontFamily: monoFamily, fontSize: 12, color: colors.muted, marginTop: spacing.sm },
  badge: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  badgeText: { ...type.monoLabel, fontSize: 10 },
  cardReason: { ...type.body, color: colors.ink, marginTop: spacing.sm, lineHeight: 20 },
  slip: {
    width: '100%',
    height: 160,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.md,
  },
  decidedBy: { ...type.caption, color: colors.muted, marginTop: spacing.sm },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  actBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  actApprove: { backgroundColor: colors.success },
  actApproveText: { ...type.caption, fontWeight: '700', color: colors.onPrimary },
  actDecline: { backgroundColor: colors.accentSoft },
  actDeclineText: { ...type.caption, fontWeight: '700', color: colors.accent },
  actGhost: { backgroundColor: colors.surfaceAlt },
  actGhostText: { ...type.caption, fontWeight: '700', color: colors.inkSoft },

  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyText: { ...type.body, color: colors.muted },

  // request sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: { ...type.title, fontSize: 19, color: colors.ink, marginBottom: spacing.lg },
  fieldLabel: { ...type.monoLabel, fontSize: 10, letterSpacing: 1, color: colors.muted, marginBottom: spacing.sm },
  dayRow: { gap: spacing.sm, paddingBottom: spacing.lg },
  dayChip: {
    width: 54,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    gap: 1,
  },
  dayChipOn: { backgroundColor: colors.primary },
  dayChipDow: { fontFamily: monoFamily, fontSize: 10, color: colors.muted },
  dayChipNum: { fontFamily: monoFamily, fontSize: 18, fontWeight: '600', color: colors.ink },
  dayChipMon: { fontFamily: monoFamily, fontSize: 10, color: colors.muted },
  dayChipTextOn: { color: colors.onPrimary },
  reasonInput: {
    ...type.body,
    color: colors.ink,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.md,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  attachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  attachText: { ...type.caption, color: colors.inkSoft, flex: 1 },
  sheetActions: { flexDirection: 'row', gap: spacing.md },
  sheetBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  sheetCancel: { backgroundColor: colors.surfaceAlt },
  sheetCancelText: { ...type.bodyStrong, color: colors.inkSoft },
  sheetSubmit: { backgroundColor: colors.primary },
  sheetSubmitText: { ...type.bodyStrong, color: colors.onPrimary },

  // audit
  auditBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  auditCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  auditTitle: { ...type.title, fontSize: 18, color: colors.ink, marginBottom: spacing.md },
  auditEmpty: { ...type.caption, color: colors.muted, marginVertical: spacing.lg },
  auditRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  auditRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  auditDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  auditBody: { flex: 1 },
  auditAction: { ...type.bodyStrong, fontSize: 14, color: colors.ink },
  auditNote: { ...type.caption, color: colors.inkSoft, marginTop: 2 },
  auditTime: { fontFamily: monoFamily, fontSize: 11, color: colors.muted, marginTop: 3 },
  auditClose: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  auditCloseText: { ...type.bodyStrong, color: colors.inkSoft },
});
