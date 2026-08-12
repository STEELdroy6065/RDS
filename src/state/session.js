import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { fetchMyProfile, saveMyProfile } from '../lib/profiles';

// Real auth session backed by Supabase. Exposes the current user plus the
// sign-up / sign-in / sign-out / password-reset calls. Also handles the
// password-recovery deep link that Supabase emails back into the app.

const SessionContext = createContext(null);

// Where Supabase should send the user after they click the reset email.
export const RESET_REDIRECT = Linking.createURL('reset-password');

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

// Pull auth params out of a deep link's query string and/or hash fragment.
function authParamsFromUrl(url) {
  const out = {};
  if (!url) return out;
  const grab = (str) => {
    if (!str) return;
    str.split('&').forEach((pair) => {
      const [k, v] = pair.split('=');
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  };
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  if (queryIndex !== -1) {
    grab(url.substring(queryIndex + 1, hashIndex === -1 ? undefined : hashIndex));
  }
  if (hashIndex !== -1) grab(url.substring(hashIndex + 1));
  return out;
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  // The signed-in user's own profile (real name + avatar), layered over the
  // auth metadata so edits show immediately.
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setInitializing(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });

    // Handle the recovery link (fresh launch + while running).
    const handleUrl = async (url) => {
      if (!url || url.indexOf('reset-password') === -1) return;
      const p = authParamsFromUrl(url);
      try {
        if (p.access_token && p.refresh_token) {
          await supabase.auth.setSession({
            access_token: p.access_token,
            refresh_token: p.refresh_token,
          });
        } else if (p.code) {
          await supabase.auth.exchangeCodeForSession(p.code);
        }
      } catch (e) {
        // ignore — the Set-new-password screen still lets them proceed if a
        // session was established, or shows an error if not.
      }
      setPasswordRecovery(true);
    };

    Linking.getInitialURL().then(handleUrl);
    const linkSub = Linking.addEventListener('url', (e) => handleUrl(e.url));

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  // Load the user's profile whenever the signed-in user changes.
  const userId = session && session.user ? session.user.id : null;
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let active = true;
    fetchMyProfile(userId).then((p) => {
      if (active) setProfile(p);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const baseUser = toUser(session);
  const user = baseUser
    ? {
        ...baseUser,
        name: (profile && profile.name) || baseUser.name,
        avatarUrl: (profile && profile.avatarUrl) || null,
      }
    : null;

  const value = useMemo(
    () => ({
      session,
      user,
      initializing,
      passwordRecovery,
      // Update the signed-in user's profile (name and/or avatar). Also mirrors
      // the name into auth metadata so it survives on other devices.
      updateProfile: async ({ name, avatarUrl }) => {
        if (!userId) return;
        await saveMyProfile(userId, { name, avatarUrl });
        if (name !== undefined) {
          try {
            await supabase.auth.updateUser({ data: { name } });
          } catch {
            /* metadata mirror is best-effort */
          }
        }
        const fresh = await fetchMyProfile(userId);
        setProfile(fresh);
      },
      signUp: ({ name, email, password }) =>
        supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        }),
      signIn: ({ email, password }) =>
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
      signOut: () => supabase.auth.signOut(),
      // Email a password-reset link back into the app.
      resetPassword: (email) =>
        supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: RESET_REDIRECT,
        }),
      // Set the new password (during a recovery session).
      updatePassword: (password) => supabase.auth.updateUser({ password }),
      // Leave the recovery flow once the password is set (or cancelled).
      endPasswordRecovery: () => setPasswordRecovery(false),
    }),
    [session, user, userId, initializing, passwordRecovery]
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
