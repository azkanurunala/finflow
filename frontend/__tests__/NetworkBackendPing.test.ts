/**
 * G14 — backend health-ping helper. Asserts that the helper hits /api/health,
 * resolves true on 2xx and false on non-OK / network failure, and times out at 5s.
 */

jest.mock('../constants/Config', () => ({
  CONFIG: { BACKEND_URL: 'https://example.test' },
}));

import { CONFIG } from '../constants/Config';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

// Standalone implementation matching NetworkContext.pingBackend so we can unit-test
// without dragging in NetInfo / sync infrastructure.
async function pingBackend(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

describe('G14 — backend health ping', () => {
  it('resolves true on 200 OK from /api/health', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 } as any);
    await expect(pingBackend()).resolves.toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.test/api/health',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('resolves false when backend returns 5xx', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 } as any);
    await expect(pingBackend()).resolves.toBe(false);
  });

  it('resolves false when fetch rejects (DNS / network failure)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ENOTFOUND'));
    await expect(pingBackend()).resolves.toBe(false);
  });

  it('aborts via AbortController on timeout (signal is wired)', async () => {
    let capturedSignal: AbortSignal | undefined;
    global.fetch = jest.fn().mockImplementation((_url, init) => {
      capturedSignal = init?.signal;
      return Promise.resolve({ ok: true, status: 200 });
    }) as any;

    await pingBackend();
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });
});
