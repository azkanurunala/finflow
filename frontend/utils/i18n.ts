import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '../locales/en';
import id from '../locales/id';
import ar from '../locales/ar';
import es from '../locales/es';
import pt from '../locales/pt';
import fr from '../locales/fr';
import de from '../locales/de';
import it from '../locales/it';
import nl from '../locales/nl';
import ru from '../locales/ru';
import tr from '../locales/tr';
import zh from '../locales/zh';
import ja from '../locales/ja';
import ko from '../locales/ko';
import hi from '../locales/hi';
import th from '../locales/th';
import vi from '../locales/vi';
import ms from '../locales/ms';
import pl from '../locales/pl';

// Canonical list of supported languages (the App Store's most popular).
// `name` = autonym shown prominently; `english` = English name shown beneath.
// To add a language: ship its locale file, import it above, register it in the
// I18n constructor, and add an entry here.
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English (US)', english: 'English', flag: '🇺🇸' },
  { code: 'id', name: 'Bahasa Indonesia', english: 'Indonesian', flag: '🇮🇩' },
  { code: 'ar', name: 'العربية', english: 'Arabic', flag: '🇸🇦' },
  { code: 'zh', name: '中文', english: 'Chinese (Simplified)', flag: '🇨🇳' },
  { code: 'es', name: 'Español', english: 'Spanish', flag: '🇪🇸' },
  { code: 'hi', name: 'हिन्दी', english: 'Hindi', flag: '🇮🇳' },
  { code: 'pt', name: 'Português', english: 'Portuguese', flag: '🇧🇷' },
  { code: 'fr', name: 'Français', english: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', english: 'German', flag: '🇩🇪' },
  { code: 'ja', name: '日本語', english: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', english: 'Korean', flag: '🇰🇷' },
  { code: 'it', name: 'Italiano', english: 'Italian', flag: '🇮🇹' },
  { code: 'ru', name: 'Русский', english: 'Russian', flag: '🇷🇺' },
  { code: 'tr', name: 'Türkçe', english: 'Turkish', flag: '🇹🇷' },
  { code: 'vi', name: 'Tiếng Việt', english: 'Vietnamese', flag: '🇻🇳' },
  { code: 'th', name: 'ไทย', english: 'Thai', flag: '🇹🇭' },
  { code: 'nl', name: 'Nederlands', english: 'Dutch', flag: '🇳🇱' },
  { code: 'ms', name: 'Bahasa Melayu', english: 'Malay', flag: '🇲🇾' },
  { code: 'pl', name: 'Polski', english: 'Polish', flag: '🇵🇱' },
] as const;

export const SUPPORTED_LOCALES = SUPPORTED_LANGUAGES.map((l) => l.code);
export type SupportedLocale = (typeof SUPPORTED_LANGUAGES)[number]['code'];

// Right-to-left languages (mirror the layout). Arabic is the only RTL here.
const RTL_LOCALES = ['ar'];
export const isRTL = (locale: string) => RTL_LOCALES.includes(locale);
export const isSupported = (locale: string): locale is SupportedLocale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(locale);

const i18n = new I18n({
  en, id, ar, es, pt, fr, de, it, nl, ru, tr, zh, ja, ko, hi, th, vi, ms, pl,
});

i18n.enableFallback = true;
i18n.defaultLocale = 'en';

// Allow RTL layouts app-wide; the actual direction is forced per selected locale.
I18nManager.allowRTL(true);

// Pick a sensible initial locale: device language if supported, else English.
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
