import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import en from '../locales/en';
import id from '../locales/id';
import es from '../locales/es';
import fr from '../locales/fr';
import de from '../locales/de';
import it from '../locales/it';
import pt from '../locales/pt';
import zh from '../locales/zh';
import ja from '../locales/ja';
import ko from '../locales/ko';
import ar from '../locales/ar';
import hi from '../locales/hi';
import th from '../locales/th';
import vi from '../locales/vi';
import ms from '../locales/ms';
import ru from '../locales/ru';
import tr from '../locales/tr';
import nl from '../locales/nl';
import AsyncStorage from '@react-native-async-storage/async-storage';

const i18n = new I18n({
  en,
  id,
  es,
  fr,
  de,
  it,
  pt,
  zh,
  ja,
  ko,
  ar,
  hi,
  th,
  vi,
  ms,
  ru,
  tr,
  nl,
});

// Set initial locale safely
const locales = getLocales();
i18n.locale = locales?.[0]?.languageCode || 'en';
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

export const initI18n = async () => {
  try {
    const savedLocale = await AsyncStorage.getItem('user_locale');
    if (savedLocale) {
      i18n.locale = savedLocale;
    }
  } catch (error) {
    console.error('Error loading locale:', error);
  }
};

export const changeLocale = async (locale: string) => {
  i18n.locale = locale;
  await AsyncStorage.setItem('user_locale', locale);
};

export const t = (key: string, options?: any) => i18n.t(key, options);

export default i18n;
