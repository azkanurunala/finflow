import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';
import en from '../locales/en';
import id from '../locales/id';
import ar from '../locales/ar';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Languages that ship with a complete translation dictionary. Anything not
// listed here must NOT be selectable, otherwise it silently falls back to en.
export const SUPPORTED_LOCALES = ['en', 'id', 'ar'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// Right-to-left languages (Arabic). Used to mirror the layout.
const RTL_LOCALES = ['ar'];
export const isRTL = (locale: string) => RTL_LOCALES.includes(locale);
export const isSupported = (locale: string): locale is SupportedLocale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(locale);

const i18n = new I18n({
  en,
  id,
  ar,
});

i18n.enableFallback = true;
i18n.defaultLocale = 'en';

// Allow RTL layouts app-wide; the actual direction is forced per selected locale.
I18nManager.allowRTL(true);

// Pick a sensible initial locale: device language if we support it, else English.
const deviceLocale = getLocales()?.[0]?.languageCode ?? 'en';
i18n.locale = isSupported(deviceLocale) ? deviceLocale : 'en';

export const initI18n = async () => {
  try {
    const savedLocale = await AsyncStorage.getItem('user_locale');
    if (savedLocale && isSupported(savedLocale)) {
      i18n.locale = savedLocale;
    }
  } catch (error) {
    console.error('Error loading locale:', error);
  }
};

export const changeLocale = async (locale: string) => {
  i18n.locale = isSupported(locale) ? locale : 'en';
  await AsyncStorage.setItem('user_locale', i18n.locale);
};

export const t = (key: string, options?: any) => i18n.t(key, options);

// Transaction categories are stored canonically in English (used as keys for
// icons/colors). Map those canonical names to a localized label, falling back
// to the raw value for anything the backend sends that we don't recognize.
const CATEGORY_SLUG: { [key: string]: string } = {
  Groceries: 'groceries',
  'Dining & Coffee': 'dining',
  Transportation: 'transport',
  'Rent & Utilities': 'rentUtilities',
  Subscriptions: 'subscriptions',
  Healthcare: 'healthcare',
  Insurance: 'insurance',
  Entertainment: 'entertainment',
  Shopping: 'shopping',
  Travel: 'travel',
  Income: 'income',
  Freelance: 'freelance',
  Other: 'other',
};

export const translateCategory = (category?: string) => {
  if (!category) return '';
  const slug = CATEGORY_SLUG[category];
  return slug ? i18n.t(`categories.${slug}`) : category;
};

export default i18n;
