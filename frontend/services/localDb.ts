import * as SQLite from "expo-sqlite";
import { mark, measure } from "../utils/perf";

const DB_NAME = "finflow.db";

export interface LocalTransaction {
  id: string;
  amount: number;
  currency: string;
  merchant: string | null;
  category: string;
  date: string;
  transaction_type: "income" | "expense";
  notes: string | null;
  source: string;
  sync_status: "synced" | "pending" | "deleted";
  last_updated: number;
}

let dbInstance: SQLite.SQLiteDatabase | null = null;

// Promise to track DB initialization status
let dbReadyResolve: () => void;
const dbReady = new Promise<void>((resolve) => {
  dbReadyResolve = resolve;
});

export const waitForDb = async () => {
  await dbReady;
};

export const getLocalDb = async () => {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbInstance;
};

export const initDb = async () => {
  const db = await getLocalDb();

  // Transactions table
  // We include sync_status to track if it needs pushing to remote
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      merchant TEXT,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      notes TEXT,
      source TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      last_updated INTEGER NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS sync_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT NOT NULL,
      action TEXT NOT NULL, -- 'create', 'update', 'delete'
      payload TEXT, -- JSON string of the transaction
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tx_sync_date ON transactions(sync_status, date DESC);
    CREATE INDEX IF NOT EXISTS idx_tx_last_updated ON transactions(last_updated);
    CREATE INDEX IF NOT EXISTS idx_outbox_ts ON sync_outbox(timestamp);
  `);

  // Mark DB as ready
  if (dbReadyResolve) dbReadyResolve();

  mark("db.initComplete");
  measure("app.bootStart", "db.initComplete", "db.initFromBoot");
};

// getLocalDb is now defined at the top

// Save or delete transactions based on sync data
export const saveTransactionsLocally = async (transactions: any[]) => {
  invalidateSummaryMemo();
  const db = await getLocalDb();

  await db.withTransactionAsync(async () => {
    for (const tx of transactions) {
      if (tx.is_deleted) {
        // If server says deleted, remove locally
        await db.runAsync(
          "DELETE FROM transactions WHERE id = ?",
          [tx.id || tx._id]
        );
      } else {
        // Upsert
        await db.runAsync(
          `INSERT OR REPLACE INTO transactions 
          (id, amount, currency, merchant, category, date, transaction_type, notes, source, sync_status, last_updated) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tx.id || tx._id,
            tx.amount,
            tx.currency,
            tx.merchant || null,
            tx.category,
            tx.date,
            tx.transaction_type,
            tx.notes || null,
            tx.source || "manual",
            "synced",
            // Use updated_at from server if available (as ms timestamp), else current time
            tx.updated_at ? new Date(tx.updated_at).getTime() : Date.now()
          ]
        );
      }
    }
  });
};

export const getTransactionsLocally = async (limit = 100): Promise<LocalTransaction[]> => {
  const db = await getLocalDb();
  const results = await db.getAllAsync<LocalTransaction>(
    "SELECT * FROM transactions WHERE sync_status != 'deleted' ORDER BY date DESC LIMIT ?",
    [limit]
  );
  return results;
};

export const addPendingTransaction = async (tx: any) => {
  invalidateSummaryMemo();
  const db = await getLocalDb();
  const id = tx.id || `local_${Date.now()}`;
  
  await db.runAsync(
    `INSERT INTO transactions 
    (id, amount, currency, merchant, category, date, transaction_type, notes, source, sync_status, last_updated) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      tx.amount,
      tx.currency,
      tx.merchant || null,
      tx.category,
      tx.date,
      tx.transaction_type,
      tx.notes || null,
      tx.source || "manual",
      "pending",
      Date.now()
    ]
  );

  await db.runAsync(
    `INSERT INTO sync_outbox (transaction_id, action, payload, timestamp) VALUES (?, ?, ?, ?)`,
    [id, "create", JSON.stringify(tx), Date.now()]
  );

  return id;
};

// PG12 — single-query summary with 1s mount-flurry memo. Home, history,
// and insights all call getSummaryLocally on focus; without the memo
// the same two scans run three times in quick succession on cold nav.
type SummaryShape = { total_income: number; total_expenses: number };
const SUMMARY_MEMO_TTL_MS = 1000;
let summaryMemo: { at: number; value: SummaryShape } | null = null;

export const invalidateSummaryMemo = () => {
  summaryMemo = null;
};

export const getSummaryLocally = async (): Promise<SummaryShape> => {
  if (summaryMemo && Date.now() - summaryMemo.at < SUMMARY_MEMO_TTL_MS) {
    return summaryMemo.value;
  }

  const db = await getLocalDb();

  const row = await db.getFirstAsync<{ income: number; expenses: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN transaction_type = 'income'  THEN amount ELSE 0 END), 0) AS income,
       COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) AS expenses
     FROM transactions
     WHERE sync_status != 'deleted'`
  );

  const value: SummaryShape = {
    total_income: row?.income ?? 0,
    total_expenses: row?.expenses ?? 0,
  };
  summaryMemo = { at: Date.now(), value };
  return value;
};

// Update an existing transaction locally
export const updateLocalTransaction = async (
  id: string,
  updates: Partial<LocalTransaction>,
  markAsPending = true
) => {
  invalidateSummaryMemo();
  const db = await getLocalDb();

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.amount !== undefined) {
    fields.push("amount = ?");
    values.push(updates.amount);
  }
  if (updates.currency !== undefined) {
    fields.push("currency = ?");
    values.push(updates.currency);
  }
  if (updates.merchant !== undefined) {
    fields.push("merchant = ?");
    values.push(updates.merchant);
  }
  if (updates.category !== undefined) {
    fields.push("category = ?");
    values.push(updates.category);
  }
  if (updates.date !== undefined) {
    fields.push("date = ?");
    values.push(updates.date);
  }
  if (updates.transaction_type !== undefined) {
    fields.push("transaction_type = ?");
    values.push(updates.transaction_type);
  }
  if (updates.notes !== undefined) {
    fields.push("notes = ?");
    values.push(updates.notes);
  }

  if (markAsPending) {
    fields.push("sync_status = ?");
    values.push("pending");
  }

  fields.push("last_updated = ?");
  values.push(Date.now());
  values.push(id);

  if (fields.length > 1) {
    await db.runAsync(
      `UPDATE transactions SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    if (markAsPending) {
      // Add to outbox for sync
      const tx = await db.getFirstAsync<LocalTransaction>(
        "SELECT * FROM transactions WHERE id = ?",
        [id]
      );
      if (tx) {
        await db.runAsync(
          `INSERT INTO sync_outbox (transaction_id, action, payload, timestamp) VALUES (?, ?, ?, ?)`,
          [id, "update", JSON.stringify(tx), Date.now()]
        );
      }
    }
  }
};

// Soft-delete a transaction (mark as deleted for sync)
export const deleteLocalTransaction = async (id: string) => {
  invalidateSummaryMemo();
  const db = await getLocalDb();

  await db.runAsync(
    `UPDATE transactions SET sync_status = 'deleted', last_updated = ? WHERE id = ?`,
    [Date.now(), id]
  );

  await db.runAsync(
    `INSERT INTO sync_outbox (transaction_id, action, payload, timestamp) VALUES (?, ?, ?, ?)`,
    [id, "delete", JSON.stringify({ id }), Date.now()]
  );
};

// Get all pending changes from outbox for sync
export const getPendingChanges = async (): Promise<
  Array<{
    id: number;
    transaction_id: string;
    action: string;
    payload: string;
    timestamp: number;
  }>
> => {
  const db = await getLocalDb();
  return await db.getAllAsync(
    "SELECT * FROM sync_outbox ORDER BY timestamp ASC"
  );
};

// Remove synced items from outbox
export const clearSyncedOutbox = async (ids: number[]) => {
  if (ids.length === 0) return;
  const db = await getLocalDb();
  const placeholders = ids.map(() => "?").join(",");
  await db.runAsync(
    `DELETE FROM sync_outbox WHERE id IN (${placeholders})`,
    ids
  );
};

// Get last sync timestamp
export const getLastSyncTimestamp = async (): Promise<number> => {
  const db = await getLocalDb();
  
  // Ensure metadata table exists - handled in initDb now

  const result = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM sync_metadata WHERE key = 'last_sync'"
  );
  return result ? parseInt(result.value, 10) : 0;
};

// Set last sync timestamp
export const setLastSyncTimestamp = async (timestamp: number) => {
  const db = await getLocalDb();
  
  // Table created in initDb

  await db.runAsync(
    `INSERT OR REPLACE INTO sync_metadata (key, value) VALUES ('last_sync', ?)`,
    [timestamp.toString()]
  );
};

// Update transaction sync status after successful sync
export const markTransactionSynced = async (localId: string, remoteId?: string) => {
  const db = await getLocalDb();
  
  if (remoteId && localId !== remoteId) {
    // Update local ID to match remote ID
    await db.runAsync(
      `UPDATE transactions SET id = ?, sync_status = 'synced' WHERE id = ?`,
      [remoteId, localId]
    );
  } else {
    await db.runAsync(
      `UPDATE transactions SET sync_status = 'synced' WHERE id = ?`,
      [localId]
    );
  }
};

// Permanently delete transactions marked as deleted after sync
export const purgeDeletedTransactions = async () => {
  invalidateSummaryMemo();
  const db = await getLocalDb();
  await db.runAsync(
    "DELETE FROM transactions WHERE sync_status = 'deleted'"
  );
};
