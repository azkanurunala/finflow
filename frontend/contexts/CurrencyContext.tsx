import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CURRENCY_SYMBOLS,
  getCurrencySymbol,
  formatInCurrency,
  fetchExchangeRates,
  loadPersistedRates,
  convertWithRates,
  FALLBACK_RATES,
} from '../utils/currency';

// 'off'  → show every amount with the selected currency's symbol, no conversion.
// 'live' → convert each amount from its own currency into the selected currency
//          using live exchange rates before displaying.
export type ConversionMode = 'off' | 'live';

interface CurrencyContextType {
  currency: string;
  currencySymbol: string;
  setCurrency: (code: string) => Promise<void>;
  conversionMode: ConversionMode;
  setConversionMode: (mode: ConversionMode) => Promise<void>;
  formatAmount: (amount: number, sourceCurrency?: string) => string;
  /** Convert a raw amount into the selected currency (live mode) or return it unchanged (off). */
  convert: (amount: number, sourceCurrency?: string) => number;
  loading: boolean;
}

const CONVERSION_MODE_KEY = 'currency_conversion_mode';

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState('USD');
  const [conversionMode, setConversionModeState] = useState<ConversionMode>('off');
  const [rates, setRates] = useState<{ [key: string]: number }>(FALLBACK_RATES);
  const [loading, setLoading] = useState(true);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    loadPreferences();
    // 1) Show the last known real rates instantly (offline-friendly)...
    loadPersistedRates().then((cached) => {
      if (cached) {
        setRates(cached);
        forceUpdate({});
      }
    });
    // 2) ...then always refresh from the live API on startup so values are current.
    fetchExchangeRates('USD')
      .then((r) => {
        setRates(r);
        forceUpdate({});
      })
      .catch(() => {});
  }, []);

  // Re-refresh when the user turns live conversion on (cache may be >1h old).
  useEffect(() => {
    if (conversionMode === 'live') {
      fetchExchangeRates('USD')
        .then((r) => {
          setRates(r);
          forceUpdate({});
        })
        .catch(() => {});
    }
  }, [conversionMode]);

  const loadPreferences = async () => {
    try {
      const [savedCurrency, savedMode] = await Promise.all([
        AsyncStorage.getItem('user_currency'),
        AsyncStorage.getItem(CONVERSION_MODE_KEY),
      ]);
      if (savedCurrency) setCurrencyState(savedCurrency);
      if (savedMode === 'live' || savedMode === 'off') setConversionModeState(savedMode);
    } catch (error) {
      console.error('Error loading currency preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const setCurrency = async (code: string) => {
    setCurrencyState(code);
    await AsyncStorage.setItem('user_currency', code);
    // Force re-render so every currency display updates immediately.
    forceUpdate({});
  };

  const setConversionMode = async (mode: ConversionMode) => {
    setConversionModeState(mode);
    await AsyncStorage.setItem(CONVERSION_MODE_KEY, mode);
    forceUpdate({});
  };

  const currencySymbol = getCurrencySymbol(currency);

  /**
   * Format an amount for display. The result ALWAYS uses the user's selected
   * currency symbol/format so the selected currency matches what is shown.
   *
   * @param amount         - the numeric amount
   * @param sourceCurrency - the currency the amount is stored in (optional).
   *   Only used when live conversion is enabled, to convert into the selected
   *   currency. When conversion is off it is ignored (amount shown as-is).
   */
  const convert = (amount: number, sourceCurrency?: string): number => {
    if (
      conversionMode === 'live' &&
      sourceCurrency &&
      sourceCurrency !== currency
    ) {
      return convertWithRates(amount, sourceCurrency, currency, rates);
    }
    return amount;
  };

  const formatAmount = (amount: number, sourceCurrency?: string): string =>
    formatInCurrency(convert(amount, sourceCurrency), currency);

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencySymbol,
        setCurrency,
        conversionMode,
        setConversionMode,
        formatAmount,
        convert,
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

export { CURRENCY_SYMBOLS };
