import React, { createContext, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

// Tracks connectivity across the app (works on native + web via NetInfo).
const NetworkContext = createContext({ online: true });

function isOnline(state) {
  // Treat unknown reachability as online — only report offline when we're sure.
  return state.isConnected !== false && state.isInternetReachable !== false;
}

export function NetworkProvider({ children }) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => setOnline(isOnline(state)));
    NetInfo.fetch()
      .then((state) => setOnline(isOnline(state)))
      .catch(() => {});
    return () => unsub && unsub();
  }, []);

  return <NetworkContext.Provider value={{ online }}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  return useContext(NetworkContext);
}
