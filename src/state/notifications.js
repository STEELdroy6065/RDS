import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';
import { useSession } from './session';

// In-app notifications for the logged-in user. Loaded when the app opens and
// refreshed when the Alerts screen is focused. Rows are created server-side by
// triggers (see supabase/notifications.sql).

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { user } = useSession();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('id, group_id, type, message, entity_id, read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60);
    if (!error) setItems(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markRead = useCallback(async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  }, []);

  const markAllRead = useCallback(async () => {
    const unreadIds = items.filter((n) => !n.read).map((n) => n.id);
    if (!unreadIds.length) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      loading,
      unreadCount: items.filter((n) => !n.read).length,
      refresh,
      markRead,
      markAllRead,
    }),
    [items, loading, refresh, markRead, markAllRead]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
}
