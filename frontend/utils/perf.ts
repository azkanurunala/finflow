/**
 * PG1 — performance telemetry. mark() at anchors, measure() between two marks,
 * flushSamples() to read out the ring buffer. Marks live in-memory; completed
 * measurements persist to AsyncStorage (`perf_samples`, ring buffer of 50)
 * for in-app inspection across cold starts.
 *
 * Clock source priority: globalThis.performance.now() (monotonic, Hermes
 * provides it) → Date.now() fallback. Monotonic guard rejects negative deltas
 * (clock jump backwards under Date.now() fallback) and clamps to 0.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type PerfAnchor =
  | 'app.bootStart'
  | 'app.firstRouteMount'
  | 'db.initComplete'
  | 'sync.drainStart'
  | 'sync.drainComplete'
  | 'history.scrollEnd'
  | 'locale.dynamicLoad';

export interface PerfSample {
  name: string;
  from: PerfAnchor;
  to: PerfAnchor;
  durationMs: number;
  recordedAt: number;
}

const STORAGE_KEY = 'perf_samples';
const RING_MAX = 50;

const marks = new Map<PerfAnchor, number>();

function nowMs(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  if (perf && typeof perf.now === 'function') return perf.now();
  return Date.now();
}

export function mark(anchor: PerfAnchor): number {
  const t = nowMs();
  marks.set(anchor, t);
  if (__DEV__) console.info('[perf]', anchor, t.toFixed(2));
  return t;
}

export function getMark(anchor: PerfAnchor): number | undefined {
  return marks.get(anchor);
}

export function measure(from: PerfAnchor, to: PerfAnchor, name?: string): PerfSample | null {
  const a = marks.get(from);
  const b = marks.get(to);
  if (a === undefined || b === undefined) return null;
  const raw = b - a;
  const durationMs = raw < 0 ? 0 : raw;
  const sample: PerfSample = {
    name: name ?? `${from}→${to}`,
    from,
    to,
    durationMs,
    recordedAt: Date.now(),
  };
  void appendSample(sample);
  if (__DEV__) console.info('[perf]', sample.name, durationMs.toFixed(2), 'ms');
  return sample;
}

async function appendSample(sample: PerfSample): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const arr: PerfSample[] = raw ? JSON.parse(raw) : [];
    arr.push(sample);
    while (arr.length > RING_MAX) arr.shift();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // Telemetry must never crash the host.
  }
}

export async function flushSamples(): Promise<PerfSample[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PerfSample[]) : [];
  } catch {
    return [];
  }
}

export async function clearSamples(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function resetMarksForTest(): void {
  marks.clear();
}
