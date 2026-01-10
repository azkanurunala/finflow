import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import en from '../locales/en';
import id from '../locales/id';
import AsyncStorage from '@react-native-async-storage/async-storage';

const i18n = new I18n({
  en,
  id,
});

// Set initial locale
i18n.locale = Localization.locale;
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
