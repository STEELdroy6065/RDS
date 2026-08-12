import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
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
import { fetchSessions, createSession, updateSession, deleteSession } from '../../lib/sessions';
import { confirm, notify } from '../../lib/confirm';

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// The seven days of the week that contains `base` (Sunday first).
function weekDays(base = new Date()) {
  const start = new Date(base);
  start.setDate(base.getDate() - base.getDay());
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function fmtTime(hhmm) {
  const [h, m] = (hhmm || '').split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(h)) return hhmm || '';
  const ampm = h < 12 ? 'am' : 'pm';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m || 0).padStart(2, '0')}${ampm}`;
}

const VALID_TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;

export default function WeekScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const { user } = useSession();
  const { roleForGroup } = useGroups();
  const isModerator = ['Admin', 'Captain'].includes(roleForGroup(groupId));

  const days = useMemo(() => weekDays(), []);
  const todayIdx = new Date().getDay();
  const [selected, setSelected] = useState(todayIdx);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // 'new' | session object | null

  const load = useCallback(async () => {
    setLoading(true);
    setSessions(await fetchSessions(groupId));
    setLoading(false);
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const daySessions = sessions.filter((s) => s.weekday === selected);
  const selectedDate = days[selected];

  return (
    <Screen>
      <Header title="Your week" subtitle={groupName} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
      >
        {/* Day selector */}
        <View style={styles.dayRow}>
          {days.map((d, i) => {
            const on = i === selected;
            const isToday = i === todayIdx;
            return (
              <Pressable
                key={i}
                onPress={() => setSelected(i)}
                style={[styles.day, on && styles.dayOn]}
              >
                <Text style={[styles.dayDow, on && styles.dayTextOn]}>{DOW[i]}</Text>
                <Text style={[styles.dayNum, on && styles.dayTextOn]}>{d.getDate()}</Text>
                {isToday ? <View style={[styles.todayDot, on && styles.todayDotOn]} /> : null}
              </Pressable>
            );
          })}
        </View>

        {/* Timeline */}
        {daySessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing scheduled</Text>
            <Text style={styles.emptySub}>
              {isModerator
                ? 'Add a session and it appears on everyone’s week.'
                : 'Teachers add sessions once; they show up here.'}
            </Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {daySessions.map((s) => (
              <Pressable
                key={s.id}
                onPress={isModerator ? () => setEditing(s) : undefined}
                style={styles.tRow}
              >
                <Text style={styles.tTime}>{fmtTime(s.start_time)}</Text>
                <View style={styles.tLine}>
                  <View style={styles.tCard}>
                    <Text style={styles.tTitle}>{s.title}</Text>
                    {s.location ? <Text style={styles.tMeta}>{s.location}</Text> : null}
                    {s.note ? <Text style={styles.tNote}>{s.note}</Text> : null}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.footNote}>
          <Text style={styles.footTitle}>One session, one timeline</Text>
          <Text style={styles.footSub}>
            Sessions repeat every week on their day. {selectedDate ? DOW[selected] : ''} shows what’s on.
          </Text>
        </View>
      </ScrollView>

      {isModerator ? (
        <Pressable
          onPress={() => setEditing('new')}
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={26} color={colors.onPrimary} />
        </Pressable>
      ) : null}

      <SessionEditor
        editing={editing}
        defaultWeekday={selected}
        onClose={() => setEditing(null)}
        groupId={groupId}
        userId={user.id}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    </Screen>
  );
}

function SessionEditor({ editing, defaultWeekday, onClose, groupId, userId, onSaved }) {
  const isEdit = editing && editing !== 'new';
  const [title, setTitle] = useState('');
  const [weekday, setWeekday] = useState(defaultWeekday);
  const [time, setTime] = useState('09:00');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Seed fields whenever the editor opens.
  React.useEffect(() => {
    if (!editing) return;
    if (isEdit) {
      setTitle(editing.title || '');
      setWeekday(editing.weekday);
      setTime(editing.start_time || '09:00');
      setLocation(editing.location || '');
      setNote(editing.note || '');
    } else {
      setTitle('');
      setWeekday(defaultWeekday);
      setTime('09:00');
      setLocation('');
      setNote('');
    }
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (busy) return;
    if (!title.trim()) {
      notify({ title: 'Title required', message: 'Give the session a name.' });
      return;
    }
    if (!VALID_TIME.test(time)) {
      notify({ title: 'Check the time', message: 'Use 24-hour HH:MM, e.g. 09:00 or 14:30.' });
      return;
    }
    setBusy(true);
    try {
      if (isEdit) {
        await updateSession(editing.id, { title, weekday, startTime: time, location, note });
      } else {
        await createSession({ groupId, userId, title, weekday, startTime: time, location, note });
      }
      onSaved();
    } catch (e) {
      notify({ title: 'Could not save', message: (e && e.message) || 'Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  function onDelete() {
    confirm({
      title: 'Delete session?',
      message: 'It will be removed from everyone’s week.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteSession(editing.id);
          onSaved();
        } catch (e) {
          notify({ title: 'Could not delete', message: (e && e.message) || 'Please try again.' });
        }
      },
    });
  }

  return (
    <Modal visible={!!editing} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{isEdit ? 'Edit session' : 'Add session'}</Text>

          <Text style={styles.fieldLabel}>TITLE</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. HRM Principles"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>DAY</Text>
          <View style={styles.dowRow}>
            {DOW.map((d, i) => {
              const on = i === weekday;
              return (
                <Pressable key={i} onPress={() => setWeekday(i)} style={[styles.dowChip, on && styles.dowChipOn]}>
                  <Text style={[styles.dowChipText, on && styles.dayTextOn]}>{d}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.fieldLabel}>TIME (HH:MM)</Text>
              <TextInput
                value={time}
                onChangeText={setTime}
                placeholder="09:00"
                placeholderTextColor={colors.muted}
                keyboardType="numbers-and-punctuation"
                style={styles.input}
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.fieldLabel}>ROOM (OPTIONAL)</Text>
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="Room B4"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>NOTE (OPTIONAL)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Bring workbook"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <View style={styles.sheetActions}>
            {isEdit ? (
              <Pressable onPress={onDelete} style={({ pressed }) => [styles.delBtn, pressed && styles.pressed]}>
                <Ionicons name="trash-outline" size={20} color={colors.accent} />
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} style={({ pressed }) => [styles.sheetBtn, styles.sheetCancel, pressed && styles.pressed]}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} disabled={busy} style={({ pressed }) => [styles.sheetBtn, styles.sheetSave, pressed && styles.pressed]}>
              {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.sheetSaveText}>Save</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  pressed: { opacity: 0.85 },

  dayRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.lg },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    gap: 3,
  },
  dayOn: { backgroundColor: colors.primary },
  dayDow: { fontFamily: monoFamily, fontSize: 10, color: colors.muted },
  dayNum: { ...type.bodyStrong, fontSize: 16, color: colors.ink },
  dayTextOn: { color: colors.onPrimary },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  todayDotOn: { backgroundColor: colors.onPrimary },

  timeline: {},
  tRow: { flexDirection: 'row', gap: spacing.md },
  tTime: { fontFamily: monoFamily, fontSize: 12, color: colors.muted, width: 56, paddingTop: spacing.lg },
  tLine: { flex: 1, borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: spacing.md, paddingBottom: spacing.md },
  tCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  tTitle: { ...type.bodyStrong, color: colors.ink },
  tMeta: { ...type.caption, color: colors.muted, marginTop: 3 },
  tNote: { ...type.caption, color: colors.inkSoft, marginTop: 3 },

  emptyCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  emptyTitle: { ...type.bodyStrong, color: colors.ink },
  emptySub: { ...type.caption, color: colors.muted, marginTop: 4, lineHeight: 18 },

  footNote: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider },
  footTitle: { ...type.bodyStrong, fontSize: 14, color: colors.ink },
  footSub: { ...type.caption, color: colors.muted, marginTop: 3, lineHeight: 18 },

  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // editor sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  sheetTitle: { ...type.title, fontSize: 19, color: colors.ink, marginBottom: spacing.md },
  fieldLabel: { ...type.monoLabel, fontSize: 10, letterSpacing: 1, color: colors.muted, marginBottom: spacing.sm, marginTop: spacing.sm },
  input: {
    ...type.body,
    color: colors.ink,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  dowRow: { flexDirection: 'row', gap: 4 },
  dowChip: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  dowChipOn: { backgroundColor: colors.primary },
  dowChipText: { fontFamily: monoFamily, fontSize: 10, color: colors.muted },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  col: { flex: 1 },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, alignItems: 'center' },
  delBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  sheetCancel: { backgroundColor: colors.surfaceAlt },
  sheetCancelText: { ...type.bodyStrong, color: colors.inkSoft },
  sheetSave: { backgroundColor: colors.primary },
  sheetSaveText: { ...type.bodyStrong, color: colors.onPrimary },
});
