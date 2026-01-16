import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CurrencyContextType {
  currency: string;
  currencySymbol: string;
  setCurrency: (code: string) => Promise<void>;
  formatAmount: (amount: number, sourceCurrency?: string) => string;
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
    // Force re-render to update all currency displays
    forceUpdate({});
  };

  const currencySymbol = CURRENCY_SYMBOLS[currency] || '$';

  /**
   * Format amount with proper thousand separators and decimal places
   * Uses the sourceCurrency if provided, otherwise uses user's selected currency
   * 
   * @param amount - The amount to format
   * @param sourceCurrency - The currency of the amount (optional, will use this for symbol if provided)
   */
  const formatAmount = (amount: number, sourceCurrency?: string): string => {
    // Use sourceCurrency if provided, otherwise use user's selected currency
    const displayCurrency = sourceCurrency || currency;
    const symbol = CURRENCY_SYMBOLS[displayCurrency] || '$';
    
    // Indonesian Rupiah - uses . for thousands and , for decimals (Rp50.000,53)
    if (displayCurrency === 'IDR') {
      // For IDR, typically no decimal places for whole numbers
      const hasDecimals = amount % 1 !== 0;
      const formatted = amount.toLocaleString('id-ID', {
        minimumFractionDigits: hasDecimals ? 2 : 0,
        maximumFractionDigits: 2,
      });
      return `${symbol}${formatted}`;
    }
    
    // Japanese Yen - no decimals
    if (displayCurrency === 'JPY' || displayCurrency === 'KRW') {
      const formatted = Math.round(amount).toLocaleString('ja-JP');
      return `${symbol}${formatted}`;
    }
    
    // USD, EUR, GBP, etc. - uses , for thousands and . for decimals ($1,300.50)
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${symbol}${formatted}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencySymbol,
        setCurrency,
        formatAmount,
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
