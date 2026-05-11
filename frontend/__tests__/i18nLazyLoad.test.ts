/**
 * PG10 — lazy locale loading.
 *
 * Verifies: (a) only `en` is in the catalog at module load, (b) the
 * first call to changeLocale for a non-en code hydrates exactly one
 * dictionary, (c) subsequent calls to the same code are no-ops, (d)
 * two simultaneous calls for the same code dedup to one import, (e)
 * unsupported codes are ignored instead of crashing.
 *
 * Production uses dynamic import() for each locale; Jest's runtime
 * cannot execute real import() without --experimental-vm-modules, so
 * we inject a sync stub loader via the __testing hook.
 */

jest.mock('expo-localization', () => ({
  __esModule: true,
  getLocales: jest.fn(() => [{ languageCode: 'en' }]),
}));

jest.mock('../utils/perf', () => ({
  __esModule: true,
  mark: jest.fn(),
  measure: jest.fn(),
}));

jest.mock('i18n-js', () => {
  class I18n {
    translations: Record<string, unknown> = {};
    locale: string = 'en';
    defaultLocale: string = 'en';
    enableFallback: boolean = false;
    constructor(initial?: Record<string, unknown>) {
      if (initial) this.translations = { ...initial };
    }
    t(key: string) { return key; }
  }
  return { __esModule: true, I18n };
});

import i18n, { changeLocale, initI18n, __testing } from '../utils/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;

const stubLoader = jest.fn(async (code: string) => ({ _locale: code }));

describe('PG10 — lazy locale loading', () => {
  beforeEach(() => {
    __testing.reset();
    __testing.setLoader(stubLoader as never);
    stubLoader.mockClear();
    getItem.mockReset();
    setItem.mockReset();
  });

  it('only `en` is in the catalog before any changeLocale call', () => {
    expect(__testing.isLoaded('en')).toBe(true);
    for (const code of ['id', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar', 'hi', 'th', 'vi', 'ms', 'ru', 'tr', 'nl']) {
      expect(__testing.isLoaded(code)).toBe(false);
    }
  });

  it('changeLocale("id") hydrates id and flips the active locale', async () => {
    expect(__testing.isLoaded('id')).toBe(false);
    await changeLocale('id');
    expect(__testing.isLoaded('id')).toBe(true);
    expect(i18n.locale).toBe('id');
    expect(stubLoader).toHaveBeenCalledWith('id');
    expect(setItem).toHaveBeenCalledWith('user_locale', 'id');
  });

  it('second changeLocale("id") is a no-op for hydration', async () => {
    await changeLocale('id');
    stubLoader.mockClear();
    await changeLocale('id');
    expect(stubLoader).not.toHaveBeenCalled();
  });

  it('two concurrent changeLocale calls dedup to one import', async () => {
    const [a, b] = [changeLocale('fr'), changeLocale('fr')];
    await Promise.all([a, b]);
    expect(__testing.isLoaded('fr')).toBe(true);
    expect(i18n.locale).toBe('fr');
    expect(stubLoader).toHaveBeenCalledTimes(1);
  });

  it('unsupported locale is silently ignored (no crash, no catalog entry)', async () => {
    await __testing.ensureLocaleLoaded('xx');
    expect(__testing.isLoaded('xx')).toBe(false);
    expect(stubLoader).not.toHaveBeenCalled();
  });

  it('initI18n hydrates the persisted locale before flipping i18n.locale', async () => {
    getItem.mockResolvedValueOnce('de');
    expect(__testing.isLoaded('de')).toBe(false);
    await initI18n();
    expect(__testing.isLoaded('de')).toBe(true);
    expect(i18n.locale).toBe('de');
  });

  it('initI18n handles AsyncStorage rejection without throwing', async () => {
    getItem.mockRejectedValueOnce(new Error('disk gone'));
    await expect(initI18n()).resolves.toBeUndefined();
  });

  it('every supported non-en code loads on demand', async () => {
    const codes = ['id', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar', 'hi', 'th', 'vi', 'ms', 'ru', 'tr', 'nl'];
    for (const code of codes) {
      await __testing.ensureLocaleLoaded(code);
      expect(__testing.isLoaded(code)).toBe(true);
    }
    expect(stubLoader).toHaveBeenCalledTimes(codes.length);
  });
});
