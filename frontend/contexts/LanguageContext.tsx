import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { changeLocale, isRTL, isSupported } from '../utils/i18n';

interface LanguageContextType {
  language: string;
  isRTL: boolean;
  // Returns whether the app must restart (RTL direction changed).
  setLanguage: (code: string) => Promise<{ needsRestart: boolean }>;
  t: (key: string, options?: any) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState('en');
  const [, forceUpdate] = useState({});

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const saved = await AsyncStorage.getItem('user_locale');
      if (saved && isSupported(saved)) {
        setLanguageState(saved);
        i18n.locale = saved;
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  const setLanguage = async (code: string): Promise<{ needsRestart: boolean }> => {
    const safeCode = isSupported(code) ? code : 'en';
    const directionChanged = I18nManager.isRTL !== isRTL(safeCode);

    setLanguageState(safeCode);
    await changeLocale(safeCode);

    // Mirror the whole layout for RTL languages. This only takes effect after a
    // reload, so signal the caller to restart the app when the direction flips.
    if (directionChanged) {
      I18nManager.allowRTL(isRTL(safeCode));
      I18nManager.forceRTL(isRTL(safeCode));
    }

    // Re-render the tree so every t() call picks up the new locale immediately.
    forceUpdate({});
    return { needsRestart: directionChanged };
  };

  const t = (key: string, options?: any): string => {
    return i18n.t(key, options);
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        isRTL: isRTL(language),
        setLanguage,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
