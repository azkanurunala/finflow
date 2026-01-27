import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { syncService, SyncStatus } from "../services/syncService";

interface NetworkContextType {
  isOnline: boolean;
  isReachable: boolean;
  isSyncing: boolean;
  syncStatus: SyncStatus;
  syncMessage: string | null;
  lastSyncTime: number | null;
  forceSync: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isReachable, setIsReachable] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(state.isConnected ?? false);
      setIsReachable(state.isInternetReachable ?? false);
    });

    // Subscribe to sync status changes
    const unsubscribeSync = syncService.subscribe((status, message) => {
      setSyncStatus(status);
      setSyncMessage(message || null);
      setIsSyncing(status === "syncing");

      if (status === "success") {
        setLastSyncTime(Date.now());
      }
    });

    // Initial network check
    NetInfo.fetch().then((state) => {
      setIsOnline(state.isConnected ?? false);
      setIsReachable(state.isInternetReachable ?? false);
    });

    return () => {
      unsubscribeNetInfo();
      unsubscribeSync();
    };
  }, []);

  const forceSync = useCallback(async () => {
    return await syncService.forceSync();
  }, []);

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        isReachable,
        isSyncing,
        syncStatus,
        syncMessage,
        lastSyncTime,
        forceSync,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}
