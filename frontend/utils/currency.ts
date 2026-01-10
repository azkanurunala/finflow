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

export const formatCurrency = (amount: number, currencyCode: string): string => {
  const currency = [...POPULAR_CURRENCIES, ...OTHER_CURRENCIES].find(
    (c) => c.code === currencyCode
  );
  
  if (!currency) return `${amount.toFixed(2)}`;
  
  // Indonesian Rupiah - uses . for thousands and , for decimals (Rp50.000,53)
  if (currencyCode === 'IDR') {
    const formatted = amount.toLocaleString('id-ID', {
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
    return `${currency.symbol}${formatted}`;
  }
  
  // Japanese Yen - no decimals
  if (currencyCode === 'JPY') {
    const formatted = Math.round(amount).toLocaleString('ja-JP');
    return `${currency.symbol}${formatted}`;
  }
  
  // Bitcoin - 8 decimal places
  if (currencyCode === 'BTC') {
    return `${currency.symbol}${amount.toFixed(8)}`;
  }
  
  // USD, EUR, GBP, etc. - uses , for thousands and . for decimals ($1,300.06)
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency.symbol}${formatted}`;
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
