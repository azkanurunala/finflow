import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

/**
 * Single source of truth for every currency the app knows about.
 * All symbol lookups, pickers, and formatting derive from this list so the
 * selected currency always matches what is displayed everywhere.
 */
export const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', flag: '🇭🇰' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', flag: '🇰🇷' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', flag: '🇹🇭' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', flag: '🇵🇭' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', flag: '🇻🇳' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'BTC', name: 'Bitcoin', symbol: '₿', flag: '₿' },
];

/** Code → symbol map, derived from CURRENCIES (used by the formatter). */
export const CURRENCY_SYMBOLS: { [code: string]: string } = CURRENCIES.reduce(
  (acc, c) => {
    acc[c.code] = c.symbol;
    return acc;
  },
  {} as { [code: string]: string }
);

export const getCurrencySymbol = (code: string): string =>
  CURRENCY_SYMBOLS[code] || '$';

export const getCurrency = (code: string): Currency | undefined =>
  CURRENCIES.find((c) => c.code === code);

// Shown grouped in the pickers.
export const POPULAR_CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'JPY'].map(
  (c) => getCurrency(c)!
);
export const OTHER_CURRENCIES: Currency[] = CURRENCIES.filter(
  (c) => !POPULAR_CURRENCIES.some((p) => p.code === c.code)
);

/**
 * Format a number using the conventions of `currencyCode` (separators/decimals)
 * and prefix it with that currency's symbol.
 */
export const formatInCurrency = (amount: number, currencyCode: string): string => {
  const symbol = getCurrencySymbol(currencyCode);

  // Indonesian Rupiah — "." thousands, "," decimals, usually no decimals on whole numbers.
  if (currencyCode === 'IDR') {
    const hasDecimals = amount % 1 !== 0;
    const formatted = amount.toLocaleString('id-ID', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    });
    return `${symbol}${formatted}`;
  }

  // Currencies that don't use decimal places.
  if (currencyCode === 'JPY' || currencyCode === 'KRW' || currencyCode === 'VND') {
    const formatted = Math.round(amount).toLocaleString('en-US');
    return `${symbol}${formatted}`;
  }

  // Bitcoin — up to 8 decimal places.
  if (currencyCode === 'BTC') {
    return `${symbol}${amount.toFixed(8)}`;
  }

  // USD, EUR, GBP, etc. — "," thousands, "." decimals.
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
};

/** Backwards-compatible alias. */
export const formatCurrency = formatInCurrency;

let exchangeRatesCache: { [key: string]: number } | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 3600000; // 1 hour

/** Fallback USD-based rates used when the network/API is unavailable. */
export const FALLBACK_RATES: { [key: string]: number } = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5, IDR: 15650, SGD: 1.34,
  AUD: 1.52, CAD: 1.36, CHF: 0.88, CNY: 7.24, HKD: 7.81, KRW: 1330,
  MYR: 4.72, THB: 35.8, PHP: 56.5, VND: 24500, INR: 83.2, BTC: 0.0000095,
};

/** Fetch USD-based exchange rates (cached 1h). Falls back to static rates. */
export const fetchExchangeRates = async (
  baseCurrency: string = 'USD'
): Promise<{ [key: string]: number }> => {
  const now = Date.now();
  if (exchangeRatesCache && now - lastFetchTime < CACHE_DURATION) {
    return exchangeRatesCache;
  }
  try {
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`
    );
    const data = await response.json();
    exchangeRatesCache = data.rates;
    lastFetchTime = now;
    return data.rates;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return FALLBACK_RATES;
  }
};

/**
 * Synchronously convert an amount between two currencies given a USD-based
 * rate table (rates[X] = units of X per 1 USD). Returns the original amount
 * if either rate is missing.
 */
export const convertWithRates = (
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: { [key: string]: number }
): number => {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  if (!fromRate || !toRate) return amount;
  return (amount / fromRate) * toRate;
};

export const convertCurrency = async (
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> => {
  if (fromCurrency === toCurrency) return amount;
  const rates = await fetchExchangeRates('USD');
  return convertWithRates(amount, fromCurrency, toCurrency, rates);
};

export const getUserCurrency = async (): Promise<string> => {
  try {
    const savedCurrency = await AsyncStorage.getItem('user_currency');
    return savedCurrency || 'USD';
  } catch (error) {
    return 'USD';
  }
};

export const setUserCurrency = async (currencyCode: string): Promise<void> => {
  await AsyncStorage.setItem('user_currency', currencyCode);
};
