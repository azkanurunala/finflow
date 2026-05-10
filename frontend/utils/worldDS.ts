
// This file is the single source of truth for global data (languages, currencies, flags).
// It uses a local subset of the world data to ensure reliability and offline support.

interface WorldData {
    cca2: string;
    name: string;
    languages: Record<string, string>;
    currencies: Record<string, { name: string; symbol: string }>;
    flag: string;
}

// Data source: Extracted from REST Countries API
// Includes major economies and commonly used languages/currencies to keep bundle size reasonable
// Extended with a heuristic for others.
const WORLD_DATA: WorldData[] = [
    { cca2: "AG", name: "Antigua and Barbuda", languages: { eng: "English" }, currencies: { XCD: { name: "Eastern Caribbean dollar", symbol: "$" } }, flag: "🇦🇬" },
    { cca2: "BT", name: "Bhutan", languages: { dzo: "Dzongkha" }, currencies: { BTN: { name: "Bhutanese ngultrum", symbol: "Nu." }, INR: { name: "Indian rupee", symbol: "₹" } }, flag: "🇧🇹" },
    { cca2: "IT", name: "Italy", languages: { ita: "Italian" }, currencies: { EUR: { name: "Euro", symbol: "€" } }, flag: "🇮🇹" },
    { cca2: "AU", name: "Australia", languages: { eng: "English" }, currencies: { AUD: { name: "Australian dollar", symbol: "$" } }, flag: "🇦🇺" },
    { cca2: "BY", name: "Belarus", languages: { bel: "Belarusian", rus: "Russian" }, currencies: { BYN: { name: "Belarusian ruble", symbol: "Br" } }, flag: "🇧🇾" },
    { cca2: "CN", name: "China", languages: { zho: "Chinese" }, currencies: { CNY: { name: "Chinese yuan", symbol: "¥" } }, flag: "🇨🇳" },
    { cca2: "US", name: "United States", languages: { eng: "English" }, currencies: { USD: { name: "United States dollar", symbol: "$" } }, flag: "🇺🇸" },
    { cca2: "ID", name: "Indonesia", languages: { ind: "Indonesian" }, currencies: { IDR: { name: "Indonesian rupiah", symbol: "Rp" } }, flag: "🇮🇩" },
    { cca2: "JP", name: "Japan", languages: { jpn: "Japanese" }, currencies: { JPY: { name: "Japanese yen", symbol: "¥" } }, flag: "🇯🇵" },
    { cca2: "GB", name: "United Kingdom", languages: { eng: "English" }, currencies: { GBP: { name: "British pound", symbol: "£" } }, flag: "🇬🇧" },
    { cca2: "FR", name: "France", languages: { fra: "French" }, currencies: { EUR: { name: "Euro", symbol: "€" } }, flag: "🇫🇷" },
    { cca2: "DE", name: "Germany", languages: { deu: "German" }, currencies: { EUR: { name: "Euro", symbol: "€" } }, flag: "🇩🇪" },
    { cca2: "ES", name: "Spain", languages: { spa: "Spanish" }, currencies: { EUR: { name: "Euro", symbol: "€" } }, flag: "🇪🇸" },
    { cca2: "IN", name: "India", languages: { hin: "Hindi", eng: "English" }, currencies: { INR: { name: "Indian rupee", symbol: "₹" } }, flag: "🇮🇳" },
    { cca2: "BR", name: "Brazil", languages: { por: "Portuguese" }, currencies: { BRL: { name: "Brazilian real", symbol: "R$" } }, flag: "🇧🇷" },
    { cca2: "RU", name: "Russia", languages: { rus: "Russian" }, currencies: { RUB: { name: "Russian ruble", symbol: "₽" } }, flag: "🇷🇺" },
    { cca2: "KR", name: "South Korea", languages: { kor: "Korean" }, currencies: { KRW: { name: "South Korean won", symbol: "₩" } }, flag: "🇰🇷" },
    { cca2: "MX", name: "Mexico", languages: { spa: "Spanish" }, currencies: { MXN: { name: "Mexican peso", symbol: "$" } }, flag: "🇲🇽" },
    { cca2: "CA", name: "Canada", languages: { eng: "English", fra: "French" }, currencies: { CAD: { name: "Canadian dollar", symbol: "$" } }, flag: "🇨🇦" },
    { cca2: "SG", name: "Singapore", languages: { eng: "English", msa: "Malay", tam: "Tamil", zho: "Chinese" }, currencies: { SGD: { name: "Singapore dollar", symbol: "$" } }, flag: "🇸🇬" },
    { cca2: "MY", name: "Malaysia", languages: { msa: "Malay" }, currencies: { MYR: { name: "Malaysian ringgit", symbol: "RM" } }, flag: "🇲🇾" },
    { cca2: "TH", name: "Thailand", languages: { tha: "Thai" }, currencies: { THB: { name: "Thai baht", symbol: "฿" } }, flag: "🇹🇭" },
    { cca2: "VN", name: "Vietnam", languages: { vie: "Vietnamese" }, currencies: { VND: { name: "Vietnamese đồng", symbol: "₫" } }, flag: "🇻🇳" },
    { cca2: "PH", name: "Philippines", languages: { eng: "English", tgl: "Tagalog" }, currencies: { PHP: { name: "Philippine peso", symbol: "₱" } }, flag: "🇵🇭" },
    { cca2: "TR", name: "Turkey", languages: { tur: "Turkish" }, currencies: { TRY: { name: "Turkish lira", symbol: "₺" } }, flag: "🇹🇷" },
    { cca2: "SA", name: "Saudi Arabia", languages: { ara: "Arabic" }, currencies: { SAR: { name: "Saudi riyal", symbol: "ر.س" } }, flag: "🇸🇦" },
    { cca2: "AE", name: "United Arab Emirates", languages: { ara: "Arabic" }, currencies: { AED: { name: "United Arab Emirates dirham", symbol: "د.إ" } }, flag: "🇦🇪" },
    { cca2: "ZA", name: "South Africa", languages: { eng: "English", afr: "Afrikaans", zul: "Zulu" }, currencies: { ZAR: { name: "South African rand", symbol: "R" } }, flag: "🇿🇦" },
    { cca2: "NG", name: "Nigeria", languages: { eng: "English" }, currencies: { NGN: { name: "Nigerian naira", symbol: "₦" } }, flag: "🇳🇬" },
    { cca2: "AR", name: "Argentina", languages: { spa: "Spanish" }, currencies: { ARS: { name: "Argentine peso", symbol: "$" } }, flag: "🇦🇷" },
    { cca2: "NL", name: "Netherlands", languages: { nld: "Dutch" }, currencies: { EUR: { name: "Euro", symbol: "€" } }, flag: "🇳🇱" },
    { cca2: "BE", name: "Belgium", languages: { nld: "Dutch", fra: "French", deu: "German" }, currencies: { EUR: { name: "Euro", symbol: "€" } }, flag: "🇧🇪" },
    { cca2: "CH", name: "Switzerland", languages: { deu: "German", fra: "French", ita: "Italian" }, currencies: { CHF: { name: "Swiss franc", symbol: "Fr." } }, flag: "🇨🇭" },
    { cca2: "SE", name: "Sweden", languages: { swe: "Swedish" }, currencies: { SEK: { name: "Swedish krona", symbol: "kr" } }, flag: "🇸🇪" },
    { cca2: "NO", name: "Norway", languages: { nob: "Norwegian" }, currencies: { NOK: { name: "Norwegian krone", symbol: "kr" } }, flag: "🇳🇴" },
    { cca2: "DK", name: "Denmark", languages: { dan: "Danish" }, currencies: { DKK: { name: "Danish krone", symbol: "kr" } }, flag: "🇩🇰" },
    { cca2: "FI", name: "Finland", languages: { fin: "Finnish" }, currencies: { EUR: { name: "Euro", symbol: "€" } }, flag: "🇫🇮" },
    { cca2: "IE", name: "Ireland", languages: { eng: "English", gle: "Irish" }, currencies: { EUR: { name: "Euro", symbol: "€" } }, flag: "🇮🇪" },
    { cca2: "PT", name: "Portugal", languages: { por: "Portuguese" }, currencies: { EUR: { name: "Euro", symbol: "€" } }, flag: "🇵🇹" },
    { cca2: "GR", name: "Greece", languages: { ell: "Greek" }, currencies: { EUR: { name: "Euro", symbol: "€" } }, flag: "🇬🇷" },
    { cca2: "EG", name: "Egypt", languages: { ara: "Arabic" }, currencies: { EGP: { name: "Egyptian pound", symbol: "£" } }, flag: "🇪🇬" },
    { cca2: "PK", name: "Pakistan", languages: { eng: "English", urd: "Urdu" }, currencies: { PKR: { name: "Pakistani rupee", symbol: "₨" } }, flag: "🇵🇰" },
    { cca2: "BD", name: "Bangladesh", languages: { ben: "Bengali" }, currencies: { BDT: { name: "Bangladeshi taka", symbol: "৳" } }, flag: "🇧🇩" },
    { cca2: "IL", name: "Israel", languages: { heb: "Hebrew", ara: "Arabic" }, currencies: { ILS: { name: "Israeli new shekel", symbol: "₪" } }, flag: "🇮🇱" },
    { cca2: "PL", name: "Poland", languages: { pol: "Polish" }, currencies: { PLN: { name: "Polish złoty", symbol: "zł" } }, flag: "🇵🇱" },
    { cca2: "CZ", name: "Czechia", languages: { ces: "Czech" }, currencies: { CZK: { name: "Czech koruna", symbol: "Kč" } }, flag: "🇨🇿" },
    { cca2: "HU", name: "Hungary", languages: { hun: "Hungarian" }, currencies: { HUF: { name: "Hungarian forint", symbol: "Ft" } }, flag: "🇭🇺" },
    { cca2: "AT", name: "Austria", languages: { deu: "German" }, currencies: { EUR: { name: "Euro", symbol: "€" } }, flag: "🇦🇹" },
    { cca2: "NZ", name: "New Zealand", languages: { eng: "English", mri: "Māori" }, currencies: { NZD: { name: "New Zealand dollar", symbol: "$" } }, flag: "🇳🇿" },
];

/**
 * Get all supported languages
 * In this simplified version, we extract unique languages spanning our WORLD_DATA.
 */
export const getAllLanguages = () => {
  const langMap = new Map<string, { code: string; name: string; native?: string; flag: string }>();
  
  // Set defaults for common languages to ensure they are always present
  const DEFAULTS = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  ];

  DEFAULTS.forEach(l => langMap.set(l.code, l));

  WORLD_DATA.forEach(country => {
    Object.entries(country.languages).forEach(([code, name]) => {
      // Map ISO 639-3 to ISO 639-1 if possible for consistency
      const shortCode = code.slice(0, 2); 
      if (!langMap.has(shortCode)) {
        langMap.set(shortCode, {
          code: shortCode,
          name: name,
          flag: country.flag
        });
      }
    });
  });

  return Array.from(langMap.values()).sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Get all supported currencies
 */
export const getAllCurrencies = () => {
  const currencyMap = new Map<string, { code: string; name: string; symbol: string; flag: string }>();

  WORLD_DATA.forEach(country => {
    Object.entries(country.currencies).forEach(([code, data]) => {
      if (!currencyMap.has(code)) {
        currencyMap.set(code, {
          code: code,
          name: data.name,
          symbol: data.symbol,
          flag: country.flag
        });
      }
    });
  });

  // Ensure common ones are present if not in WORLD_DATA subset
  const REQUIRED = [
    { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
    { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩' },
    { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
    { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  ];

  REQUIRED.forEach(r => {
    if (!currencyMap.has(r.code)) currencyMap.set(r.code, r);
  });

  return Array.from(currencyMap.values()).sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Get default currency for a language
 */
export const getCurrencyForLanguage = (languageCode: string): string => {
  const MAPPINGS: Record<string, string> = {
    en: 'USD',
    id: 'IDR',
    es: 'EUR',
    fr: 'EUR',
    de: 'EUR',
    ja: 'JPY',
    ko: 'KRW',
    zh: 'CNY',
    ar: 'SAR',
    ru: 'RUB',
    pt: 'BRL',
    hi: 'INR',
  };

  return MAPPINGS[languageCode.slice(0, 2)] || 'USD';
};
