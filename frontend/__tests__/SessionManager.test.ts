/**
 * G1 — SessionManager rotation: single-flight + token persistence + graceful
 * failure paths.
 */

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
      setItem: jest.fn((k: string, v: string) => {
        store.set(k, v);
        return Promise.resolve();
      }),
      removeItem: jest.fn((k: string) => {
        store.delete(k);
        return Promise.resolve();
      }),
      __reset: () => store.clear(),
    },
  };
});

jest.mock('axios', () => {
  const post = jest.fn();
  return { __esModule: true, default: { post }, post };
});

jest.mock('../constants/Config', () => ({
  CONFIG: { BACKEND_URL: 'https://example.test' },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {
  rotateSession,
  setCurrentSessionToken,
  getCurrentSessionToken,
  _resetInFlightRotation,
} from '../services/SessionManager';

const mockedPost = axios.post as unknown as jest.Mock;

describe('G1 — SessionManager.rotateSession', () => {
  beforeEach(async () => {
    (AsyncStorage as any).__reset?.();
    mockedPost.mockReset();
    _resetInFlightRotation();
  });

  it('returns null when no current token is stored', async () => {
    const out = await rotateSession();
    expect(out).toBeNull();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('hits POST /api/auth/refresh-session with the current bearer and stores the new token', async () => {
    await setCurrentSessionToken('old-tok');
    mockedPost.mockResolvedValue({ data: { session_token: 'new-tok', expires_at: 'iso' } });

    const out = await rotateSession();
    expect(out).toBe('new-tok');
    expect(mockedPost).toHaveBeenCalledWith(
      'https://example.test/api/auth/refresh-session',
      {},
      expect.objectContaining({
        headers: { Authorization: 'Bearer old-tok' },
      })
    );
    await expect(getCurrentSessionToken()).resolves.toBe('new-tok');
  });

  it('returns null and leaves storage intact when backend rejects', async () => {
    await setCurrentSessionToken('old-tok');
    mockedPost.mockRejectedValue(Object.assign(new Error('rejected'), { response: { status: 401 } }));

    const out = await rotateSession();
    expect(out).toBeNull();
    await expect(getCurrentSessionToken()).resolves.toBe('old-tok');
  });

  it('single-flights concurrent rotations (one network call, one shared result)', async () => {
    await setCurrentSessionToken('old-tok');
    let resolveCall: (val: any) => void = () => {};
    mockedPost.mockReturnValue(
      new Promise((resolve) => {
        resolveCall = resolve;
      })
    );

    const a = rotateSession();
    const b = rotateSession();
    const c = rotateSession();

    resolveCall({ data: { session_token: 'shared-new-tok' } });
    const [ra, rb, rc] = await Promise.all([a, b, c]);

    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(ra).toBe('shared-new-tok');
    expect(rb).toBe('shared-new-tok');
    expect(rc).toBe('shared-new-tok');
  });

  it('returns null when backend response is shaped wrong (no session_token)', async () => {
    await setCurrentSessionToken('old-tok');
    mockedPost.mockResolvedValue({ data: { somethingElse: true } });

    const out = await rotateSession();
    expect(out).toBeNull();
    await expect(getCurrentSessionToken()).resolves.toBe('old-tok');
  });
});
