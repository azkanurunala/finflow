import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const CURRENCY_SYMBOLS: { [key: string]: string } = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  IDR: 'Rp',
  SGD: 'S$',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
  CNY: '¥',
  HKD: 'HK$',
  KRW: '₩',
  MYR: 'RM',
  THB: '฿',
  PHP: '₱',
  VND: '₫',
};

// Currencies that use . for thousands and , for decimals (Indonesian format)
const INDONESIAN_FORMAT_CURRENCIES = ['IDR', 'VND'];

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [, forceUpdate] = useState({});

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

  const currencySymbol = CURRENCY_SYMBOLS[currency] || '$';

  // Check if currency uses Indonesian format (. for thousands, , for decimals)
  const usesIndonesianFormat = () => INDONESIAN_FORMAT_CURRENCIES.includes(currency);

  // Get thousand separator based on currency
  const getThousandSeparator = () => usesIndonesianFormat() ? '.' : ',';
  
  // Get decimal separator based on currency
  const getDecimalSeparator = () => usesIndonesianFormat() ? ',' : '.';

  /**
   * Format amount for DISPLAY with proper separators
   * IDR: Rp 1.250.000,50 (. thousands, , decimals)
   * USD: $1,250.00 (, thousands, . decimals)
   */
  const formatAmount = (amount: number, sourceCurrency?: string): string => {
    const displayCurrency = sourceCurrency || currency;
    const symbol = CURRENCY_SYMBOLS[displayCurrency] || '$';
    const isIndonesianFormat = INDONESIAN_FORMAT_CURRENCIES.includes(displayCurrency);
    
    // Indonesian format: . for thousands, , for decimals
    if (isIndonesianFormat) {
      const hasDecimals = amount % 1 !== 0;
      const formatted = amount.toLocaleString('id-ID', {
        minimumFractionDigits: hasDecimals ? 2 : 0,
        maximumFractionDigits: 2,
      });
      return `${symbol}${formatted}`;
    }
    
    // Japanese Yen, Korean Won - no decimals
    if (displayCurrency === 'JPY' || displayCurrency === 'KRW') {
      const formatted = Math.round(amount).toLocaleString('ja-JP');
      return `${symbol}${formatted}`;
    }
    
    // Standard format: , for thousands, . for decimals (USD, EUR, GBP, etc.)
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${symbol}${formatted}`;
  };

  /**
   * Format INPUT value with proper thousand separators (for masked input)
   * Takes raw numeric string and returns formatted string
   * IDR: 1250000 → 1.250.000
   * USD: 1250000 → 1,250,000
   */
  const formatInputValue = (value: string): string => {
    // Remove all non-numeric except decimal indicator
    const thousandSep = getThousandSeparator();
    const decimalSep = getDecimalSeparator();
    
    // Clean the input - keep only numbers and the appropriate decimal separator
    let cleaned = value.replace(new RegExp(`[^0-9${decimalSep === '.' ? '\\.' : ','}]`, 'g'), '');
    
    // If using Indonesian format, convert , to temporary marker
    if (usesIndonesianFormat()) {
      // Input might have , as decimal - that's correct for IDR
      cleaned = cleaned.replace(/\./g, ''); // Remove thousand separators if any
    } else {
      // Standard format - remove commas (thousand separators)
      cleaned = cleaned.replace(/,/g, '');
    }
    
    // Split integer and decimal parts
    let parts: string[];
    if (usesIndonesianFormat()) {
      parts = cleaned.split(',');
    } else {
      parts = cleaned.split('.');
    }
    
    let integerPart = parts[0] || '';
    const decimalPart = parts.length > 1 ? parts[1] : '';
    
    // Remove leading zeros (except single 0)
    integerPart = integerPart.replace(/^0+/, '') || '0';
    
    // Add thousand separators to integer part
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
    
    // Combine with decimal part
    if (decimalPart !== '') {
      return `${integerPart}${decimalSep}${decimalPart.slice(0, 2)}`;
    }
    
    // If original had decimal separator at end, keep it
    if (value.endsWith(decimalSep) || (usesIndonesianFormat() && value.endsWith(','))) {
      return `${integerPart}${decimalSep}`;
    }
    
    return integerPart;
  };

  /**
   * Parse formatted INPUT value back to number
   * IDR: 1.250.000,50 → 1250000.50
   * USD: 1,250,000.50 → 1250000.50
   */
  const parseInputValue = (formattedValue: string): number => {
    if (!formattedValue) return 0;
    
    let cleaned = formattedValue;
    
    if (usesIndonesianFormat()) {
      // IDR format: remove . (thousands), replace , with . (decimal)
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Standard format: remove , (thousands)
      cleaned = cleaned.replace(/,/g, '');
    }
    
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
