import React, { createContext, useContext, useMemo } from 'react';
import { currentUser } from '../data/mock';

// Lightweight "who am I" layer. Today it just wraps the hardcoded mock user;
// every screen reads identity through this hook, so the day real auth arrives,
// only this file changes. (Per-group permission role lives with each group in
// the GroupsProvider — see src/state/groups.js.)

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const value = useMemo(() => ({ user: currentUser }), []);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
