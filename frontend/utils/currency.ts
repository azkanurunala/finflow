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
  // Middle East / Arab currencies
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', flag: '🇸🇦' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق', flag: '🇶🇦' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', flag: '🇰🇼' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'ب.د', flag: '🇧🇭' },
  { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.', flag: '🇴🇲' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'ج.م', flag: '🇪🇬' },
  { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.ا', flag: '🇯🇴' },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م.', flag: '🇲🇦' },
  { code: 'DZD', name: 'Algerian Dinar', symbol: 'د.ج', flag: '🇩🇿' },
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

  // Gulf dinars use 3 decimal places (fils).
  if (currencyCode === 'KWD' || currencyCode === 'BHD' || currencyCode === 'OMR') {
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
    return `${symbol}${formatted}`;
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
const CACHE_DURATION = 3600000; // 1 hour (in-memory)
const RATES_CACHE_KEY = 'exchange_rates_cache_v2';

/**
 * Last-resort USD-based rates, used only when there's no network AND no
 * persisted cache yet. Kept roughly current; the live API overrides these.
 */
export const FALLBACK_RATES: { [key: string]: number } = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 157, IDR: 17820, SGD: 1.35,
  AUD: 1.53, CAD: 1.41, CHF: 0.9, CNY: 7.25, HKD: 7.8, KRW: 1380,
  MYR: 4.45, THB: 35.5, PHP: 58.5, VND: 25400, INR: 85,
  // Middle East / Arab (several are USD-pegged)
  SAR: 3.75, AED: 3.67, QAR: 3.64, KWD: 0.307, BHD: 0.376, OMR: 0.384,
  EGP: 50, JOD: 0.709, MAD: 9.9, DZD: 134,
  BTC: 0.0000095,
};

/** Persist the latest fetched rates so offline sessions use real recent rates. */
const persistRates = async (rates: { [key: string]: number }) => {
  try {
    await AsyncStorage.setItem(
      RATES_CACHE_KEY,
      JSON.stringify({ rates, ts: Date.now() })
    );
  } catch {
    // ignore storage errors
  }
};

/** Load the last persisted rates (if any) into the in-memory cache. */
export const loadPersistedRates = async (): Promise<
  { [key: string]: number } | null
> => {
  try {
    const raw = await AsyncStorage.getItem(RATES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.rates && parsed.rates.USD) {
      exchangeRatesCache = parsed.rates;
      lastFetchTime = parsed.ts || 0;
      return parsed.rates;
    }
  } catch {
    // ignore parse errors
  }
  return null;
};

// Free, no-API-key endpoints (160+ currencies incl. IDR, SAR, AED, …).
// Tried in order; first success wins.
const RATE_ENDPOINTS = (base: string) => [
  `https://open.er-api.com/v6/latest/${base}`,
  `https://api.exchangerate-api.com/v4/latest/${base}`,
];

/**
 * Fetch USD-based exchange rates from a live API (in-memory cached 1h).
 * On network failure, returns the persisted cache, then the static fallback.
 */
export const fetchExchangeRates = async (
  baseCurrency: string = 'USD'
): Promise<{ [key: string]: number }> => {
  const now = Date.now();
  if (exchangeRatesCache && now - lastFetchTime < CACHE_DURATION) {
    return exchangeRatesCache;
  }
  for (const url of RATE_ENDPOINTS(baseCurrency)) {
    try {
      const response = await fetch(url);
      const data = await response.json();
      const rates = data?.rates;
      // Sanity-check we got a real, non-trivial rate table.
      if (rates && typeof rates === 'object' && rates.USD && rates.IDR) {
        exchangeRatesCache = rates;
        lastFetchTime = now;
        persistRates(rates);
        return rates;
      }
    } catch {
      // try the next endpoint
    }
  }
  console.warn('Exchange rate APIs unreachable; using cached/fallback rates.');
  return exchangeRatesCache || FALLBACK_RATES;
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
