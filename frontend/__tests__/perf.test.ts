/**
 * PG1 — perf telemetry unit tests.
 *
 * Covers: monotonic clock fallback, mark/measure pairing, missing-mark guard,
 * negative-delta clamp, ring-buffer eviction at RING_MAX=50, AsyncStorage
 * persistence, and the "telemetry never throws" invariant.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  mark,
  measure,
  flushSamples,
  clearSamples,
  getMark,
  resetMarksForTest,
  PerfSample,
} from '../utils/perf';

const setItem = AsyncStorage.setItem as jest.Mock;
const getItem = AsyncStorage.getItem as jest.Mock;
const removeItem = AsyncStorage.removeItem as jest.Mock;

describe('perf telemetry (PG1)', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    resetMarksForTest();
    store = {};
    setItem.mockImplementation(async (k: string, v: string) => {
      store[k] = v;
    });
    getItem.mockImplementation(async (k: string) => store[k] ?? null);
    removeItem.mockImplementation(async (k: string) => {
      delete store[k];
    });
    // Force the Date.now() fallback path by hiding performance.now()
    delete (globalThis as { performance?: unknown }).performance;
  });

  describe('mark()', () => {
    it('records a timestamp for the named anchor', () => {
      const t = mark('app.bootStart');
      expect(typeof t).toBe('number');
      expect(getMark('app.bootStart')).toBe(t);
    });

    it('overwrites a prior mark with the same name', () => {
      mark('app.bootStart');
      const second = mark('app.bootStart');
      expect(getMark('app.bootStart')).toBe(second);
    });
  });

  describe('measure()', () => {
    it('returns null when the from-mark is missing', () => {
      mark('app.firstRouteMount');
      expect(measure('app.bootStart', 'app.firstRouteMount')).toBeNull();
    });

    it('returns null when the to-mark is missing', () => {
      mark('app.bootStart');
      expect(measure('app.bootStart', 'app.firstRouteMount')).toBeNull();
    });

    it('computes a non-negative duration', () => {
      mark('app.bootStart');
      // Force a measurable gap
      const target = Date.now() + 5;
      while (Date.now() < target) { /* spin */ }
      mark('app.firstRouteMount');
      const s = measure('app.bootStart', 'app.firstRouteMount');
      expect(s).not.toBeNull();
      expect(s!.durationMs).toBeGreaterThanOrEqual(0);
      expect(s!.from).toBe('app.bootStart');
      expect(s!.to).toBe('app.firstRouteMount');
    });

    it('clamps negative deltas to 0 (clock-jump guard)', () => {
      // Manually seed marks out of order via mark(), then verify the sample is clamped.
      mark('app.firstRouteMount'); // earlier wall clock
      const target = Date.now() + 2;
      while (Date.now() < target) { /* spin */ }
      mark('app.bootStart'); // later wall clock — reversed pair
      const s = measure('app.bootStart', 'app.firstRouteMount');
      expect(s).not.toBeNull();
      expect(s!.durationMs).toBe(0);
    });

    it('uses the explicit name when provided', () => {
      mark('app.bootStart');
      mark('app.firstRouteMount');
      const s = measure('app.bootStart', 'app.firstRouteMount', 'boot.tti');
      expect(s!.name).toBe('boot.tti');
    });
  });

  describe('ring buffer persistence', () => {
    it('appends successful measurements to AsyncStorage', async () => {
      mark('app.bootStart');
      mark('app.firstRouteMount');
      measure('app.bootStart', 'app.firstRouteMount', 'boot.tti');
      // Allow the fire-and-forget appendSample to flush.
      await new Promise<void>(r => setImmediate(r));
      const samples = await flushSamples();
      expect(samples.length).toBe(1);
      expect(samples[0].name).toBe('boot.tti');
    });

    it('evicts oldest sample once length exceeds 50', async () => {
      // Seed a 50-entry buffer directly.
      const seeded: PerfSample[] = Array.from({ length: 50 }, (_, i) => ({
        name: `seed-${i}`,
        from: 'app.bootStart',
        to: 'app.firstRouteMount',
        durationMs: i,
        recordedAt: i,
      }));
      store['perf_samples'] = JSON.stringify(seeded);

      mark('app.bootStart');
      mark('app.firstRouteMount');
      measure('app.bootStart', 'app.firstRouteMount', 'fresh');
      await new Promise<void>(r => setImmediate(r));

      const samples = await flushSamples();
      expect(samples.length).toBe(50);
      expect(samples[0].name).toBe('seed-1'); // oldest evicted
      expect(samples[49].name).toBe('fresh');
    });

    it('returns [] when storage is empty', async () => {
      const samples = await flushSamples();
      expect(samples).toEqual([]);
    });

    it('clearSamples removes the buffer key', async () => {
      mark('app.bootStart');
      mark('app.firstRouteMount');
      measure('app.bootStart', 'app.firstRouteMount');
      await new Promise<void>(r => setImmediate(r));
      await clearSamples();
      const samples = await flushSamples();
      expect(samples).toEqual([]);
    });
  });

  describe('crash safety', () => {
    it('flushSamples returns [] when AsyncStorage rejects', async () => {
      getItem.mockRejectedValueOnce(new Error('disk full'));
      const samples = await flushSamples();
      expect(samples).toEqual([]);
    });

    it('measure() still returns a sample even when persistence fails', async () => {
      setItem.mockRejectedValueOnce(new Error('disk full'));
      mark('app.bootStart');
      mark('app.firstRouteMount');
      const s = measure('app.bootStart', 'app.firstRouteMount');
      expect(s).not.toBeNull();
      expect(s!.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('clock-source selection', () => {
    it('uses performance.now() when available', () => {
      const fakeNow = jest.fn().mockReturnValue(12345.678);
      (globalThis as { performance?: { now: () => number } }).performance = { now: fakeNow };
      const t = mark('app.bootStart');
      expect(t).toBe(12345.678);
      expect(fakeNow).toHaveBeenCalled();
    });
  });
});
