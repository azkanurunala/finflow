import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from './LanguageContext';

interface CurrencyContextType {
  currency: string;
  currencySymbol: string;
  setCurrency: (code: string) => Promise<void>;
  formatAmount: (amount: number, sourceCurrency?: string) => string;
  formatInputValue: (value: string) => string;
  parseInputValue: (formattedValue: string) => number;
  getThousandSeparator: () => string;
  getDecimalSeparator: () => string;
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState('IDR');
  const [loading, setLoading] = useState(true);
  const [, forceUpdate] = useState({});
  const { language: locale } = useLanguage();

  useEffect(() => {
    loadCurrency();
  }, []);

  const loadCurrency = async () => {
    try {
      const saved = await AsyncStorage.getItem('user_currency');
      if (saved) {
        setCurrencyState(saved);
      }
    } catch (error) {
      console.error('Error loading currency:', error);
    } finally {
      setLoading(false);
    }
  };

  const setCurrency = async (code: string) => {
    setCurrencyState(code);
    await AsyncStorage.setItem('user_currency', code);
    forceUpdate({});
  };

  // Map 2-letter language codes to full locales for better Intl support
  const getFullLocale = (lang: string) => {
    const map: Record<string, string> = {
      en: 'en-US',
      id: 'id-ID',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
      it: 'it-IT',
      ja: 'ja-JP',
      ko: 'ko-KR',
      zh: 'zh-CN',
      ru: 'ru-RU'
    };
    return map[lang] || lang;
  };

  const fullLocale = getFullLocale(locale);

  // Get symbol using Intl
  const getSymbol = (curr: string) => {
    try {
      const formatter = new Intl.NumberFormat(fullLocale, {
        style: 'currency',
        currency: curr,
        currencyDisplay: 'narrowSymbol'
      });
      const parts = formatter.formatToParts(0);
      const symbolPart = parts.find(part => part.type === 'currency');
      return symbolPart ? symbolPart.value : curr;
    } catch (e) {
      console.warn('[CurrencyContext] Failed to get symbol for', curr, e);
      return curr;
    }
  };

  const currencySymbol = getSymbol(currency);

  // Helper to get separators based on locale
  const getSeparators = () => {
    try {
      const numberFormat = new Intl.NumberFormat(fullLocale);
      const parts = numberFormat.formatToParts(1000.1);
      const thousand = parts.find(part => part.type === 'group')?.value || ',';
      const decimal = parts.find(part => part.type === 'decimal')?.value || '.';
      return { thousand, decimal };
    } catch (e) {
      return { thousand: ',', decimal: '.' };
    }
  };

  const getThousandSeparator = () => getSeparators().thousand;
  const getDecimalSeparator = () => getSeparators().decimal;

  /**
   * Format amount for DISPLAY
   * Uses Intl for robust international support
   */
  const formatAmount = (amount: number, sourceCurrency?: string): string => {
    const displayCurrency = sourceCurrency || currency;
    try {
        return new Intl.NumberFormat(fullLocale, {
            style: 'currency',
            currency: displayCurrency,
            currencyDisplay: 'narrowSymbol'
        }).format(amount);
    } catch (e) {
        // Fallback for environments with limited Intl support
        const { thousand, decimal } = getSeparators();
        const symbol = getSymbol(displayCurrency);
        const parts = amount.toFixed(2).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousand);
        return `${symbol}${parts.join(decimal)}`;
    }
  };

  /**
   * Format INPUT value
   * Respects locale's thousand/decimal separators
   */
  const formatInputValue = (value: string): string => {
    const { thousand, decimal } = getSeparators();

    // Clean input: keep numbers and current decimal separator
    let cleaned = value.replace(new RegExp(`[^0-9${decimal === '.' ? '\\.' : decimal}]`, 'g'), '');
    
    // Split parts
    let parts = cleaned.split(decimal);
    let integerPart = parts[0] || '';
    const decimalPart = parts.length > 1 ? parts[1] : '';

    // Remove leading zeros
    integerPart = integerPart.replace(/^0+/, '') || '0';

    // Add thousand separators
    // Logic: Insert thousand separator every 3 digits from end
    const rgx = /(\d+)(\d{3})/;
    while (rgx.test(integerPart)) {
      integerPart = integerPart.replace(rgx, '$1' + thousand + '$2');
    }

    if (decimalPart !== '') {
        return `${integerPart}${decimal}${decimalPart.slice(0, 2)}`; // limit to 2 decimals usually
    }

    if (value.endsWith(decimal)) {
        return `${integerPart}${decimal}`;
    }

    return integerPart;
  };

  /**
   * Parse formatted INPUT value back to number
   */
  const parseInputValue = (formattedValue: string): number => {
    if (!formattedValue) return 0;
    const { thousand, decimal } = getSeparators();

    // Remove thousand separators
    let cleaned = formattedValue.split(thousand).join('');
    // Replace decimal with .
    cleaned = cleaned.replace(decimal, '.');

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencySymbol,
        setCurrency,
        formatAmount,
        formatInputValue,
        parseInputValue,
        getThousandSeparator,
        getDecimalSeparator,
        loading,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
