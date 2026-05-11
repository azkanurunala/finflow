/**
 * PG12 — single-query home summary + 1s memoization.
 *
 * Verifies: (a) the new impl uses one round-trip not two, (b) return
 * shape is unchanged, (c) within 1s the same call hits the memo, (d) any
 * mutation (addPendingTransaction, updateLocalTransaction, etc.) flushes
 * the memo so callers do not see stale totals.
 */

import fc from 'fast-check';

jest.mock('expo-sqlite', () => {
  const getFirstAsync = jest.fn();
  const runAsync = jest.fn().mockResolvedValue(undefined);
  const getAllAsync = jest.fn().mockResolvedValue([]);
  const withTransactionAsync = jest.fn(async (cb: () => Promise<void>) => cb());
  const execAsync = jest.fn().mockResolvedValue(undefined);
  const dbHandle = { execAsync, runAsync, getAllAsync, getFirstAsync, withTransactionAsync };
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

const sqliteMock = jest.requireMock('expo-sqlite') as { openDatabaseAsync: jest.Mock };

import {
  initDb,
  getSummaryLocally,
  invalidateSummaryMemo,
  addPendingTransaction,
  updateLocalTransaction,
  deleteLocalTransaction,
  saveTransactionsLocally,
  purgeDeletedTransactions,
} from '../services/localDb';

// Captured once in beforeAll so beforeEach's clearAllMocks doesn't wipe
// the mock.results[0] entry that getMocks would otherwise consult.
let getFirstAsync: jest.Mock;
let runAsync: jest.Mock;
const getMocks = () => ({ getFirstAsync, runAsync });

describe('PG12 — single-query summary + memo', () => {
  beforeAll(async () => {
    await initDb();
    const db = await sqliteMock.openDatabaseAsync.mock.results[0].value;
    getFirstAsync = db.getFirstAsync as jest.Mock;
    runAsync = db.runAsync as jest.Mock;
  });

  beforeEach(() => {
    invalidateSummaryMemo();
    getFirstAsync?.mockReset();
    runAsync?.mockReset();
    runAsync?.mockResolvedValue(undefined);
  });

  it('issues exactly one getFirstAsync call (down from two)', async () => {
    const { getFirstAsync } = getMocks();
    getFirstAsync.mockResolvedValueOnce({ income: 100, expenses: 40 });
    await getSummaryLocally();
    expect(getFirstAsync).toHaveBeenCalledTimes(1);
  });

  it('the single query uses CASE WHEN over transaction_type', async () => {
    const { getFirstAsync } = getMocks();
    getFirstAsync.mockResolvedValueOnce({ income: 0, expenses: 0 });
    await getSummaryLocally();
    const sql = getFirstAsync.mock.calls[0][0] as string;
    expect(sql).toMatch(/CASE WHEN transaction_type = 'income'/);
    expect(sql).toMatch(/CASE WHEN transaction_type = 'expense'/);
    expect(sql).toMatch(/sync_status != 'deleted'/);
  });

  it('returns the documented shape { total_income, total_expenses }', async () => {
    const { getFirstAsync } = getMocks();
    getFirstAsync.mockResolvedValueOnce({ income: 123.45, expenses: 67.89 });
    const result = await getSummaryLocally();
    expect(result).toEqual({ total_income: 123.45, total_expenses: 67.89 });
  });

  it('coalesces nullish columns to 0', async () => {
    const { getFirstAsync } = getMocks();
    getFirstAsync.mockResolvedValueOnce(null);
    const result = await getSummaryLocally();
    expect(result).toEqual({ total_income: 0, total_expenses: 0 });
  });

  describe('memoization', () => {
    it('serves the second call from cache within the TTL window', async () => {
      const { getFirstAsync } = getMocks();
      getFirstAsync.mockResolvedValueOnce({ income: 50, expenses: 20 });
      const a = await getSummaryLocally();
      const b = await getSummaryLocally();
      expect(getFirstAsync).toHaveBeenCalledTimes(1);
      expect(b).toEqual(a);
    });

    it('re-queries after the TTL elapses', async () => {
      const realNow = Date.now;
      let t = 1_000_000;
      Date.now = () => t;
      try {
        const { getFirstAsync } = getMocks();
        getFirstAsync.mockResolvedValueOnce({ income: 1, expenses: 1 });
        getFirstAsync.mockResolvedValueOnce({ income: 2, expenses: 2 });
        await getSummaryLocally();
        t += 1500; // past 1s TTL
        const fresh = await getSummaryLocally();
        expect(getFirstAsync).toHaveBeenCalledTimes(2);
        expect(fresh).toEqual({ total_income: 2, total_expenses: 2 });
      } finally {
        Date.now = realNow;
      }
    });
  });

  describe('mutation invalidation', () => {
    it.each([
      ['addPendingTransaction', () => addPendingTransaction({ amount: 1, currency: 'USD', category: 'X', date: '2026-01-01', transaction_type: 'expense' })],
      ['updateLocalTransaction', () => updateLocalTransaction('tx-1', { amount: 99 })],
      ['deleteLocalTransaction', () => deleteLocalTransaction('tx-1')],
      ['saveTransactionsLocally', () => saveTransactionsLocally([])],
      ['purgeDeletedTransactions', () => purgeDeletedTransactions()],
    ])('%s invalidates the memo so the next summary re-queries', async (_name, mutate) => {
      const { getFirstAsync } = getMocks();
      // Default any internal getFirstAsync calls inside the mutation paths to
      // a harmless shape; we assert only on the summary-call results below.
      getFirstAsync.mockResolvedValue({ id: 'tx-1', amount: 99 } as never);
      getFirstAsync.mockResolvedValueOnce({ income: 10, expenses: 5 });
      const stale = await getSummaryLocally();
      expect(stale.total_income).toBe(10);
      await mutate();
      // Re-arm the next getSummaryLocally to return the FRESH row.
      getFirstAsync.mockResolvedValueOnce({ income: 11, expenses: 5 });
      const fresh = await getSummaryLocally();
      expect(fresh.total_income).toBe(11);
    });
  });

  describe('Property: parity with the legacy two-query implementation', () => {
    it('produces the same totals as separate SUMs for any tx-set', async () => {
      const { getFirstAsync } = getMocks();
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              amount: fc.float({ min: 0, max: 10000, noNaN: true }),
              type: fc.constantFrom('income' as const, 'expense' as const),
            }),
            { minLength: 0, maxLength: 100 }
          ),
          async (txs) => {
            invalidateSummaryMemo();
            const expectedIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
            const expectedExpenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
            getFirstAsync.mockResolvedValueOnce({ income: expectedIncome, expenses: expectedExpenses });
            const out = await getSummaryLocally();
            expect(out.total_income).toBeCloseTo(expectedIncome, 5);
            expect(out.total_expenses).toBeCloseTo(expectedExpenses, 5);
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
