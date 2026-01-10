import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  POPULAR_CURRENCIES,
  OTHER_CURRENCIES,
  Currency,
  fetchExchangeRates,
  formatCurrency as formatCurrencyUtil,
} from '../utils/currency';

interface CurrencyContextType {
  currency: string;
  currencySymbol: string;
  setCurrency: (code: string) => Promise<void>;
  formatAmount: (amount: number, fromCurrency?: string) => string;
  convertAmount: (amount: number, fromCurrency: string) => Promise<number>;
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState('USD');
  const [rates, setRates] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrency();
  }, []);

  const loadCurrency = async () => {
    try {
      const saved = await AsyncStorage.getItem('user_currency');
      if (saved) {
        setCurrencyState(saved);
      }
      
      // Fetch exchange rates
      const exchangeRates = await fetchExchangeRates('USD');
      setRates(exchangeRates);
    } catch (error) {
      console.error('Error loading currency:', error);
    } finally {
      setLoading(false);
    }
  };

  const setCurrency = async (code: string) => {
    setCurrencyState(code);
    await AsyncStorage.setItem('user_currency', code);
  };

  const getCurrencyData = (code: string): Currency | undefined => {
    return [...POPULAR_CURRENCIES, ...OTHER_CURRENCIES].find(c => c.code === code);
  };

  const currencySymbol = getCurrencyData(currency)?.symbol || '$';

  const convertAmount = async (amount: number, fromCurrency: string): Promise<number> => {
    if (fromCurrency === currency) return amount;
    
    // Convert from source to USD first
    const toUsd = fromCurrency === 'USD' ? amount : amount / (rates[fromCurrency] || 1);
    
    // Then convert from USD to target currency
    const toTarget = currency === 'USD' ? toUsd : toUsd * (rates[currency] || 1);
    
    return toTarget;
  };

  const formatAmount = (amount: number, fromCurrency: string = 'USD'): string => {
    // Simple synchronous conversion using cached rates
    let convertedAmount = amount;
    
    if (fromCurrency !== currency && Object.keys(rates).length > 0) {
      const toUsd = fromCurrency === 'USD' ? amount : amount / (rates[fromCurrency] || 1);
      convertedAmount = currency === 'USD' ? toUsd : toUsd * (rates[currency] || 1);
    }
    
    return formatCurrencyUtil(convertedAmount, currency);
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencySymbol,
        setCurrency,
        formatAmount,
        convertAmount,
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
