/**
 * PG3 — assert initDb issues CREATE INDEX statements for the three
 * hot query paths: history list, sync delta lookup, outbox drain order.
 *
 * Mock factory keeps all jest.fn() definitions inline and we retrieve
 * the handle via jest.requireMock to dodge the jest@30 + babel-preset-expo
 * TDZ trap documented in Iter 0 (see LIVING_PRD.md Gate 0).
 */

jest.mock('expo-sqlite', () => {
  const execAsync = jest.fn().mockResolvedValue(undefined);
  const dbHandle = {
    execAsync,
    runAsync: jest.fn(),
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    withTransactionAsync: jest.fn(),
  };
  const openDatabaseAsync = jest.fn().mockResolvedValue(dbHandle);
  return {
    __esModule: true,
    default: { openDatabaseAsync },
    openDatabaseAsync,
  };
});

jest.mock('../utils/perf', () => ({
  __esModule: true,
  mark: jest.fn(),
  measure: jest.fn(),
}));

const sqliteMock = jest.requireMock('expo-sqlite') as {
  openDatabaseAsync: jest.Mock;
};

import { initDb } from '../services/localDb';

const getLastExecAsyncCallDdl = async (): Promise<string> => {
  const dbHandle = await sqliteMock.openDatabaseAsync.mock.results[0].value;
  const execMock = dbHandle.execAsync as jest.Mock;
  return execMock.mock.calls[0][0] as string;
};

describe('PG3 — SQLite indexes', () => {
  beforeAll(async () => {
    await initDb();
  });

  it('creates idx_tx_sync_date on (sync_status, date DESC) for the history list query', async () => {
    const ddl = await getLastExecAsyncCallDdl();
    expect(ddl).toMatch(/CREATE INDEX IF NOT EXISTS\s+idx_tx_sync_date\s+ON transactions\(sync_status,\s*date DESC\)/);
  });

  it('creates idx_tx_last_updated on (last_updated) for the sync delta query', async () => {
    const ddl = await getLastExecAsyncCallDdl();
    expect(ddl).toMatch(/CREATE INDEX IF NOT EXISTS\s+idx_tx_last_updated\s+ON transactions\(last_updated\)/);
  });

  it('creates idx_outbox_ts on (timestamp) for the outbox drain order', async () => {
    const ddl = await getLastExecAsyncCallDdl();
    expect(ddl).toMatch(/CREATE INDEX IF NOT EXISTS\s+idx_outbox_ts\s+ON sync_outbox\(timestamp\)/);
  });

  it('emits CREATE INDEX statements in the same execAsync block as the table DDL (single round-trip)', async () => {
    const dbHandle = await sqliteMock.openDatabaseAsync.mock.results[0].value;
    const execMock = dbHandle.execAsync as jest.Mock;
    expect(execMock).toHaveBeenCalledTimes(1);
    const ddl = execMock.mock.calls[0][0] as string;
    expect(ddl).toMatch(/CREATE TABLE/);
    expect(ddl).toMatch(/CREATE INDEX/);
  });

  it('uses IF NOT EXISTS for idempotency on app upgrade', async () => {
    const ddl = await getLastExecAsyncCallDdl();
    const createIndexCount = (ddl.match(/CREATE INDEX IF NOT EXISTS/g) || []).length;
    expect(createIndexCount).toBe(3);
  });
});
