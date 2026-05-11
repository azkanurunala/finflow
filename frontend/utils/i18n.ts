/**
 * PG10 — lazy locale loading. Only `en` is statically imported at boot;
 * the other 17 locales load on demand via dynamic import the first time
 * they are activated. Using a static switch over `import(...)` calls
 * (not a template-interpolated path) keeps Metro's bundler happy on
 * Hermes — the risk flagged in Iter 5 Slice 4.
 *
 * Public API (initI18n, changeLocale, t, default i18n) is unchanged.
 */

import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import en from '../locales/en';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mark, measure } from './perf';

type LocaleCode =
  | 'en' | 'id' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'zh' | 'ja' | 'ko'
  | 'ar' | 'hi' | 'th' | 'vi' | 'ms' | 'ru' | 'tr' | 'nl';

const SUPPORTED: ReadonlySet<LocaleCode> = new Set([
  'en', 'id', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko',
  'ar', 'hi', 'th', 'vi', 'ms', 'ru', 'tr', 'nl',
]);

const i18n = new I18n({ en });

// Each locale-loader returns the dictionary's default export. Static
// import() expressions (one per case) are what Metro can statically
// analyze and emit as separate chunks; a template-interpolated path
// would silently fall through to a runtime require that may fail.
//
// Indirection via `localeLoader` lets tests inject a sync stub since
// Jest's runtime cannot execute real `import()` calls (would need
// --experimental-vm-modules). Production always uses the dynamic path.
type LocaleLoader = (code: LocaleCode) => Promise<Record<string, unknown> | null>;

const defaultLoader: LocaleLoader = async (code) => {
  switch (code) {
    case 'en': return en;
    case 'id': return (await import('../locales/id')).default;
    case 'es': return (await import('../locales/es')).default;
    case 'fr': return (await import('../locales/fr')).default;
    case 'de': return (await import('../locales/de')).default;
    case 'it': return (await import('../locales/it')).default;
    case 'pt': return (await import('../locales/pt')).default;
    case 'zh': return (await import('../locales/zh')).default;
    case 'ja': return (await import('../locales/ja')).default;
    case 'ko': return (await import('../locales/ko')).default;
    case 'ar': return (await import('../locales/ar')).default;
    case 'hi': return (await import('../locales/hi')).default;
    case 'th': return (await import('../locales/th')).default;
    case 'vi': return (await import('../locales/vi')).default;
    case 'ms': return (await import('../locales/ms')).default;
    case 'ru': return (await import('../locales/ru')).default;
    case 'tr': return (await import('../locales/tr')).default;
    case 'nl': return (await import('../locales/nl')).default;
    default: return null;
  }
};

let localeLoader: LocaleLoader = defaultLoader;

async function loadLocaleModule(code: LocaleCode): Promise<Record<string, unknown> | null> {
  return localeLoader(code);
}

// In-flight load dedup so two near-simultaneous setLocale calls for the
// same code don't kick off two imports.
const inflight = new Map<LocaleCode, Promise<void>>();

async function ensureLocaleLoaded(code: string): Promise<void> {
  if (!SUPPORTED.has(code as LocaleCode)) return;
  if (i18n.translations[code]) return; // already in the catalog
  const typed = code as LocaleCode;
  const existing = inflight.get(typed);
  if (existing) return existing;

  const task = (async () => {
    const dict = await loadLocaleModule(typed);
    if (dict) {
      i18n.translations[code] = dict;
      mark('locale.dynamicLoad');
      measure('app.firstRouteMount', 'locale.dynamicLoad', `locale.${code}.load`);
    }
  })().finally(() => {
    inflight.delete(typed);
  });

  inflight.set(typed, task);
  return task;
}

// Initial locale safely (sync — `en` is already loaded, others fall back
// to `en` until they finish hydrating).
const detected = getLocales()?.[0]?.languageCode || 'en';
i18n.locale = SUPPORTED.has(detected as LocaleCode) ? detected : 'en';
i18n.enableFallback = true;
i18n.defaultLocale = 'en';
// Fire-and-forget hydrate of the detected locale; UI renders against `en`
// fallback until this resolves (typically <50ms on emulator).
if (i18n.locale !== 'en') {
  void ensureLocaleLoaded(i18n.locale);
}

export const initI18n = async () => {
  try {
    const savedLocale = await AsyncStorage.getItem('user_locale');
    if (savedLocale) {
      await ensureLocaleLoaded(savedLocale);
      i18n.locale = savedLocale;
    }
  } catch (error) {
    console.error('Error loading locale:', error);
  }
};

export const changeLocale = async (locale: string) => {
  await ensureLocaleLoaded(locale);
  i18n.locale = locale;
  await AsyncStorage.setItem('user_locale', locale);
};

export const t = (key: string, options?: any) => i18n.t(key, options);

// Exposed for tests; not part of the documented public API.
export const __testing = {
  ensureLocaleLoaded,
  isLoaded: (code: string) => Boolean(i18n.translations[code]),
  setLoader: (loader: LocaleLoader | null) => {
    localeLoader = loader ?? defaultLoader;
  },
  reset: () => {
    for (const k of Object.keys(i18n.translations)) {
      if (k !== 'en') delete i18n.translations[k];
    }
    inflight.clear();
    localeLoader = defaultLoader;
  },
};

export default i18n;
