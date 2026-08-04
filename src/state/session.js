import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';

// Real auth session backed by Supabase. Exposes the current user plus the
// sign-up / sign-in / sign-out calls. Screens that only need identity keep
// reading `user` exactly as before.

const SessionContext = createContext(null);

function toUser(session) {
  if (!session || !session.user) return null;
  const u = session.user;
  const metaName = u.user_metadata && u.user_metadata.name;
  return {
    id: u.id,
    email: u.email,
    name: metaName || (u.email ? u.email.split('@')[0] : 'Member'),
  };
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setInitializing(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: toUser(session),
      initializing,
      // Returns the raw Supabase result { data, error } so callers can surface
      // precise messages.
      signUp: ({ name, email, password }) =>
        supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        }),
      signIn: ({ email, password }) =>
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
      signOut: () => supabase.auth.signOut(),
    }),
    [session, initializing]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
