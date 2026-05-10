import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { syncService, SyncStatus } from "../services/syncService";
import { CONFIG } from "../constants/Config";

// G14 — backend reachability is distinct from device connectivity. The device may
// be on Wi-Fi but our API host may be down or DNS-unreachable. `isBackendHealthy`
// reflects the result of the most recent /api/health probe.
interface NetworkContextType {
  isOnline: boolean;
  isReachable: boolean;
  isBackendHealthy: boolean;
  lastBackendCheck: number | null;
  isSyncing: boolean;
  syncStatus: SyncStatus;
  syncMessage: string | null;
  lastSyncTime: number | null;
  forceSync: () => Promise<boolean>;
  pingBackend: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isReachable, setIsReachable] = useState(true);
  const [isBackendHealthy, setIsBackendHealthy] = useState(true);
  const [lastBackendCheck, setLastBackendCheck] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const pingBackend = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${CONFIG.BACKEND_URL}/api/health`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const ok = res.ok;
      setIsBackendHealthy(ok);
      setLastBackendCheck(Date.now());
      return ok;
    } catch {
      setIsBackendHealthy(false);
      setLastBackendCheck(Date.now());
      return false;
    }
  }, []);

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

    // G14 — cold-boot backend reachability probe.
    pingBackend();

    return () => {
      unsubscribeNetInfo();
      unsubscribeSync();
    };
  }, [pingBackend]);

  const forceSync = useCallback(async () => {
    return await syncService.forceSync();
  }, []);

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        isReachable,
        isBackendHealthy,
        lastBackendCheck,
        isSyncing,
        syncStatus,
        syncMessage,
        lastSyncTime,
        forceSync,
        pingBackend,
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
