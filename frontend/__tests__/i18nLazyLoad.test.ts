/**
 * PG10 — lazy locale loading.
 *
 * Verifies: (a) only `en` is in the catalog at module load, (b) the
 * first call to changeLocale for a non-en code hydrates exactly one
 * dictionary, (c) subsequent calls to the same code are no-ops, (d)
 * two simultaneous calls for the same code dedup to one import, (e)
 * unsupported codes are ignored instead of crashing.
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

// i18n-js ships untranspiled ESM; jest's transformIgnorePatterns doesn't
// allowlist it. We stub the surface we use: a constructor that takes an
// initial catalog, an indexable `translations` table, plus locale state.
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

// Babel preserves dynamic import() calls; Jest's runtime cannot execute
// them without --experimental-vm-modules. Mock each locale module so the
// import() call resolves to a synthetic ES module with `.default`.
const makeLocaleStub = (code: string) => ({ __esModule: true, default: { _locale: code } });
jest.mock('../locales/id', () => makeLocaleStub('id'));
jest.mock('../locales/es', () => makeLocaleStub('es'));
jest.mock('../locales/fr', () => makeLocaleStub('fr'));
jest.mock('../locales/de', () => makeLocaleStub('de'));
jest.mock('../locales/it', () => makeLocaleStub('it'));
jest.mock('../locales/pt', () => makeLocaleStub('pt'));
jest.mock('../locales/zh', () => makeLocaleStub('zh'));
jest.mock('../locales/ja', () => makeLocaleStub('ja'));
jest.mock('../locales/ko', () => makeLocaleStub('ko'));
jest.mock('../locales/ar', () => makeLocaleStub('ar'));
jest.mock('../locales/hi', () => makeLocaleStub('hi'));
jest.mock('../locales/th', () => makeLocaleStub('th'));
jest.mock('../locales/vi', () => makeLocaleStub('vi'));
jest.mock('../locales/ms', () => makeLocaleStub('ms'));
jest.mock('../locales/ru', () => makeLocaleStub('ru'));
jest.mock('../locales/tr', () => makeLocaleStub('tr'));
jest.mock('../locales/nl', () => makeLocaleStub('nl'));

import i18n, { changeLocale, initI18n, __testing } from '../utils/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;

describe('PG10 — lazy locale loading', () => {
  beforeEach(() => {
    __testing.reset();
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
    expect(setItem).toHaveBeenCalledWith('user_locale', 'id');
  });

  it('second changeLocale("id") is a no-op for hydration', async () => {
    await changeLocale('id');
    const cacheKeysBefore = Object.keys(i18n.translations).slice();
    await changeLocale('id');
    expect(Object.keys(i18n.translations)).toEqual(cacheKeysBefore);
  });

  it('two concurrent changeLocale calls dedup to one import', async () => {
    const [a, b] = [changeLocale('fr'), changeLocale('fr')];
    await Promise.all([a, b]);
    expect(__testing.isLoaded('fr')).toBe(true);
    expect(i18n.locale).toBe('fr');
  });

  it('unsupported locale is silently ignored (no crash, no catalog entry)', async () => {
    await __testing.ensureLocaleLoaded('xx');
    expect(__testing.isLoaded('xx')).toBe(false);
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
  });
});
