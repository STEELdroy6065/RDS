import React, { createContext, useContext, useMemo } from 'react';
import { currentUser } from '../data/mock';

// Lightweight "who am I" layer. Today it just wraps the hardcoded mock user,
// but every screen reads identity + per-group role through this hook — so the
// day real auth arrives, only this file changes.

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const value = useMemo(
    () => ({
      user: currentUser,
      // Permission role of the current user within a given group.
      roleInGroup: (groupId) => currentUser.rolesByGroup[groupId] || 'Member',
    }),
    []
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
