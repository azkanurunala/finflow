import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { apiClient } from "../api/client";
import {
  getLocalDb,
  saveTransactionsLocally,
  getPendingChanges,
  markTransactionSynced,
  purgeDeletedTransactions,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
  waitForDb,
} from "./localDb";
import { useRefreshStore } from "../store/useRefreshStore";
import { mark, measure } from "../utils/perf";

export type SyncStatus = "idle" | "syncing" | "success" | "error";

type SyncListener = (status: SyncStatus, message?: string) => void;

class SyncService {
  private isSyncing = false;
  private isOnline = false;
  private isReachable = false;
  private listeners: Set<SyncListener> = new Set();
  private currentStatus: SyncStatus = "idle";
  private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isDbReady = false;

  constructor() {
    this.init();
  }

  private init() {
    // Listen for network changes
    NetInfo.addEventListener((state: NetInfoState) => {
      this.isOnline = state.isConnected ?? false;
      this.isReachable = state.isInternetReachable ?? false;

      console.log(
        `[SyncService] Network state: connected=${this.isOnline}, reachable=${this.isReachable}`
      );

      if (this.isOnline && this.isReachable) {
        console.log("[SyncService] Connected! scheduling background sync...");
        this.debouncedSync();
      }
    });

    // Initial network check
    NetInfo.fetch().then((state) => {
      this.isOnline = state.isConnected ?? false;
      this.isReachable = state.isInternetReachable ?? false;
      
      // Also wait for DB to be ready before thinking about initial sync
      waitForDb().then(() => {
        this.isDbReady = true;
        if (this.isOnline && this.isReachable) {
          this.debouncedSync();
        }
      });
    });
  }

  // Subscribe to sync status changes
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current status
    listener(this.currentStatus);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(status: SyncStatus, message?: string) {
    this.currentStatus = status;
    this.listeners.forEach((listener) => listener(status, message));
  }

  // Check if currently online
  getNetworkStatus() {
    return {
      isOnline: this.isOnline,
      isReachable: this.isReachable,
      isSyncing: this.isSyncing,
    };
  }

  // Debounced sync to prevent loops
  debouncedSync() {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    
    this.syncDebounceTimer = setTimeout(() => {
      this.syncWithRemote();
    }, 2000); // 2 second debounce
  }

  async syncWithRemote(): Promise<boolean> {
    // Wait for DB if not ready (though we try to avoid calling this before ready)
    if (!this.isDbReady) {
      await waitForDb();
      this.isDbReady = true;
    }

    if (this.isSyncing) {
      console.log("[SyncService] Already syncing, skipping...");
      return false;
    }

    if (!this.isOnline || !this.isReachable) {
      console.log("[SyncService] Offline, skipping sync");
      return false;
    }

    this.isSyncing = true;
    this.notifyListeners("syncing", "Menyinkronkan data...");
    mark("sync.drainStart");

    try {
      console.log("[SyncService] Starting Sync Process...");

      // 1. Push pending changes from outbox
      const pushSuccess = await this.pushPendingChanges();

      // 2. Pull latest data from remote
      await this.pullLatestData();

      // 3. Purge locally deleted items that have been synced
      await purgeDeletedTransactions();

      // 4. Update last sync timestamp (handled inside pullLatestData now for accuracy)
      // await setLastSyncTimestamp(Date.now());

      // 5. Notify app components to refresh from local DB
      useRefreshStore.getState().triggerRefresh();

      console.log("[SyncService] Sync Process Completed.");
      this.notifyListeners("success", "Sinkronisasi selesai");

      mark("sync.drainComplete");
      measure("sync.drainStart", "sync.drainComplete", "sync.drainDuration");
      return true;
    } catch (error) {
      console.error("[SyncService] Sync failed:", error);
      this.notifyListeners("error", "Gagal sinkronisasi");
      return false;
    } finally {
      this.isSyncing = false;
      // Reset to idle after a delay
      setTimeout(() => {
        if (this.currentStatus !== "syncing") {
          this.notifyListeners("idle");
        }
      }, 3000);
    }
  }

  private async pushPendingChanges(): Promise<boolean> {
    const pendingChanges = await getPendingChanges();

    if (pendingChanges.length === 0) {
      console.log("[SyncService] No pending changes to push");
      return true;
    }

    console.log(`[SyncService] Push: ${pendingChanges.length} pending changes`);

    const db = await getLocalDb();
    let allSuccess = true;

    for (const change of pendingChanges) {
      try {
        const payload = JSON.parse(change.payload);

        if (change.action === "create") {
          const response = await apiClient.post(
            "/api/transactions/manual",
            payload
          );

          // Update local ID if it was temporary
          const remoteId = response.data.id || response.data._id;
          await markTransactionSynced(change.transaction_id, remoteId);

          console.log(
            `[SyncService] Push: SUCCESS - created transaction ${remoteId}`
          );
        } else if (change.action === "update") {
          // Skip if it's a local-only transaction (starts with 'local_')
          if (!change.transaction_id.startsWith("local_")) {
            await apiClient.put(
              `/api/transactions/${change.transaction_id}`,
              payload
            );
            await markTransactionSynced(change.transaction_id);
            console.log(
              `[SyncService] Push: SUCCESS - updated transaction ${change.transaction_id}`
            );
          }
        } else if (change.action === "delete") {
          // Skip if it's a local-only transaction
          if (!change.transaction_id.startsWith("local_")) {
            try {
              await apiClient.delete(
                `/api/transactions/${change.transaction_id}`
              );
              console.log(
                `[SyncService] Push: SUCCESS - deleted transaction ${change.transaction_id}`
              );
            } catch (deleteError: any) {
              // 404 is fine - already deleted on server
              if (deleteError.response?.status !== 404) {
                throw deleteError;
              }
            }
          }
        }

        // Remove from outbox after success
        await db.runAsync("DELETE FROM sync_outbox WHERE id = ?", [change.id]);
      } catch (error: any) {
        console.error(
          `[SyncService] Failed to push change ${change.id}:`,
          error.message
        );

        // If it's a 400/404 error, discard the change (invalid data)
        if (
          error.response?.status === 400 ||
          error.response?.status === 404
        ) {
          console.log(
            `[SyncService] Discarding invalid change ${change.id} (${error.response?.status})`
          );
          await db.runAsync("DELETE FROM sync_outbox WHERE id = ?", [change.id]);
        } else {
          // For other errors (network, 500), stop and retry later
          allSuccess = false;
          break;
        }
      }
    }

    return allSuccess;
  }

  private async pullLatestData(): Promise<void> {
    try {
      // Get last sync timestamp
      const lastSync = await getLastSyncTimestamp();
      let url = "/api/transactions?limit=100";
      
      // If we have a last sync time, use it for delta sync
      if (lastSync > 0) {
        const isoDate = new Date(lastSync).toISOString();
        url += `&updated_after=${isoDate}`;
        console.log(`[SyncService] Delta Sync: fetching changes since ${isoDate}`);
      } else {
        console.log("[SyncService] Initial Sync: fetching all active transactions");
      }

      const response = await apiClient.get(url);

      if (response.data && response.data.data) {
        const transactions = response.data.data as any[];
        const nextCursor = response.data.next_cursor; // Expect ISO string from server
        
        console.log(
          `[SyncService] Pull: ${transactions.length} items from server`
        );

        await saveTransactionsLocally(transactions);
        
        // If server provided a cursor (latest updated_at), save it
        if (nextCursor) {
          const nextSyncTimestamp = new Date(nextCursor).getTime();
          if (!isNaN(nextSyncTimestamp)) {
             await setLastSyncTimestamp(nextSyncTimestamp);
             console.log(`[SyncService] Updated last sync context to ${nextCursor}`);
          }
        } else if (transactions.length > 0) {
           // Fallback: use current time if no cursor (server didn't support it)
           // But normally we trust the server's next_cursor
           await setLastSyncTimestamp(Date.now());
        }
        
        // Pagination handling: if has_more, we should ideally fetch again
        // For simplicity in this iteration, we just sync what we got. 
        // A more robust implementation would loop until has_more is false.
        
        console.log("[SyncService] Applied remote changes to local DB");
      } else if (response.data && response.data.transactions) {
         // Fallback for legacy format (if server not fully updated or providing partial fallback)
         const transactions = response.data.transactions;
         await saveTransactionsLocally(transactions);
         await setLastSyncTimestamp(Date.now());
      }
    } catch (error) {
      console.error("[SyncService] Failed to pull latest data:", error);
      throw error;
    }
  }

  // Force sync (called manually by user)
  async forceSync(): Promise<boolean> {
    // Reset online status check
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected ?? false;
    this.isReachable = state.isInternetReachable ?? false;

    return this.syncWithRemote();
  }
}

export const syncService = new SyncService();
