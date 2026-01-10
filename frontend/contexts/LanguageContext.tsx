import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { changeLocale } from '../utils/i18n';

interface LanguageContextType {
  language: string;
  setLanguage: (code: string) => Promise<void>;
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
      if (saved) {
        setLanguageState(saved);
        i18n.locale = saved;
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  const setLanguage = async (code: string) => {
    setLanguageState(code);
    await changeLocale(code);
    // Force re-render to update translations
    forceUpdate({});
  };

  const t = (key: string, options?: any): string => {
    return i18n.t(key, options);
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
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
