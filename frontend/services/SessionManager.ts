/**
 * G1 — Session token rotation.
 *
 * Single-flight rotation: if multiple in-flight requests fail with 401 at the
 * same moment, only one POST /api/auth/refresh-session goes out and they all
 * await its result. After the rotation request settles, the in-flight promise
 * is reset so the next 401 round can retry.
 *
 * Storage:
 *   - Token: AsyncStorage["session_token"] (matches existing api/client.ts).
 *   - The interceptor in api/client.ts reads it on every request.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { CONFIG } from '../constants/Config';

const SESSION_TOKEN_KEY = 'session_token';

let inFlightRotation: Promise<string | null> | null = null;

export async function getCurrentSessionToken(): Promise<string | null> {
  return AsyncStorage.getItem(SESSION_TOKEN_KEY);
}

export async function setCurrentSessionToken(token: string | null): Promise<void> {
  if (token === null) {
    await AsyncStorage.removeItem(SESSION_TOKEN_KEY);
  } else {
    await AsyncStorage.setItem(SESSION_TOKEN_KEY, token);
  }
}

/**
 * Attempts a session rotation. Returns the new token on success or `null` if
 * the caller should fall through to the existing /login redirect (e.g. token
 * past the server's grace window, network error).
 */
export async function rotateSession(): Promise<string | null> {
  if (inFlightRotation) return inFlightRotation;

  inFlightRotation = (async () => {
    try {
      const old = await getCurrentSessionToken();
      if (!old) return null;
      const res = await axios.post(
        `${CONFIG.BACKEND_URL}/api/auth/refresh-session`,
        {},
        { headers: { Authorization: `Bearer ${old}` }, timeout: 10000 }
      );
      const newToken: string | undefined = res.data?.session_token;
      if (!newToken) return null;
      await setCurrentSessionToken(newToken);
      return newToken;
    } catch {
      return null;
    } finally {
      inFlightRotation = null;
    }
  })();

  return inFlightRotation;
}

/** Test-only helper: clears the single-flight cache. */
export function _resetInFlightRotation(): void {
  inFlightRotation = null;
}
