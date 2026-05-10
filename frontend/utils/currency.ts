import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

export const POPULAR_CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
];

export const OTHER_CURRENCIES: Currency[] = [
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'BTC', name: 'Bitcoin', symbol: '₿', flag: '₿' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾' },
];

let exchangeRatesCache: { [key: string]: number } | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 3600000; // 1 hour

export const fetchExchangeRates = async (baseCurrency: string = 'USD'): Promise<{ [key: string]: number }> => {
  const now = Date.now();

  // Return cache if still valid
  if (exchangeRatesCache && now - lastFetchTime < CACHE_DURATION) {
    return exchangeRatesCache;
  }

  try {
    // Using exchangerate-api.com (free tier)
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
    const data = await response.json();

    exchangeRatesCache = data.rates;
    lastFetchTime = now;

    return data.rates;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);

    // Return fallback rates if API fails
    return {
      USD: 1,
      EUR: 0.92,
      GBP: 0.79,
      JPY: 149.50,
      IDR: 15650,
      CAD: 1.36,
      AUD: 1.52,
      SGD: 1.34,
      MYR: 4.72,
      BTC: 0.000023,
    };
  }
};

export const convertCurrency = async (
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> => {
  if (fromCurrency === toCurrency) return amount;

  try {
    const rates = await fetchExchangeRates(fromCurrency);
    const rate = rates[toCurrency];

    if (!rate) {
      console.warn(`Exchange rate not found for ${toCurrency}`);
      return amount;
    }

    return amount * rate;
  } catch (error) {
    console.error('Error converting currency:', error);
    return amount;
  }
};

// G3 — output mirrors backend/server.py::format_currency for the canonical
// currencies (USD, EUR, GBP, JPY, SGD, IDR) so server-rendered amounts and
// client-rendered amounts are byte-identical (Issue #13). BTC retained as a
// frontend-only fallback since the backend doesn't format it.
export const formatCurrency = (amount: number, currencyCode: string): string => {
  const currency = [...POPULAR_CURRENCIES, ...OTHER_CURRENCIES].find(
    (c) => c.code === currencyCode
  );

  if (!currency) return `${amount.toFixed(2)}`;

  // Indonesian Rupiah — backend: `Rp 1.234.567` (space, integer only).
  if (currencyCode === 'IDR') {
    const formatted = Math.round(amount)
      .toLocaleString('en-US')
      .replace(/,/g, '.');
    return `Rp ${formatted}`;
  }

  // Euro — backend: `€1.234,56` (German separators).
  if (currencyCode === 'EUR') {
    const formatted = amount
      .toFixed(2)
      .replace('.', 'X')
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
      .replace('X', ',');
    return `€${formatted}`;
  }

  // British Pound — backend: `£1,234.56`.
  if (currencyCode === 'GBP') {
    return `£${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Japanese Yen — backend: `¥1,234` (no decimals, en-US separators).
  if (currencyCode === 'JPY') {
    return `¥${Math.round(amount).toLocaleString('en-US')}`;
  }

  // Singapore Dollar — backend: `S$1,234.56`.
  if (currencyCode === 'SGD') {
    return `S$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Bitcoin — frontend-only, 8 decimals.
  if (currencyCode === 'BTC') {
    return `${currency.symbol}${amount.toFixed(8)}`;
  }

  // Default (USD and other currencies the backend treats as the default branch).
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency.symbol}${formatted}`;
};

export const getUserCurrency = async (): Promise<string> => {
  try {
    const savedCurrency = await AsyncStorage.getItem('user_currency');
    return savedCurrency || 'IDR';
  } catch (error) {
    return 'IDR';
  }
};

export const setUserCurrency = async (currencyCode: string): Promise<void> => {
  await AsyncStorage.setItem('user_currency', currencyCode);
};
